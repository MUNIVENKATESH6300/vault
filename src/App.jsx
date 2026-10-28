
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard,
  Files,
  Folder,
  Clock3,
  Star,
  Trash2,
  Settings,
  Search,
  Upload,
  FileText,
  FileImage,
  FileSpreadsheet,
  File as FileIcon,
  Download,
  Plus,
  HardDrive,
  ChevronRight,
  CheckCircle2,
  Menu,
  X,
} from "lucide-react";
import "./App.css";

const DB_NAME = "DocVaultDatabase";
const STORE_NAME = "documents";


function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}


async function getDocuments() {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const request = db
      .transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}


async function saveDocument(document) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");

    transaction.objectStore(STORE_NAME).put(document);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// Delete a document permanently from browser storage.
async function removeDocument(id) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");

    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function formatSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileCategory(name = "") {
  const extension = name.split(".").pop().toLowerCase();

  if (["png", "jpg", "jpeg", "gif", "webp"].includes(extension)) {
    return "image";
  }

  if (["xls", "xlsx", "csv"].includes(extension)) {
    return "spreadsheet";
  }

  if (["pdf", "doc", "docx", "txt", "ppt", "pptx"].includes(extension)) {
    return "document";
  }

  return "other";
}

function FileIconFor({ name }) {
  const category = getFileCategory(name);

  if (category === "image") return <FileImage size={20} />;
  if (category === "spreadsheet") return <FileSpreadsheet size={20} />;
  if (category === "document") return <FileText size={20} />;

  return <FileIcon size={20} />;
}

