import React, { useState, useEffect } from "react";
import { 
  HardDrive, 
  Search, 
  RefreshCw, 
  FileVideo, 
  Folder, 
  ExternalLink, 
  Clock, 
  Database,
  Loader2,
  ChevronRight,
  Download,
  MoreVertical,
  Play
} from "lucide-react";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  thumbnailLink?: string;
  size?: string;
  createdTime: string;
  iconLink?: string;
}

export default function GoogleDriveTab() {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchFiles = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/google/drive-files");
      const data = await res.json();
      if (data.success) {
        setFiles(data.files || []);
      } else {
        setError(data.error || "Failed to fetch cloud archive.");
      }
    } catch (err) {
      setError("Network error. Ensure STAP Bridge is connected.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const filteredFiles = files.filter(f => 
    (f.name || "").toLowerCase().includes((searchTerm || "").toLowerCase())
  );

  const formatSize = (bytes?: string) => {
    if (!bytes) return "—";
    const b = parseInt(bytes);
    if (b < 1024) return b + " B";
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
    return (b / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Summary Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <HardDrive className="h-5 w-5" />
            </div>
            <h2 className="text-base font-black text-slate-800 tracking-tight uppercase">Google Drive Cloud Archive</h2>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Browse and manage video evidence logs stored in your linked Google Workspace account.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Filter archive..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
          <button 
            onClick={fetchFiles}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all active:scale-95"
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error ? (
        <div className="bg-rose-50 border border-rose-200 p-8 rounded-3xl text-center space-y-3">
          <div className="flex justify-center">
            <div className="p-3 bg-rose-100 text-rose-600 rounded-full">
              <Database className="h-6 w-6" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-rose-900">Connection Error</h3>
            <p className="text-xs text-rose-700/70 max-w-sm mx-auto leading-relaxed">
              {error}. Please ensure you have configured your GOOGLE_REFRESH_TOKEN in the System & Bridge settings.
            </p>
          </div>
          <button 
            onClick={fetchFiles}
            className="px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 transition-all"
          >
            Retry Connection
          </button>
        </div>
      ) : isLoading ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-20 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Synchronizing with Google Cloud...</p>
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-20 flex flex-col items-center justify-center space-y-4 text-center">
          <div className="p-4 bg-slate-50 rounded-full">
            <Search className="h-8 w-8 text-slate-300" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-slate-800">No matching files found</p>
            <p className="text-xs text-slate-400">Try adjusting your search or check if the files exist in your Drive.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredFiles.map((file) => {
            const isFolder = file.mimeType === "application/vnd.google-apps.folder";
            const isVideo = file.mimeType.startsWith("video/");

            return (
              <div 
                key={file.id} 
                className="group bg-white border border-slate-200/80 rounded-2xl overflow-hidden hover:border-blue-300 hover:shadow-md transition-all flex flex-col"
              >
                {/* File Preview / Icon Area */}
                <div className="aspect-video bg-slate-100 relative overflow-hidden flex items-center justify-center">
                  {isVideo && file.thumbnailLink ? (
                    <img 
                      src={file.thumbnailLink} 
                      alt="" 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                      referrerPolicy="no-referrer" 
                    />
                  ) : (
                    <div className={`p-6 rounded-2xl ${isFolder ? "bg-amber-100 text-amber-600" : "bg-slate-200 text-slate-400"}`}>
                      {isFolder ? <Folder className="h-10 w-10 fill-current" /> : <FileVideo className="h-10 w-10" />}
                    </div>
                  )}
                  
                  {isVideo && (
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="p-3 bg-white/20 backdrop-blur-md rounded-full text-white">
                        <Play className="h-6 w-6 fill-current" />
                      </div>
                    </div>
                  )}

                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a 
                      href={file.webViewLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-2 bg-white/90 backdrop-blur-sm rounded-lg text-slate-600 hover:text-blue-600 shadow-sm transition-all block"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>

                {/* Info Area */}
                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-slate-800 line-clamp-2 leading-relaxed" title={file.name}>
                      {file.name}
                    </h3>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                      <Clock className="h-3 w-3" />
                      {new Date(file.createdTime).toLocaleDateString()}
                      <span className="w-1 h-1 bg-slate-300 rounded-full" />
                      {formatSize(file.size)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      isFolder ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"
                    }`}>
                      {isFolder ? "Folder" : "Log Footage"}
                    </span>
                    
                    <div className="flex items-center gap-1">
                      <a 
                        href={file.webViewLink} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-1.5 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-all"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                      <button className="p-1.5 hover:bg-slate-100 text-slate-400 rounded-lg">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