function App() {
  const [documents, setDocuments] = useState([]);
  const [activePage, setActivePage] = useState("All Documents");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dragging, setDragging] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    getDocuments()
      .then(setDocuments)
      .catch((error) => {
        console.error(error);
        setMessage("Could not load documents from browser storage.");
      })
      .finally(() => setLoading(false));
  }, []);

  const activeDocuments = documents.filter((doc) => !doc.trashed);

  const totalSize = activeDocuments.reduce(
    (total, doc) => total + doc.size,
    0
  );

  const filteredDocuments = useMemo(() => {
    let result = [...documents];

    if (activePage === "Favorites") {
      result = result.filter((doc) => doc.favorite && !doc.trashed);
    } else if (activePage === "Recent") {
      result = result
        .filter((doc) => !doc.trashed)
        .sort((a, b) => b.uploadedAt - a.uploadedAt)
        .slice(0, 5);
    } else if (activePage === "Trash") {
      result = result.filter((doc) => doc.trashed);
    } else {
      result = result.filter((doc) => !doc.trashed);
    }

    const query = search.trim().toLowerCase();

    if (query) {
      result = result.filter(
        (doc) =>
          doc.name.toLowerCase().includes(query) ||
          doc.type.toLowerCase().includes(query)
      );
    }

    return result.sort((a, b) => b.uploadedAt - a.uploadedAt);
  }, [documents, activePage, search]);

  async function uploadFiles(fileList) {
    const files = Array.from(fileList || []);

    if (files.length === 0) return;

    try {
      const newDocuments = files.map((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        type: file.type || "Unknown file type",
        uploadedAt: Date.now(),
        favorite: false,
        trashed: false,
        file,
      }));

      for (const doc of newDocuments) {
        await saveDocument(doc);
      }

      setDocuments((current) => [...newDocuments, ...current]);
      setMessage(`${newDocuments.length} file(s) uploaded successfully.`);
    } catch (error) {
      console.error(error);
      setMessage("Upload failed. Check your browser storage.");
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function toggleFavorite(doc) {
    const updated = { ...doc, favorite: !doc.favorite };

    try {
      await saveDocument(updated);

      setDocuments((current) =>
        current.map((item) => (item.id === doc.id ? updated : item))
      );
    } catch (error) {
      console.error(error);
      setMessage("Could not update favorite.");
    }
  }

  async function deleteDocument(doc) {
    if (activePage === "Trash") {
      const confirmed = window.confirm(
        `Permanently delete "${doc.name}"?`
      );

      if (!confirmed) return;

      try {
        await removeDocument(doc.id);
        setDocuments((current) =>
          current.filter((item) => item.id !== doc.id)
        );
        setMessage("Document permanently deleted.");
      } catch (error) {
        console.error(error);
        setMessage("Could not delete document.");
      }

      return;
    }

    const updated = { ...doc, trashed: true };

    try {
      await saveDocument(updated);

      setDocuments((current) =>
        current.map((item) => (item.id === doc.id ? updated : item))
      );

      setMessage("Document moved to Trash.");
    } catch (error) {
      console.error(error);
      setMessage("Could not move document to Trash.");
    }
  }

  async function restoreDocument(doc) {
    const updated = { ...doc, trashed: false };

    try {
      await saveDocument(updated);

      setDocuments((current) =>
        current.map((item) => (item.id === doc.id ? updated : item))
      );

      setMessage("Document restored.");
    } catch (error) {
      console.error(error);
      setMessage("Could not restore document.");
    }
  }

  function downloadDocument(doc) {
    if (!doc.file) {
      setMessage("The original file is unavailable.");
      return;
    }

    const url = URL.createObjectURL(doc.file);
    const link = window.document.createElement("a");

    link.href = url;
    link.download = doc.name;
    window.document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function previewDocument(doc) {
    if (!doc.file) {
      setMessage("The original file is unavailable.");
      return;
    }

    const url = URL.createObjectURL(doc.file);
    window.open(url, "_blank", "noopener,noreferrer");

    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  const navigation = [
    { label: "Overview", icon: LayoutDashboard },
    { label: "All Documents", icon: Files },
    { label: "Folders", icon: Folder },
    { label: "Recent", icon: Clock3 },
    { label: "Favorites", icon: Star },
    { label: "Trash", icon: Trash2 },
  ];

  function navigate(page) {
    setActivePage(page);
    setSidebarOpen(false);
  }

  return (
    <div className={`app-shell ${darkMode ? "dark" : ""}`}>
      {sidebarOpen && (
        <button
          className="mobile-overlay"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-logo">
            <Files size={23} />
          </div>

          <div>
            <h2>DocVault</h2>
            <span>Your document workspace</span>
          </div>

          <button
            className="icon-button sidebar-close"
            aria-label="Close menu"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={19} />
          </button>
        </div>

        <button
          className="upload-button"
          onClick={() => fileInputRef.current?.click()}
        >
          <Plus size={19} />
          Upload document
        </button>

        <p className="nav-heading">WORKSPACE</p>

        <nav className="nav-section">
          {navigation.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-item ${activePage === label ? "active" : ""}`}
              onClick={() => navigate(label)}
            >
              <Icon size={19} />
              <span>{label}</span>

              {label === "All Documents" && (
                <span className="nav-count">{activeDocuments.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="storage-card">
            <div className="storage-heading">
              <HardDrive size={18} />
              <span>Browser storage</span>
            </div>

            <div className="storage-track">
              <div
                className="storage-progress"
                style={{
                  width: `${Math.min(
                    (totalSize / (100 * 1024 * 1024)) * 100,
                    100
                  )}%`,
                }}
              />
            </div>

            <p>{formatSize(totalSize)} in uploaded files</p>
            <small>Browser storage limits apply</small>
          </div>

          <button
            className="nav-item"
            onClick={() => setDarkMode((current) => !current)}
          >
            <Settings size={19} />
            <span>{darkMode ? "Light appearance" : "Dark appearance"}</span>
          </button>

          <div className="profile">
            <div className="avatar">D</div>
            <div className="profile-details">
              <strong>Workspace Owner</strong>
              <span>Local workspace</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={22} />
            </button>

            <div className="breadcrumb">
              <span>Workspace</span>
              <ChevronRight size={15} />
              <strong>{activePage}</strong>
            </div>
          </div>

          <div className="topbar-right">
            <label className="search-box">
              <Search size={18} />
              <input
                type="search"
                placeholder="Search documents..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <div className="top-avatar">D</div>
          </div>
        </header>

        <section className="content">
          <div className="welcome-row">
            <div>
              <p className="eyebrow">YOUR DIGITAL WORKSPACE</p>
              <h1>
                {activePage === "Overview" ? "Welcome to DocVault" : activePage}
              </h1>
              <p className="page-description">
                Store, find, and organize your documents in one place.
              </p>
            </div>

            <button
              className="primary-button"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={18} />
              Upload files
            </button>

            <input
              ref={fileInputRef}
              className="hidden-input"
              type="file"
              multiple
              onChange={(event) => uploadFiles(event.target.files)}
            />
          </div>

          {message && (
            <div className="toast-message">
              <CheckCircle2 size={17} />
              <span>{message}</span>
              <button onClick={() => setMessage("")} aria-label="Dismiss">
                <X size={16} />
              </button>
            </div>
          )}

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-top">
                <span>Total documents</span>
                <div className="stat-icon purple">
                  <Files size={20} />
                </div>
              </div>
              <h2>{activeDocuments.length}</h2>
              <p>Documents in your workspace</p>
            </div>

            <div className="stat-card">
              <div className="stat-top">
                <span>Favorites</span>
                <div className="stat-icon orange">
                  <Star size={20} />
                </div>
              </div>
              <h2>{activeDocuments.filter((doc) => doc.favorite).length}</h2>
              <p>Documents saved for quick access</p>
            </div>

            <div className="stat-card">
              <div className="stat-top">
                <span>Storage used</span>
                <div className="stat-icon blue">
                  <HardDrive size={20} />
                </div>
              </div>
              <h2>{formatSize(totalSize)}</h2>
              <p>Total size of your active files</p>
            </div>
          </div>

          <section
            className={`upload-panel ${dragging ? "dragging" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setDragging(false);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              uploadFiles(event.dataTransfer.files);
            }}
          >
            <div className="upload-art">
              <Upload size={25} />
            </div>

            <div className="upload-panel-text">
              <h3>Drop your files here</h3>
              <p>Drag and drop files here, or browse your computer.</p>
            </div>

            <button
              className="secondary-button"
              onClick={() => fileInputRef.current?.click()}
            >
              Browse files
            </button>
          </section>

          <section className="documents-section">
            <div className="section-header">
              <div>
                <h2>
                  {activePage === "Overview" ? "Recent documents" : activePage}
                </h2>
                <p>
                  {filteredDocuments.length}{" "}
                  {filteredDocuments.length === 1 ? "item" : "items"}
                </p>
              </div>

              <button
                className="text-button"
                onClick={() => navigate("All Documents")}
              >
                View all <ChevronRight size={16} />
              </button>
            </div>

            {activePage === "Folders" ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <Folder size={28} />
                </div>
                <h3>Folders are coming next</h3>
                <p>
                  You can upload and manage files now. Folder creation can be
                  added as the next feature.
                </p>
              </div>
            ) : loading ? (
              <div className="empty-state">
                <p>Loading your documents...</p>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <Files size={28} />
                </div>
                <h3>
                  {search ? "No matching documents" : "No documents yet"}
                </h3>
                <p>
                  {search
                    ? "Try another search term."
                    : "Upload your first document to get started."}
                </p>
                {!search && activePage !== "Trash" && (
                  <button
                    className="primary-button"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={17} /> Upload your first file
                  </button>
                )}
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="document-table">
                  <thead>
                    <tr>
                      <th>DOCUMENT NAME</th>
                      <th>SIZE</th>
                      <th>DATE ADDED</th>
                      <th>TYPE</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredDocuments.map((doc) => (
                      <tr key={doc.id}>
                        <td>
                          <button
                            className="document-name-cell"
                            onClick={() =>
                              activePage === "Trash"
                                ? restoreDocument(doc)
                                : previewDocument(doc)
                            }
                            title={doc.name}
                          >
                            <span
                              className={`file-icon ${getFileCategory(doc.name)}`}
                            >
                              <FileIconFor name={doc.name} />
                            </span>

                            <span className="file-name-wrap">
                              <strong>{doc.name}</strong>
                              <small>{doc.type}</small>
                            </span>
                          </button>
                        </td>

                        <td>{formatSize(doc.size)}</td>
                        <td>
                          {new Date(doc.uploadedAt).toLocaleDateString()}
                        </td>
                        <td>
                          <span className="file-type-label">
                            {doc.name.includes(".")
                              ? doc.name.split(".").pop().toUpperCase()
                              : "FILE"}
                          </span>
                        </td>

                        <td>
                          <div className="row-actions">
                            {activePage === "Trash" ? (
                              <button
                                className="icon-button"
                                title="Restore"
                                onClick={() => restoreDocument(doc)}
                              >
                                <CheckCircle2 size={17} />
                              </button>
                            ) : (
                              <>
                                <button
                                  className={`icon-button favorite-action ${
                                    doc.favorite ? "is-favorite" : ""
                                  }`}
                                  title="Toggle favorite"
                                  onClick={() => toggleFavorite(doc)}
                                >
                                  <Star
                                    size={17}
                                    fill={
                                      doc.favorite ? "currentColor" : "none"
                                    }
                                  />
                                </button>

                                <button
                                  className="icon-button"
                                  title="Download"
                                  onClick={() => downloadDocument(doc)}
                                >
                                  <Download size={17} />
                                </button>
                              </>
                            )}

                            <button
                              className="icon-button delete-action"
                              title={
                                activePage === "Trash"
                                  ? "Permanently delete"
                                  : "Move to Trash"
                              }
                              onClick={() => deleteDocument(doc)}
                            >
                              <Trash2 size={17} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <footer className="page-footer">
            <span>© 2026 DocVault</span>
            <span>Organize smarter. Work faster.</span>
          </footer>
        </section>
      </main>
    </div>
  );
}

export default App;
