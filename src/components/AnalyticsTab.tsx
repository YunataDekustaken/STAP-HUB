import React, { useState, useMemo, useEffect } from "react";
import {
  UploadCloud,
  TrendingUp,
  Activity,
  BarChart2,
  Sliders,
  Calendar,
  Clock,
  Car,
  AlertCircle,
  RefreshCw,
  MapPin,
  ChevronRight,
  Info,
  Database,
  Cloud,
  CloudOff,
  CloudLightning,
  Trash2,
  FileSpreadsheet,
  Eye,
  CheckCircle2,
  ArrowUpRight,
  Search,
  Download,
  MoreVertical,
  ChevronDown,
  X,
  Save,
  FileText,
  Filter,
  Check,
  Send,
  Share,
  Mail,
  HardDrive
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  Cell
} from "recharts";
import { parseTrafficCSV, ParsedTrafficData, Snapshot } from "../utils/csvParser";
import { generateTrafficReport, ReportMetadata } from "../utils/reportGenerator";
import { SAMPLE_TRAFFIC_CSV } from "../utils/sampleData";
import { getFirebaseInstances, getFirebaseConfig } from "../firebase";
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy } from "firebase/firestore";

interface UnifiedLedger {
  filename: string;
  size: number;
  uploadedAt: string;
  source: "local" | "cloud" | "synced";
  sourceType?: "python_controller" | "user_uploaded";
  csvData?: string;
}

// Helper to format vehicle types nicely for display
const formatVehicleType = (type: string): string => {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace("Car Sedan Suv", "Sedan / SUV")
    .replace("E Trike", "E-Trike")
    .replace("Modern Jeepney", "Modern Jeepney")
    .replace("Traditional Jeepney", "Traditional Jeepney");
};

export default function AnalyticsTab() {
  const [csvText, setCsvText] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeChartTab, setActiveChartTab] = useState<"vol" | "dens" | "dist">("vol");
  const [subTab, setSubTab] = useState<"explorer" | "hub" | "daily" | "reports">("explorer");
  const [localLedgers, setLocalLedgers] = useState<UnifiedLedger[]>([]);
  const [cloudLedgers, setCloudLedgers] = useState<UnifiedLedger[]>([]);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [autoSync, setAutoSync] = useState<boolean>(true);

  // Search and Filter State
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterSourceType, setFilterSourceType] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedLedgerIds, setSelectedLedgerIds] = useState<string[]>([]);
  const [isViewerOpen, setIsViewerOpen] = useState<boolean>(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [isUploadingManual, setIsUploadingManual] = useState<boolean>(false);
  const [viewingLedger, setViewingLedger] = useState<UnifiedLedger | null>(null);
  const [viewerCsvData, setViewerCsvData] = useState<string>("");
  const [isEditingViewer, setIsEditingViewer] = useState<boolean>(false);
  const [viewerStatus, setViewerStatus] = useState<string | null>(null);

  const [generatingReport, setGeneratingReport] = useState<boolean>(false);
  const [reportRequests, setReportRequests] = useState<any[]>([]);
  
  // Sharing State
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [currentReport, setCurrentReport] = useState<{ doc: any; filename: string; type: string } | null>(null);
  const [recipientEmail, setRecipientEmail] = useState<string>("");
  const [emailNote, setEmailNote] = useState<string>("");
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);
  const [isSavingToDrive, setIsSavingToDrive] = useState<boolean>(false);
  const [shareSuccess, setShareSuccess] = useState<string | null>(null);

  // Fetch report requests from Firestore
  useEffect(() => {
    const { db } = getFirebaseInstances();
    if (!db) return;

    const q = query(collection(db, "report_requests"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setReportRequests(requests);
    });

    return () => unsubscribe();
  }, []);

  const handleGenerateAdminReport = async (type: string, autoOpenShare = true) => {
    setGeneratingReport(true);
    try {
      // Use aggregated data if in daily view or specific ledgers are selected
      const ledgersToReport = subTab === "daily" ? rollupLedgers : 
                              selectedLedgerIds.length > 0 ? unifiedLedgers.filter(l => selectedLedgerIds.includes(l.filename)) :
                              unifiedLedgers;

      if (ledgersToReport.length === 0) {
        alert("No ledger data available to generate report.");
        return;
      }

      const parsedDataList = ledgersToReport.map(l => {
        if (!l.csvData) return null;
        try { return parseTrafficCSV(l.csvData); } catch (e) { return null; }
      }).filter(Boolean) as ParsedTrafficData[];

      const metadata: ReportMetadata = {
        type,
        dateRange: subTab === "daily" ? (selectedDay || "Current Selection") : "Complete History",
        generatedBy: "System Administrator",
        certifiedBy: type === "Certified Traffic Log" ? "Officer-in-Charge" : undefined,
        refNumber: `STAP-${Date.now().toString(36).toUpperCase()}`
      };

      const doc = generateTrafficReport(parsedDataList, metadata);
      const filename = `${type.replace(/\s+/g, "_")}_${new Date().toISOString().split('T')[0]}.pdf`;

      if (autoOpenShare) {
        setCurrentReport({ doc, filename, type });
        setShowShareModal(true);
        setRecipientEmail("");
        setEmailNote("");
        setShareSuccess(null);
      } else {
        doc.save(filename);
      }
    } catch (err) {
      console.error("Failed to generate report:", err);
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleSendEmail = async () => {
    if (!currentReport || !recipientEmail) return;
    setIsSendingEmail(true);
    setShareSuccess(null);
    try {
      const pdfBase64 = currentReport.doc.output("datauristring").split(",")[1];
      
      const res = await fetch("/api/gmail/send-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: recipientEmail,
          subject: `STAP Hub Official Report: ${currentReport.type}`,
          body: `
            <div style="font-family: sans-serif; color: #1e293b; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
              <h2 style="color: #4E6290; margin-top: 0;">STAP Hub Intelligence Report</h2>
              <p>Hello,</p>
              <p>Please find the attached <strong>${currentReport.type}</strong> generated by the STAP Hub Traffic Management System.</p>
              ${emailNote ? `<div style="background: #f1f5f9; padding: 15px; border-radius: 8px; border-left: 4px solid #4E6290; margin: 20px 0;">${emailNote}</div>` : ""}
              <p style="font-size: 11px; color: #64748b; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
                This is an automated delivery from the STAP Hub Administration Console. Official Certification documents are attached where applicable.
              </p>
            </div>
          `,
          attachment: pdfBase64,
          filename: currentReport.filename
        })
      });

      const data = await res.json();
      if (data.success) {
        setShareSuccess("Email sent successfully!");
        setTimeout(() => {
          setShowShareModal(false);
          setShareSuccess(null);
        }, 2000);
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      alert(`Failed to send email: ${err.message}`);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleSaveToDrive = async () => {
    if (!currentReport) return;
    
    const confirmed = window.confirm(`Save "${currentReport.filename}" to Google Drive (STAP Reports folder)?`);
    if (!confirmed) return;

    setIsSavingToDrive(true);
    setShareSuccess(null);
    try {
      const pdfBase64 = currentReport.doc.output("datauristring").split(",")[1];
      
      const res = await fetch("/api/google/drive-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: currentReport.filename,
          content: pdfBase64,
          mimeType: "application/pdf",
          folderName: "STAP Reports"
        })
      });

      const data = await res.json();
      if (data.success) {
        setShareSuccess("Saved to Google Drive successfully!");
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      alert(`Failed to save to Drive: ${err.message}`);
    } finally {
      setIsSavingToDrive(false);
    }
  };

  const handleApproveReportRequest = async (request: any) => {
    const { db } = getFirebaseInstances();
    if (!db) return;

    try {
      // 1. Generate PDF
      const ledgersToReport = unifiedLedgers.filter(l => {
        const uploadedAt = new Date(l.uploadedAt).getTime();
        const start = new Date(request.requestedRange.startDate).getTime();
        const end = new Date(request.requestedRange.endDate).getTime() + (24 * 60 * 60 * 1000);
        return uploadedAt >= start && uploadedAt < end;
      });

      const parsedDataList = ledgersToReport.map(l => {
        if (!l.csvData) return null;
        try { return parseTrafficCSV(l.csvData); } catch (e) { return null; }
      }).filter(Boolean) as ParsedTrafficData[];

      const metadata: ReportMetadata = {
        type: "Certified Traffic Log",
        dateRange: `${request.requestedRange.startDate} to ${request.requestedRange.endDate}`,
        generatedBy: "STAP Hub Operations",
        certifiedBy: "Inspector Martinez", // Mock officer
        refNumber: `REQ-${request.id.substring(0, 8).toUpperCase()}`
      };

      const reportDoc = generateTrafficReport(parsedDataList, metadata);
      const pdfDataUri = reportDoc.output("datauristring");

      // 2. Update Firestore status
      await setDoc(doc(db, "report_requests", request.id), {
        ...request,
        status: "APPROVED",
        certifiedBy: "Inspector Martinez",
        certifiedAt: new Date().toISOString(),
        generatedPdfUrl: pdfDataUri
      }, { merge: true });

      alert("Request approved and certified successfully.");
    } catch (err) {
      console.error("Failed to approve report request:", err);
      alert("Failed to approve request.");
    }
  };

  const handleRejectReportRequest = async (requestId: string) => {
    const { db } = getFirebaseInstances();
    if (!db) return;
    try {
      await setDoc(doc(db, "report_requests", requestId), {
        status: "REJECTED",
        rejectedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.error("Failed to reject request:", err);
    }
  };

  const ReportRequestsList = () => {
    if (reportRequests.length === 0) {
      return (
        <div className="p-8 text-center text-slate-400 text-[10px] font-bold">
          No certification requests pending review.
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[11px] font-medium text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-[9px] font-black uppercase text-slate-400">
            <tr>
              <th className="px-5 py-3">Requester</th>
              <th className="px-5 py-3">Range</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {reportRequests.map((req) => (
              <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3">
                  <div className="font-bold text-slate-800">{req.requesterInfo?.name || "Citizen"}</div>
                  <div className="text-[9px] text-slate-400">{req.requesterInfo?.email}</div>
                </td>
                <td className="px-5 py-3">
                  {req.requestedRange?.startDate} to {req.requestedRange?.endDate}
                </td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${
                    req.status === "PENDING" ? "bg-amber-100 text-amber-700" :
                    req.status === "APPROVED" ? "bg-emerald-100 text-emerald-700" :
                    "bg-rose-100 text-rose-700"
                  }`}>
                    {req.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  {req.status === "PENDING" && (
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleApproveReportRequest(req)}
                        className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md hover:bg-emerald-100 transition-all font-black text-[9px] uppercase"
                      >
                        Approve
                      </button>
                      <button 
                        onClick={() => handleRejectReportRequest(req.id)}
                        className="px-2 py-1 bg-rose-50 text-rose-700 rounded-md hover:bg-rose-100 transition-all font-black text-[9px] uppercase"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                  {req.status === "APPROVED" && (
                    <span className="text-[9px] text-emerald-600 font-bold italic">Certified ✔</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Fetch local ledgers from Express server
  const fetchLocalLedgers = async () => {
    try {
      const res = await fetch("/api/v1/ledgers");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setLocalLedgers(data.ledgers || []);
        }
      }
    } catch (err) {
      console.error("Failed to fetch local ledgers:", err);
    }
  };

  const handleManualUpload = async () => {
    if (!uploadingFile) return;

    try {
      setIsUploadingManual(true);
      const text = await uploadingFile.text();
      
      const res = await fetch("/api/v1/upload-manual-ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: uploadingFile.name,
          csvData: text
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setSyncStatus(`Manual upload successful: ${uploadingFile.name}`);
      setIsUploadModalOpen(false);
      setUploadingFile(null);
      fetchLocalLedgers(); // Refresh list
      setTimeout(() => setSyncStatus(null), 3000);
    } catch (err: any) {
      console.error("Manual upload error:", err);
      alert(`Upload Error: ${err.message}`);
    } finally {
      setIsUploadingManual(false);
    }
  };

  // Sync to Cloud function (declaring first so it can be used in auto-sync)
  const syncToCloud = async (ledger: UnifiedLedger) => {
    const { db } = getFirebaseInstances();
    if (!db) {
      alert("Firebase is not connected. Please check your config in the settings tab.");
      return;
    }

    try {
      setSyncStatus(`Saving ${ledger.filename} to Cloud...`);
      let csvContent = ledger.csvData;

      if (!csvContent) {
        const res = await fetch(`/api/v1/ledgers/${encodeURIComponent(ledger.filename)}`);
        if (!res.ok) throw new Error("Failed to load local file content.");
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Failed to load local file content.");
        csvContent = data.csvData;
      }

      if (!csvContent) throw new Error("File content is empty.");

      const safeDocId = ledger.filename.replace(/[.#$/[\]]/g, "_");
      await setDoc(doc(db, "ledgers", safeDocId), {
        filename: ledger.filename,
        size: ledger.size,
        uploadedAt: ledger.uploadedAt,
        sourceType: ledger.sourceType || "python_controller",
        csvData: csvContent,
        syncedAt: new Date().toISOString()
      });

      setSyncStatus(`Successfully synced ${ledger.filename} to cloud.`);
      setTimeout(() => setSyncStatus(null), 3000);
    } catch (err: any) {
      console.error("Sync error:", err);
      setSyncStatus(`Sync error: ${err.message}`);
      setTimeout(() => setSyncStatus(null), 5000);
    }
  };

  // Real-time synchronization and polling logic
  useEffect(() => {
    fetchLocalLedgers();
    const interval = setInterval(fetchLocalLedgers, 5000);

    const { db } = getFirebaseInstances();
    if (!db) {
      return () => clearInterval(interval);
    }

    try {
      const q = query(collection(db, "ledgers"), orderBy("uploadedAt", "desc"));
      const unsub = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map(d => ({
          filename: d.data().filename,
          size: d.data().size || 0,
          uploadedAt: d.data().uploadedAt,
          sourceType: d.data().sourceType || "python_controller",
          csvData: d.data().csvData || "",
          id: d.id
        }));
        setCloudLedgers(docs as any);
      }, (error) => {
        console.error("Firestore ledgers subscription error:", error);
      });

      return () => {
        clearInterval(interval);
        unsub();
      };
    } catch (err) {
      console.error("Error setting up Firestore ledgers listener:", err);
      return () => clearInterval(interval);
    }
  }, []);

  // Merge lists to build unified ledger logs list
  const unifiedLedgers = useMemo(() => {
    const mergedMap = new Map<string, UnifiedLedger>();

    cloudLedgers.forEach((c) => {
      mergedMap.set(c.filename, {
        filename: c.filename,
        size: c.size,
        uploadedAt: c.uploadedAt,
        sourceType: c.sourceType,
        source: "cloud",
        csvData: c.csvData
      });
    });

    localLedgers.forEach((l) => {
      if (mergedMap.has(l.filename)) {
        const existing = mergedMap.get(l.filename)!;
        mergedMap.set(l.filename, {
          ...existing,
          source: "synced"
        });
      } else {
        mergedMap.set(l.filename, {
          filename: l.filename,
          size: l.size,
          uploadedAt: l.uploadedAt,
          sourceType: l.sourceType,
          source: "local"
        });
      }
    });

    return Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
  }, [localLedgers, cloudLedgers]);

  // Search and Filter Logic
  const filteredLedgers = useMemo(() => {
    let list = unifiedLedgers;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(l => 
        (l.filename || "").toLowerCase().includes(term)
      );
    }

    if (filterSourceType !== "ALL") {
      list = list.filter(l => l.sourceType === filterSourceType);
    }

    if (startDate) {
      const start = new Date(startDate).getTime();
      list = list.filter(l => new Date(l.uploadedAt).getTime() >= start);
    }

    if (endDate) {
      const end = new Date(endDate).getTime();
      // Add 23:59:59 to end date to include the whole day
      const endOfDay = end + (24 * 60 * 60 * 1000) - 1;
      list = list.filter(l => new Date(l.uploadedAt).getTime() <= endOfDay);
    }

    return list;
  }, [unifiedLedgers, searchTerm, filterSourceType, startDate, endDate]);

  // Group ledgers by day for the Daily Browser
  const ledgersByDay = useMemo(() => {
    const groups: { [date: string]: UnifiedLedger[] } = {};
    filteredLedgers.forEach(l => {
      const date = new Date(l.uploadedAt).toLocaleDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(l);
    });
    return Object.entries(groups).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
  }, [filteredLedgers]);

  // Selection for Daily View rollup
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  
  // Rolling up data for selected day or selected ledgers
  const rollupLedgers = useMemo(() => {
    if (subTab === "daily" && selectedDay) {
      return filteredLedgers.filter(l => new Date(l.uploadedAt).toLocaleDateString() === selectedDay);
    }
    if (selectedLedgerIds.length > 0) {
      return unifiedLedgers.filter(l => selectedLedgerIds.includes(l.filename));
    }
    return [];
  }, [filteredLedgers, unifiedLedgers, subTab, selectedDay, selectedLedgerIds]);

  // Handle Auto-Sync side effects
  useEffect(() => {
    const { db } = getFirebaseInstances();
    if (!db || !autoSync || unifiedLedgers.length === 0) return;

    // Find first local-only ledger that isn't being actively synced, and push it
    const firstLocal = unifiedLedgers.find(l => l.source === "local");
    if (firstLocal) {
      syncToCloud(firstLocal);
    }
  }, [unifiedLedgers, autoSync]);

  // Load ledger details for full interactive charts replay
  const analyzeLedger = async (ledger: UnifiedLedger) => {
    try {
      setSyncStatus(`Loading ${ledger.filename}...`);
      let csvContent = ledger.csvData;

      if (!csvContent) {
        const res = await fetch(`/api/v1/ledgers/${encodeURIComponent(ledger.filename)}`);
        if (!res.ok) throw new Error("Failed to load local file content.");
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Failed to load local file content.");
        csvContent = data.csvData;
      }

      if (!csvContent) throw new Error("File content is empty.");

      setCsvText(csvContent);
      setFileName(ledger.filename);
      setUploadError(null);
      setSubTab("explorer");
      setSyncStatus(null);
    } catch (err: any) {
      console.error("Load error:", err);
      alert(`Failed to load file for analysis: ${err.message}`);
      setSyncStatus(null);
    }
  };

  // Open Viewer
  const openViewer = async (ledger: UnifiedLedger) => {
    try {
      setSyncStatus(`Opening ${ledger.filename}...`);
      let csvContent = ledger.csvData;

      if (!csvContent) {
        const res = await fetch(`/api/v1/ledgers/${encodeURIComponent(ledger.filename)}`);
        if (!res.ok) throw new Error("Failed to load file content.");
        const data = await res.json();
        csvContent = data.csvData;
      }

      setViewingLedger(ledger);
      setViewerCsvData(csvContent || "");
      setIsEditingViewer(false);
      setIsViewerOpen(true);
      setSyncStatus(null);
    } catch (err: any) {
      alert(`Error opening viewer: ${err.message}`);
      setSyncStatus(null);
    }
  };

  // Handle CSV Download
  const handleDownload = (ledger: UnifiedLedger, customContent?: string) => {
    const content = customContent || ledger.csvData;
    if (!content) {
      alert("No data available to download.");
      return;
    }
    const blob = new Blob([content], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = ledger.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Save Edits
  const handleSaveEdit = async () => {
    if (!viewingLedger) return;

    try {
      setViewerStatus("Validating and Saving...");
      const res = await fetch(`/api/v1/ledgers/${encodeURIComponent(viewingLedger.filename)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvData: viewerCsvData })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update ledger.");

      setViewerStatus("Saved Successfully!");
      setIsEditingViewer(false);
      
      // Update local cache if possible or just refresh
      await fetchLocalLedgers();
      
      setTimeout(() => setViewerStatus(null), 3000);
    } catch (err: any) {
      setViewerStatus(`Error: ${err.message}`);
      setTimeout(() => setViewerStatus(null), 5000);
    }
  };

  // Bulk Actions
  const toggleSelectLedger = (filename: string) => {
    setSelectedLedgerIds(prev => 
      prev.includes(filename) ? prev.filter(id => id !== filename) : [...prev, filename]
    );
  };

  const selectAllFiltered = () => {
    if (selectedLedgerIds.length === filteredLedgers.length) {
      setSelectedLedgerIds([]);
    } else {
      setSelectedLedgerIds(filteredLedgers.map(l => l.filename));
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedLedgerIds.length} selected ledgers permanently?`)) return;

    try {
      setSyncStatus(`Bulk deleting ${selectedLedgerIds.length} files...`);
      for (const filename of selectedLedgerIds) {
        const ledger = unifiedLedgers.find(l => l.filename === filename);
        if (ledger) await deleteLedger(ledger);
      }
      setSelectedLedgerIds([]);
      setSyncStatus("Bulk delete completed.");
      setTimeout(() => setSyncStatus(null), 3000);
    } catch (err: any) {
      alert(`Bulk delete error: ${err.message}`);
      setSyncStatus(null);
    }
  };

  const handleBulkDownload = () => {
    if (selectedLedgerIds.length === 0) return;
    
    // For simplicity, we'll concatenate if they are few, or alert. 
    // In a real app, you'd use jszip.
    alert("In a production environment, this would trigger a ZIP download of all selected files. For this demo, please download individually.");
  };

  // Safe ledger removal
  const deleteLedger = async (ledger: UnifiedLedger) => {
    if (!confirm(`Are you sure you want to delete ${ledger.filename}?`)) {
      return;
    }

    try {
      setSyncStatus(`Deleting ${ledger.filename}...`);

      if (ledger.source === "local" || ledger.source === "synced") {
        const res = await fetch(`/api/v1/ledgers/${encodeURIComponent(ledger.filename)}`, {
          method: "DELETE"
        });
        if (!res.ok) throw new Error("Failed to delete local file from Express hub.");
        await fetchLocalLedgers();
      }

      if (ledger.source === "cloud" || ledger.source === "synced") {
        const { db } = getFirebaseInstances();
        if (db) {
          const safeDocId = ledger.filename.replace(/[.#$/[\]]/g, "_");
          await deleteDoc(doc(db, "ledgers", safeDocId));
        }
      }

      setSyncStatus(`Deleted successfully.`);
      setTimeout(() => setSyncStatus(null), 2000);
    } catch (err: any) {
      console.error("Delete error:", err);
      alert(`Delete failed: ${err.message}`);
      setSyncStatus(null);
    }
  };
  
  // Interactive Explorer State
  const [selectedSnapshotIndex, setSelectedSnapshotIndex] = useState<number>(0);
  const [selectedDistLane, setSelectedDistLane] = useState<string>("ALL");

  // Parse current CSV text
  const parsedData = useMemo<ParsedTrafficData>(() => {
    if (!csvText) {
      return {
        sessionStart: "—",
        snapshots: [],
        finalSummary: null,
        allVehicleTypes: []
      };
    }
    try {
      const data = parseTrafficCSV(csvText);
      return data;
    } catch (err: any) {
      console.error(err);
      return {
        sessionStart: "—",
        snapshots: [],
        finalSummary: null,
        allVehicleTypes: []
      };
    }
  }, [csvText]);

  // Handle parsing errors
  useEffect(() => {
    if (csvText) {
      try {
        parseTrafficCSV(csvText);
        setUploadError(null);
      } catch (err: any) {
        setUploadError("Failed to parse CSV. Please check that the file format matches the standard STAP output.");
      }
    }
  }, [csvText]);

  // Adjust selected index if snapshots count changes
  React.useEffect(() => {
    if (parsedData.snapshots.length > 0) {
      setSelectedSnapshotIndex(Math.min(selectedSnapshotIndex, parsedData.snapshots.length - 1));
    }
  }, [parsedData.snapshots]);

  // Handle file drop / select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (!file.name.endsWith(".csv") && !file.name.endsWith(".txt")) {
      setUploadError("Please upload a valid CSV or TXT text file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setCsvText(text);
        setFileName(file.name);
      }
    };
    reader.onerror = () => {
      setUploadError("Error reading file.");
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleResetToDefault = () => {
    setCsvText(SAMPLE_TRAFFIC_CSV);
    setFileName("default_ledger_log.csv");
    setUploadError(null);
  };

  // Aggregated data for selected day or multiple ledgers
  const aggregatedData = useMemo(() => {
    if (rollupLedgers.length === 0) return null;

    const parsedRollups = rollupLedgers.map(l => {
      if (!l.csvData) return null;
      try {
        return parseTrafficCSV(l.csvData);
      } catch (e) {
        return null;
      }
    }).filter(Boolean) as ParsedTrafficData[];

    if (parsedRollups.length === 0) return null;

    // Aggregate snapshots for trend charts
    // We sort them by timestamp to ensure a continuous timeline
    const allSnapshots = parsedRollups.flatMap(p => p.snapshots).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Aggregate final summaries for distribution
    const vehicleCounts: { [type: string]: number } = {};
    let grandTotal = 0;

    parsedRollups.forEach(p => {
      if (p.finalSummary?.corridorTotals) {
        Object.entries(p.finalSummary.corridorTotals.vehicles).forEach(([type, count]) => {
          vehicleCounts[type] = (vehicleCounts[type] || 0) + (count as number);
        });
        grandTotal += p.finalSummary.corridorTotals.grandUniqueCount;
      } else if (p.snapshots.length > 0) {
        const last = p.snapshots[p.snapshots.length - 1];
        last.lanes.forEach(l => {
          Object.entries(l.vehicles).forEach(([type, count]) => {
            vehicleCounts[type] = (vehicleCounts[type] || 0) + (count as number);
          });
        });
        grandTotal += last.intersectionSum;
      }
    });

    const distribution = Object.entries(vehicleCounts).map(([name, value]) => ({
      rawName: name,
      displayName: formatVehicleType(name),
      value
    })).sort((a, b) => b.value - a.value);

    // Peak congestion logic across all aggregated ledgers
    let maxDensity = 0;
    let maxLane = "—";
    let maxTime = "—";

    allSnapshots.forEach(snap => {
      snap.lanes.forEach(l => {
        if (l.densityOccupancy > maxDensity) {
          maxDensity = l.densityOccupancy;
          maxLane = l.lane;
          maxTime = snap.timestamp;
        }
      });
    });

    // Volume curve binned by hour
    const hourlyVolume: { [hour: string]: number } = {};
    allSnapshots.forEach(snap => {
      const date = new Date(snap.timestamp);
      const hour = `${date.getHours().toString().padStart(2, '0')}:00`;
      // For hourly, we take the delta if it's the same session, 
      // but across multiple sessions, it's safer to use snap increment if available.
      // Since our CSV is cumulative in a session, we'll try to get the max per hour per session.
    });

    return {
      snapshots: allSnapshots,
      distribution,
      grandTotal,
      peak: { lane: maxLane, density: maxDensity, time: maxTime }
    };
  }, [rollupLedgers]);

  // Extract metadata and summary calculations
  const totalVehiclesProcessed = subTab === "daily" ? (aggregatedData?.grandTotal || 0) : (parsedData.finalSummary?.corridorTotals?.grandUniqueCount || 
    (parsedData.snapshots.length > 0 ? parsedData.snapshots[parsedData.snapshots.length - 1].intersectionSum : 0));

  const sessionEndClock = parsedData.finalSummary?.timestamp || 
    (parsedData.snapshots.length > 0 ? parsedData.snapshots[parsedData.snapshots.length - 1].timestamp : "—");

  // Format progression data for line charts
  const volumeProgressionData = useMemo(() => {
    const snapshots = (subTab === "daily" || selectedLedgerIds.length > 0) 
      ? (aggregatedData?.snapshots || []) 
      : parsedData.snapshots;

    return snapshots.map((snap) => {
      const shortTime = snap.timestamp.includes(" ") ? snap.timestamp.split(" ")[1] : snap.timestamp;
      const row: any = {
        time: shortTime,
        timestamp: snap.timestamp,
        "Total Count": snap.intersectionSum
      };
      snap.lanes.forEach((l) => {
        row[l.lane] = l.cumulativeTotal;
      });
      return row;
    });
  }, [parsedData.snapshots, aggregatedData, subTab, selectedLedgerIds]);

  const densityProgressionData = useMemo(() => {
    const snapshots = (subTab === "daily" || selectedLedgerIds.length > 0) 
      ? (aggregatedData?.snapshots || []) 
      : parsedData.snapshots;

    return snapshots.map((snap) => {
      const shortTime = snap.timestamp.includes(" ") ? snap.timestamp.split(" ")[1] : snap.timestamp;
      const row: any = {
        time: shortTime,
        timestamp: snap.timestamp
      };
      snap.lanes.forEach((l) => {
        row[l.lane] = l.densityOccupancy;
      });
      return row;
    });
  }, [parsedData.snapshots, aggregatedData, subTab, selectedLedgerIds]);

  // Aggregate total vehicle distribution
  const vehicleDistributionData = useMemo(() => {
    if ((subTab === "daily" || selectedLedgerIds.length > 0) && selectedDistLane === "ALL") {
      return aggregatedData?.distribution || [];
    }

    const counts: { [type: string]: number } = {};
    
    if (selectedDistLane === "ALL") {
      // Use Final Summary corridor totals or sum from final snapshot
      if (parsedData.finalSummary?.corridorTotals) {
        Object.entries(parsedData.finalSummary.corridorTotals.vehicles).forEach(([type, countVal]) => {
          counts[type] = countVal as number;
        });
      } else if (parsedData.snapshots.length > 0) {
        const lastSnap = parsedData.snapshots[parsedData.snapshots.length - 1];
        lastSnap.lanes.forEach((l) => {
          Object.entries(l.vehicles).forEach(([type, countVal]) => {
            counts[type] = (counts[type] || 0) + (countVal as number);
          });
        });
      }
    } else {
      // Specific lane
      if (parsedData.finalSummary) {
        const laneData = parsedData.finalSummary.lanes.find((l) => l.lane === selectedDistLane);
        if (laneData) {
          Object.entries(laneData.vehicles).forEach(([type, countVal]) => {
            counts[type] = countVal as number;
          });
        }
      } else if (parsedData.snapshots.length > 0) {
        const lastSnap = parsedData.snapshots[parsedData.snapshots.length - 1];
        const laneData = lastSnap.lanes.find((l) => l.lane === selectedDistLane);
        if (laneData) {
          Object.entries(laneData.vehicles).forEach(([type, countVal]) => {
            counts[type] = countVal as number;
          });
        }
      }
    }

    return Object.entries(counts)
      .map(([name, value]) => ({
        rawName: name,
        displayName: formatVehicleType(name),
        value
      }))
      .sort((a, b) => b.value - a.value);
  }, [parsedData, selectedDistLane]);

  // Find most common vehicle type
  const topVehicleType = useMemo(() => {
    if (vehicleDistributionData.length > 0) {
      return vehicleDistributionData[0];
    }
    return { displayName: "—", value: 0 };
  }, [vehicleDistributionData]);

  // Find peak congestion lane & snapshot
  const peakCongestion = useMemo(() => {
    let maxDensity = 0;
    let maxLane = "—";
    let maxTime = "—";

    if (parsedData.snapshots.length > 0) {
      parsedData.snapshots.forEach((snap) => {
        snap.lanes.forEach((l) => {
          if (l.densityOccupancy > maxDensity) {
            maxDensity = l.densityOccupancy;
            maxLane = l.lane;
            maxTime = snap.timestamp.includes(" ") ? snap.timestamp.split(" ")[1] : snap.timestamp;
          }
        });
      });
    } else if (parsedData.finalSummary) {
      parsedData.finalSummary.lanes.forEach((l) => {
        if (l.finalDensity > maxDensity) {
          maxDensity = l.finalDensity;
          maxLane = l.lane;
          maxTime = "Final Snapshot";
        }
      });
    }

    return { lane: maxLane, density: maxDensity, time: maxTime };
  }, [parsedData]);

  // Set default tab to distribution if no snapshots
  useEffect(() => {
    if (parsedData.snapshots.length === 0 && parsedData.finalSummary) {
      setActiveChartTab("dist");
    }
  }, [parsedData.snapshots.length, parsedData.finalSummary]);

  // Current interactive snapshot details
  const currentSnapshot: Snapshot | undefined = parsedData.snapshots[selectedSnapshotIndex];

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
      
      {/* Dynamic Sync Status Notice Banner */}
      {syncStatus && (
        <div className="bg-[#4E6290] text-white px-4 py-3 rounded-xl flex items-center justify-between text-xs font-bold shadow-md animate-pulse">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-teal-400 rounded-full animate-ping" />
            <span>{syncStatus}</span>
          </div>
          <button onClick={() => setSyncStatus(null)} className="text-white/70 hover:text-white text-[10px] uppercase">
            Dismiss
          </button>
        </div>
      )}

      {/* Sub-tab Navigation Panel */}
      <div className="flex border-b border-slate-200/80">
        <button
          onClick={() => setSubTab("explorer")}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            subTab === "explorer"
              ? "border-[#4E6290] text-[#4E6290]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Sliders className="h-4 w-4" />
            <span>Charts & Interactive Explorer</span>
          </div>
        </button>
        <button
          onClick={() => setSubTab("hub")}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            subTab === "hub"
              ? "border-[#4E6290] text-[#4E6290]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Database className="h-4 w-4" />
            <span>STAP Node Ledgers</span>
          </div>
        </button>
        <button
          onClick={() => {
            setSubTab("daily");
            if (ledgersByDay.length > 0 && !selectedDay) {
              setSelectedDay(ledgersByDay[0][0]);
            }
          }}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            subTab === "daily"
              ? "border-[#4E6290] text-[#4E6290]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            <span>Daily View Rollup</span>
          </div>
        </button>
        <button
          onClick={() => setSubTab("reports")}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            subTab === "reports"
              ? "border-[#4E6290] text-[#4E6290]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            <span>Reports Center</span>
          </div>
        </button>
      </div>

      {subTab === "hub" ? (
        /* STAP NODE HUB LEDGERS SUB-TAB PANEL */
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 md:p-6 shadow-xs">
            <div className="flex flex-col lg:flex-row gap-6 items-stretch lg:items-center justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-[#4E6290]/10 rounded-lg text-[#4E6290]">
                    <Database className="h-5 w-5" />
                  </span>
                  <h2 className="text-base font-black text-slate-800 tracking-tight uppercase animate-fadeIn">STAP Hub Ledger Storage</h2>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Manages traffic matrix CSV ledger files compiled automatically by your edge nodes upon intersection shutdown sequence. Integrates with Vercel uploads and Firebase Firestore cloud sync.
                </p>
              </div>

              {/* Quick statistics widgets */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:w-96 shrink-0">
                {/* Auto Sync Toggle */}
                <div className="flex items-center justify-between bg-slate-50 border border-slate-200/60 p-3 rounded-xl">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Auto-Sync to Cloud</span>
                    <span className="text-xs font-bold text-slate-700">Firestore mirroring</span>
                  </div>
                  <button
                    onClick={() => setAutoSync(!autoSync)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      autoSync ? "bg-[#4E6290]" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                        autoSync ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Firestore connection badge */}
                <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200/60 p-3 rounded-xl">
                  <div className="p-1.5 bg-[#4E6290]/5 rounded-lg text-[#4E6290]">
                    {getFirebaseConfig().connected ? <Cloud className="h-4 w-4 text-emerald-600" /> : <CloudOff className="h-4 w-4 text-slate-400" />}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block">CLOUD DATABASE</span>
                    <span className="text-xs font-bold text-slate-700 truncate block max-w-[100px]">
                      {getFirebaseConfig().connected ? getFirebaseConfig().projectId : "Disconnected"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Ledgers List Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Compiled Master Ledgers</h3>
                <p className="text-xs text-slate-500">List of all exported absolute density sheets logged across nodes.</p>
              </div>
              
              <div className="flex flex-col md:flex-row items-center gap-3">
                {/* Advanced Filters */}
                <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-1 px-2">
                    <Filter className="h-3 w-3 text-slate-400" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Filters</span>
                  </div>
                  <select 
                    value={filterSourceType}
                    onChange={(e) => setFilterSourceType(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg text-[10px] font-bold py-1 px-2 outline-none"
                  >
                    <option value="ALL">All Sources</option>
                    <option value="python_controller">Python Controller</option>
                    <option value="user_uploaded">User Uploaded</option>
                  </select>
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg text-[10px] font-bold py-1 px-2 outline-none"
                    placeholder="Start Date"
                  />
                  <span className="text-[10px] text-slate-300">—</span>
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg text-[10px] font-bold py-1 px-2 outline-none"
                    placeholder="End Date"
                  />
                  {(filterSourceType !== "ALL" || startDate || endDate) && (
                    <button 
                      onClick={() => {
                        setFilterSourceType("ALL");
                        setStartDate("");
                        setEndDate("");
                      }}
                      className="p-1 hover:bg-slate-100 text-slate-400 rounded-md"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search filename..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-[#4E6290]/20 focus:border-[#4E6290] transition-all w-full md:w-48"
                  />
                </div>
                
                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#4E6290] hover:bg-[#3D4F75] text-white text-xs font-black uppercase rounded-xl shadow-sm transition-all"
                >
                  <UploadCloud className="h-4 w-4" />
                  <span>Upload Ledger</span>
                </button>

                <button
                  onClick={fetchLocalLedgers}
                  className="flex items-center gap-1 text-[11px] font-bold text-[#4E6290] hover:text-[#3D4F75] bg-[#4E6290]/5 hover:bg-[#4E6290]/10 px-2.5 py-2 rounded-lg transition-all"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              </div>
            </div>

            {/* Bulk Action Bar */}
            {selectedLedgerIds.length > 0 && (
              <div className="bg-[#4E6290] text-white px-5 py-2.5 flex items-center justify-between animate-slideIn">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black uppercase tracking-wider">{selectedLedgerIds.length} Files Selected</span>
                  <div className="h-4 w-px bg-white/20" />
                  <button 
                    onClick={handleBulkDownload}
                    className="flex items-center gap-1.5 text-[10px] font-bold hover:bg-white/10 px-2 py-1 rounded-md transition-all"
                  >
                    <Download className="h-3 w-3" />
                    <span>Download Selection</span>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleBulkDelete}
                    className="flex items-center gap-1.5 text-[10px] font-bold bg-rose-500 hover:bg-rose-600 px-3 py-1 rounded-md transition-all"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Delete Permanently</span>
                  </button>
                  <button 
                    onClick={() => setSelectedLedgerIds([])}
                    className="p-1 hover:bg-white/10 rounded-md transition-all"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {filteredLedgers.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs space-y-3">
                <FileSpreadsheet className="h-10 w-10 text-slate-300 mx-auto animate-pulse" />
                <div className="space-y-1">
                  <p className="font-extrabold text-slate-700 text-sm">
                    {searchTerm ? "No results matching your search" : "No Ledger Files Uploaded Yet"}
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto font-medium">
                    {searchTerm 
                      ? "Try adjusting your filters or search terms." 
                      : "Shut down your local Python controller process to trigger its automatic compiled ledger export."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200/80 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      <th className="px-5 py-3 w-10">
                        <input 
                          type="checkbox" 
                          checked={selectedLedgerIds.length > 0 && selectedLedgerIds.length === filteredLedgers.length}
                          onChange={selectAllFiltered}
                          className="rounded border-slate-300 text-[#4E6290] focus:ring-[#4E6290]"
                        />
                      </th>
                      <th className="px-5 py-3">File Name</th>
                      <th className="px-5 py-3">Source</th>
                      <th className="px-5 py-3">Size (KB)</th>
                      <th className="px-5 py-3">Export/Upload Date</th>
                      <th className="px-5 py-3">Storage Context</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {filteredLedgers.map((ledger) => {
                      const sizeInKb = (ledger.size / 1024).toFixed(2);
                      const formattedDate = new Date(ledger.uploadedAt).toLocaleString();
                      const isSelected = selectedLedgerIds.includes(ledger.filename);

                      return (
                        <tr key={ledger.filename} className={`transition-colors ${isSelected ? "bg-[#4E6290]/5" : "hover:bg-slate-50/50"}`}>
                          <td className="px-5 py-3.5">
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={() => toggleSelectLedger(ledger.filename)}
                              className="rounded border-slate-300 text-[#4E6290] focus:ring-[#4E6290]"
                            />
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
                                <FileSpreadsheet className="h-4 w-4" />
                              </span>
                              <div className="space-y-0.5">
                                <span className="font-bold text-slate-800 text-xs block max-w-xs md:max-w-md lg:max-w-xl truncate" title={ledger.filename}>
                                  {ledger.filename}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  Type: Absolute Traffic Matrix
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${
                              ledger.sourceType === "user_uploaded" 
                                ? "bg-amber-100 text-amber-700 border border-amber-200" 
                                : "bg-blue-100 text-blue-700 border border-blue-200"
                            }`}>
                              {ledger.sourceType === "user_uploaded" ? "User" : "System"}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 font-mono text-slate-600 text-[11px]">
                            {sizeInKb} KB
                          </td>
                          <td className="px-5 py-3.5 text-slate-500">
                            {formattedDate}
                          </td>
                          <td className="px-5 py-3.5">
                            {ledger.source === "synced" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-[10px] font-bold">
                                <Cloud className="h-3 w-3 text-emerald-600" />
                                <span>Synced to Cloud</span>
                              </span>
                            ) : ledger.source === "cloud" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-sky-50 text-sky-800 border border-sky-200 rounded-full text-[10px] font-bold">
                                <Cloud className="h-3 w-3 text-sky-600" />
                                <span>Cloud Database Only</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-[10px] font-bold">
                                <CloudOff className="h-3 w-3 text-amber-600 animate-pulse" />
                                <span>Local Hub Only</span>
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => openViewer(ledger)}
                                className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-all"
                                title="View/Edit file content"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              
                              <button
                                onClick={() => handleDownload(ledger)}
                                className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-[#4E6290] rounded-lg transition-all"
                                title="Download CSV"
                              >
                                <Download className="h-4 w-4" />
                              </button>

                              <button
                                onClick={() => analyzeLedger(ledger)}
                                className="p-1.5 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-all"
                                title="Analyze in charts"
                              >
                                <ArrowUpRight className="h-4 w-4" />
                              </button>

                              <div className="h-4 w-px bg-slate-100 mx-0.5" />

                              <button
                                onClick={() => deleteLedger(ledger)}
                                className="p-1.5 hover:bg-rose-50 text-slate-300 hover:text-rose-600 rounded-lg transition-all"
                                title="Delete permanently"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : subTab === "reports" ? (
        /* REPORTS CENTER PANEL */
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 md:p-6 shadow-xs flex flex-col lg:flex-row gap-6 items-center justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-[#4E6290]/10 rounded-lg text-[#4E6290]">
                  <FileText className="h-5 w-5" />
                </span>
                <h2 className="text-base font-black text-slate-800 tracking-tight uppercase">STAP Intelligence Reports</h2>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Generate and download official traffic summaries, vehicle breakdowns, and certified traffic logs for physical archiving or submission.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* 1. Daily Traffic Summary */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 flex flex-col">
              <div className="h-10 w-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                <BarChart2 className="h-6 w-6" />
              </div>
              <div className="space-y-1 flex-1">
                <h3 className="text-sm font-black text-slate-800 uppercase">Daily Traffic Summary</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                  A high-level overview of traffic volume, average density, and throughput for a specific 24-hour period.
                </p>
              </div>
              <button 
                onClick={() => handleGenerateAdminReport("Daily Traffic Summary")}
                disabled={generatingReport || ledgersByDay.length === 0}
                className="w-full py-2.5 bg-[#4E6290] hover:bg-[#3D4F75] text-white font-black text-[10px] uppercase rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {generatingReport ? "Generating..." : <><Share className="h-3.5 w-3.5" /> <span>Generate & Share</span></>}
              </button>
            </div>

            {/* 2. Vehicle Type Breakdown */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 flex flex-col">
              <div className="h-10 w-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                <Car className="h-6 w-6" />
              </div>
              <div className="space-y-1 flex-1">
                <h3 className="text-sm font-black text-slate-800 uppercase">Vehicle Type Analysis</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                  Detailed distribution of vehicle classifications (cars, trucks, cycles) across all recorded sessions in the selection.
                </p>
              </div>
              <button 
                onClick={() => handleGenerateAdminReport("Vehicle Type Breakdown")}
                disabled={generatingReport || unifiedLedgers.length === 0}
                className="w-full py-2.5 bg-[#4E6290] hover:bg-[#3D4F75] text-white font-black text-[10px] uppercase rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {generatingReport ? "Generating..." : <><Share className="h-3.5 w-3.5" /> <span>Generate & Share</span></>}
              </button>
            </div>

            {/* 3. Date-Range Comparison */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 flex flex-col">
              <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div className="space-y-1 flex-1">
                <h3 className="text-sm font-black text-slate-800 uppercase">Range Comparison</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                  Compare traffic metrics between two distinct date ranges to identify growth or changes in flow patterns.
                </p>
              </div>
              <button 
                onClick={() => handleGenerateAdminReport("Date-Range Comparison")}
                disabled={generatingReport || unifiedLedgers.length === 0}
                className="w-full py-2.5 bg-[#4E6290] hover:bg-[#3D4F75] text-white font-black text-[10px] uppercase rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {generatingReport ? "Generating..." : <><Share className="h-3.5 w-3.5" /> <span>Generate & Share</span></>}
              </button>
            </div>

            {/* 4. Incident Reports Summary */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 flex flex-col">
              <div className="h-10 w-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div className="space-y-1 flex-1">
                <h3 className="text-sm font-black text-slate-800 uppercase">Incident Summary</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                  Summary of all detected traffic incidents, violations, and safety alerts recorded by the hub.
                </p>
              </div>
              <button 
                onClick={() => handleGenerateAdminReport("Incident Reports Summary")}
                disabled={generatingReport}
                className="w-full py-2.5 bg-[#4E6290] hover:bg-[#3D4F75] text-white font-black text-[10px] uppercase rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {generatingReport ? "Generating..." : <><Share className="h-3.5 w-3.5" /> <span>Generate & Share</span></>}
              </button>
            </div>

            {/* 5. Certified Traffic Log */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 flex flex-col border-l-4 border-l-rose-500">
              <div className="h-10 w-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-slate-800 uppercase">Certified Traffic Log</h3>
                  <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 text-[8px] font-black uppercase rounded-md">Official</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                  Official stamped document including officer certification metadata. Required for legal evidence or formal records.
                </p>
              </div>
              <button 
                onClick={() => handleGenerateAdminReport("Certified Traffic Log")}
                disabled={generatingReport || unifiedLedgers.length === 0}
                className="w-full py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-black text-[10px] uppercase rounded-xl shadow-sm shadow-rose-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {generatingReport ? "Generating..." : <><CheckCircle2 className="h-3.5 w-3.5" /> <span>Generate & Share</span></>}
              </button>
            </div>
          </div>

          {/* Pending Certification Requests Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden mt-6">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <span className="font-black text-xs text-slate-800 uppercase tracking-wider">Public Certification Requests</span>
              </div>
              <span className="text-[10px] font-bold text-slate-400">Requires Manual Review</span>
            </div>
            
            {/* Report Requests List */}
            <ReportRequestsList />
          </div>
        </div>
      ) : subTab === "daily" ? (
        /* DAILY ROLLUP VIEW PANEL */
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 md:p-6 shadow-xs">
            <div className="flex flex-col lg:flex-row gap-6 items-center justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-[#4E6290]/10 rounded-lg text-[#4E6290]">
                    <Calendar className="h-5 w-5" />
                  </span>
                  <h2 className="text-base font-black text-slate-800 tracking-tight uppercase">Daily Rollup Analytics</h2>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Aggregated statistics across all recorded sessions for a specific day. Useful for understanding total daily volume and peak congestion hours.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="bg-slate-50 border border-slate-200 p-2 rounded-xl flex items-center gap-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase pl-1">Select Day</span>
                  <select 
                    value={selectedDay || ""}
                    onChange={(e) => setSelectedDay(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg text-xs font-bold py-1.5 px-3 outline-none min-w-[140px]"
                  >
                    {ledgersByDay.map(([date]) => (
                      <option key={date} value={date}>{date}</option>
                    ))}
                    {ledgersByDay.length === 0 && <option value="">No data available</option>}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {!aggregatedData ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-slate-400 text-xs">
              <Calendar className="h-10 w-10 text-slate-200 mx-auto mb-3" />
              <p className="font-bold text-slate-600">No aggregated data for this selection</p>
              <p className="mt-1">Make sure the selected day has ledgers synced to the cloud.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Vehicles</span>
                    <TrendingUp className="h-4 w-4 text-[#4E6290]" />
                  </div>
                  <div className="text-2xl font-black text-slate-800 tracking-tight">{aggregatedData.grandTotal.toLocaleString()}</div>
                  <div className="text-[10px] text-slate-500 font-medium">Sum of all sessions</div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Peak Density</span>
                    <Activity className="h-4 w-4 text-rose-500" />
                  </div>
                  <div className="text-2xl font-black text-slate-800 tracking-tight">{aggregatedData.peak.density.toFixed(1)}%</div>
                  <div className="text-[10px] text-slate-500 font-medium">{aggregatedData.peak.lane} at {new Date(aggregatedData.peak.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Sessions</span>
                    <Database className="h-4 w-4 text-indigo-500" />
                  </div>
                  <div className="text-2xl font-black text-slate-800 tracking-tight">{rollupLedgers.length}</div>
                  <div className="text-[10px] text-slate-500 font-medium">Exported ledger files</div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Top Class</span>
                    <Car className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="text-2xl font-black text-slate-800 tracking-tight">{aggregatedData.distribution[0]?.displayName || "—"}</div>
                  <div className="text-[10px] text-slate-500 font-medium">Most frequent vehicle</div>
                </div>
              </div>

              {/* Charts for aggregated data */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <BarChart2 className="h-4 w-4 text-[#4E6290]" />
                    Daily Vehicle Distribution
                  </h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={aggregatedData.distribution}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="displayName" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fontSize: 10, fontWeight: 600, fill: '#64748b'}}
                          dy={10}
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fontSize: 10, fontWeight: 600, fill: '#64748b'}}
                        />
                        <Tooltip 
                          cursor={{fill: '#f8fafc'}}
                          contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px'}}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {aggregatedData.distribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index === 0 ? "#4E6290" : "#94a3b8"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-[#4E6290]" />
                    Total Volume Trend (Sessions)
                  </h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={aggregatedData.snapshots.filter((_, i) => i % Math.max(1, Math.floor(aggregatedData.snapshots.length / 20)) === 0)}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="timestamp" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fontSize: 9, fontWeight: 500, fill: '#94a3b8'}}
                          tickFormatter={(ts) => new Date(ts).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fontSize: 10, fontWeight: 600, fill: '#64748b'}}
                        />
                        <Tooltip 
                          contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px'}}
                          labelFormatter={(ts) => new Date(ts).toLocaleString()}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="intersectionSum" 
                          stroke="#4E6290" 
                          strokeWidth={3} 
                          dot={false}
                          activeDot={{ r: 6, strokeWidth: 0 }}
                          name="Total Vehicles"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Sessions Breakdown Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-5 border-b border-slate-100 font-black text-xs text-slate-800 uppercase tracking-wider">
                  Session Ledger Breakdown for {selectedDay}
                </div>
                <table className="w-full text-left text-[11px] font-medium text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[9px] font-black uppercase text-slate-400">
                    <tr>
                      <th className="px-5 py-3">Filename</th>
                      <th className="px-5 py-3">Time</th>
                      <th className="px-5 py-3">Source</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {rollupLedgers.map((l) => (
                      <tr key={l.filename} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3 font-bold text-slate-800">{l.filename}</td>
                        <td className="px-5 py-3">{new Date(l.uploadedAt).toLocaleTimeString()}</td>
                        <td className="px-5 py-3 uppercase text-[9px] font-black tracking-wider text-slate-400">{l.sourceType}</td>
                        <td className="px-5 py-3 text-right">
                          <button 
                            onClick={() => analyzeLedger(l)}
                            className="text-[#4E6290] font-black uppercase text-[9px] hover:underline"
                          >
                            Explore
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* STANDARD CHARTS AND REPLAY TAB */
        <>
          {/* 1. TOP HEADER & LOG UPLOADER */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 md:p-6 shadow-xs flex flex-col lg:flex-row gap-6 items-center justify-between">
        <div className="space-y-1.5 w-full lg:max-w-md">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-[#4E6290]/10 rounded-lg text-[#4E6290]">
              <Activity className="h-5 w-5" />
            </span>
            <h2 className="text-lg font-black text-slate-800 tracking-tight">STAP Intelligent Analytics</h2>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Upload the real-time CSV ledger outputted directly by the Python YOLO controller to analyze intersection metrics, compare approaches, and visualize vehicle congestion.
          </p>
          {fileName && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-teal-50 text-teal-800 border border-teal-200/60 rounded-full text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
              Active: {fileName}
            </div>
          )}
        </div>

        {/* DRAG AND DROP ZONE */}
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto items-stretch">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex-1 lg:w-80 border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
              isDragging
                ? "border-indigo-500 bg-indigo-50/50 scale-[0.99]"
                : "border-slate-300 hover:border-[#4E6290]/70 bg-slate-50/50 hover:bg-slate-50"
            }`}
          >
            <input
              type="file"
              accept=".csv,.txt"
              className="hidden"
              id="analytics-csv-upload"
              onChange={handleFileChange}
            />
            <label htmlFor="analytics-csv-upload" className="cursor-pointer flex flex-col items-center justify-center">
              <UploadCloud className="h-7 w-7 text-slate-400 mb-1" />
              <span className="text-xs font-bold text-slate-700">Drag & Drop output file</span>
              <span className="text-[10px] text-slate-400 mt-0.5">or click to browse local PC (.csv, .txt)</span>
            </label>
          </div>

          <button
            onClick={handleResetToDefault}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all shadow-xs shrink-0 cursor-pointer active:scale-95"
            title="Load sample demo ledger"
          >
            <RefreshCw className="h-4 w-4 text-slate-500" />
            <span>Load Demo Log</span>
          </button>
        </div>
      </div>

      {uploadError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-start gap-2.5 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Parsing Error:</span> {uploadError}
          </div>
        </div>
      )}

      {parsedData.snapshots.length === 0 && !parsedData.finalSummary ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 md:p-12 text-center max-w-2xl mx-auto my-8 space-y-6 shadow-xs">
          <div className="mx-auto w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-[#4E6290]">
            <UploadCloud className="h-8 w-8 animate-bounce text-[#4E6290]" />
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-black text-slate-800 tracking-tight">No Active Traffic Log Loaded</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Upload the CSV/TXT log file generated on your PC by your local Python YOLO controller to visualize real-time congestion and lane performance metrics.
            </p>
          </div>
          <div className="border border-dashed border-slate-200 rounded-xl p-4 bg-slate-50/50 text-left space-y-2.5 max-w-md mx-auto">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Log File Import Steps:</span>
            <div className="flex gap-2.5 items-start text-xs text-slate-600">
              <span className="flex items-center justify-center w-5 h-5 bg-[#4E6290]/10 text-[#4E6290] font-extrabold rounded-full text-[10px] shrink-0 mt-0.5">1</span>
              <p>Run your Python YOLO traffic detection software on your local PC.</p>
            </div>
            <div className="flex gap-2.5 items-start text-xs text-slate-600">
              <span className="flex items-center justify-center w-5 h-5 bg-[#4E6290]/10 text-[#4E6290] font-extrabold rounded-full text-[10px] shrink-0 mt-0.5">2</span>
              <p>The controller writes live interval snapshots directly to a log file on your PC.</p>
            </div>
            <div className="flex gap-2.5 items-start text-xs text-slate-600">
              <span className="flex items-center justify-center w-5 h-5 bg-[#4E6290]/10 text-[#4E6290] font-extrabold rounded-full text-[10px] shrink-0 mt-0.5">3</span>
              <p>Drag & drop or browse that file above to load full analytical charts and 2D replay visualizations.</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <button
              onClick={handleResetToDefault}
              className="px-5 py-2.5 bg-[#4E6290] hover:bg-[#3D4F75] text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
            >
              Load Sample Demo Ledger
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 2. SUMMARY METRIC CARDS (Bento Grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Unique Vehicles */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">CORRIDOR UNIQUE TOTAL</span>
            <div className="text-2xl font-black text-slate-800 tracking-tight">
              {totalVehiclesProcessed.toLocaleString()}
            </div>
            <div className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
              <span>★ Total intersection unique count</span>
            </div>
          </div>
          <div className="p-3.5 bg-indigo-50 rounded-xl text-indigo-600">
            <Car className="h-6 w-6" />
          </div>
        </div>

        {/* Active Session duration */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">SESSION TIMEFRAME</span>
            <div className="text-sm font-black text-slate-800 tracking-tight leading-none pt-1">
              Start: {parsedData.sessionStart.split(" ")[1] || parsedData.sessionStart}
            </div>
            <div className="text-sm font-black text-slate-800 tracking-tight leading-none pt-1">
              End: {sessionEndClock.split(" ")[1] || sessionEndClock}
            </div>
            <div className="text-[10px] text-slate-400 font-bold mt-1">
              Date: {parsedData.sessionStart.split(" ")[0]}
            </div>
          </div>
          <div className="p-3.5 bg-amber-50 rounded-xl text-amber-600 flex flex-col gap-1 items-center justify-center">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        {/* Peak Congestion Approach */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">PEAK APPROACH DENSITY</span>
            <div className="text-2xl font-black text-[#E11D48] tracking-tight">
              {peakCongestion.density.toFixed(1)}%
            </div>
            <div className="text-[10px] text-slate-500 font-bold">
              Lane: <span className="text-slate-800 font-extrabold">{peakCongestion.lane}</span> approach at {peakCongestion.time}
            </div>
          </div>
          <div className="p-3.5 bg-rose-50 rounded-xl text-rose-600">
            <TrendingUp className="h-6 w-6" />
          </div>
        </div>

        {/* Most Frequent Class */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">PRIMARY VEHICLE TYPE</span>
            <div className="text-lg font-black text-slate-800 tracking-tight truncate max-w-[170px]" title={topVehicleType.displayName}>
              {topVehicleType.displayName}
            </div>
            <div className="text-xs text-slate-500 font-bold">
              Count: <span className="text-[#4E6290] font-extrabold">{topVehicleType.value.toLocaleString()}</span> units
            </div>
          </div>
          <div className="p-3.5 bg-teal-50 rounded-xl text-teal-600">
            <BarChart2 className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* 3. MULTI-CHART GRAPH PANEL */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        
        {/* Tabs selectors */}
        <div className="bg-slate-50 border-b border-slate-200/80 px-5 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex gap-1 bg-slate-200/60 p-1 rounded-xl">
            <button
              onClick={() => setActiveChartTab("vol")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeChartTab === "vol"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Volume Growth
            </button>
            <button
              onClick={() => setActiveChartTab("dens")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeChartTab === "dens"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Approach Density %
            </button>
            <button
              onClick={() => setActiveChartTab("dist")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeChartTab === "dist"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Vehicle Classification
            </button>
          </div>

          {/* Conditional Dropdown for Classification tab */}
          {activeChartTab === "dist" && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase">Lane Focus:</span>
              <select
                value={selectedDistLane}
                onChange={(e) => setSelectedDistLane(e.target.value)}
                className="bg-white border border-slate-200 text-slate-700 font-bold text-xs px-2.5 py-1.5 rounded-lg shadow-2xs outline-none focus:ring-1 focus:ring-[#4E6290]"
              >
                <option value="ALL">All Intersection</option>
                <option value="NORTH">North Approach</option>
                <option value="SOUTH">South Approach</option>
                <option value="EAST">East Approach</option>
                <option value="WEST">West Approach</option>
              </select>
            </div>
          )}
        </div>

        {/* Chart Content Area */}
        <div className="p-5 md:p-6 h-[340px]">
          {(activeChartTab === "vol" || activeChartTab === "dens") && parsedData.snapshots.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 text-xs bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <TrendingUp className="h-8 w-8 text-slate-300 mb-2" />
              <span className="font-bold">Progression Data Unavailable</span>
              <span className="max-w-[200px] mt-1 text-[10px]">This log appears to be a summary report only. Switch to 'Vehicle Classification' to view absolute counts.</span>
            </div>
          ) : volumeProgressionData.length === 0 && vehicleDistributionData.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 text-xs">
              <Info className="h-8 w-8 text-slate-300 mb-2" />
              <span>No data points found to graph.</span>
            </div>
          ) : activeChartTab === "vol" ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={volumeProgressionData} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#64748b", fontWeight: "600" }} />
                <YAxis tick={{ fontSize: 10, fill: "#64748b", fontWeight: "600" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)"
                  }}
                  labelClassName="text-xs font-extrabold text-slate-700"
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, fontWeight: "600" }} />
                <Line type="monotone" dataKey="Total Count" name="Combined Sum" stroke="#0F172A" strokeWidth={3} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="NORTH" stroke="#3B82F6" strokeWidth={2} />
                <Line type="monotone" dataKey="SOUTH" stroke="#10B981" strokeWidth={2} />
                <Line type="monotone" dataKey="EAST" stroke="#F59E0B" strokeWidth={2} />
                <Line type="monotone" dataKey="WEST" stroke="#EC4899" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : activeChartTab === "dens" ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={densityProgressionData} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#64748b", fontWeight: "600" }} />
                <YAxis unit="%" tick={{ fontSize: 10, fill: "#64748b", fontWeight: "600" }} domain={[0, 100]} />
                <Tooltip
                  formatter={(val: any) => [`${val}%`, "Density"]}
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)"
                  }}
                  labelClassName="text-xs font-extrabold text-slate-700"
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, fontWeight: "600" }} />
                <Line type="monotone" dataKey="NORTH" stroke="#3B82F6" strokeWidth={2} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="SOUTH" stroke="#10B981" strokeWidth={2} />
                <Line type="monotone" dataKey="EAST" stroke="#F59E0B" strokeWidth={2} />
                <Line type="monotone" dataKey="WEST" stroke="#EC4899" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vehicleDistributionData} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="displayName" tick={{ fontSize: 9, fill: "#64748b", fontWeight: "600" }} />
                <YAxis tick={{ fontSize: 10, fill: "#64748b", fontWeight: "600" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)"
                  }}
                  labelClassName="text-xs font-extrabold text-slate-700"
                />
                <Bar dataKey="value" name="Count" radius={[6, 6, 0, 0]}>
                  {vehicleDistributionData.map((entry, idx) => {
                    // Assign colors based on index or vehicle class
                    const colors = [
                      "#4E6290", "#3B82F6", "#10B981", "#F59E0B", 
                      "#EC4899", "#8B5CF6", "#06B6D4", "#14B8A6",
                      "#6366F1", "#A855F7", "#F43F5E", "#10B981"
                    ];
                    return <Cell key={`cell-${idx}`} fill={colors[idx % colors.length]} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 4. INTERACTIVE INTERVAL EXPLORER & 2D INTERSECTION SIMULATOR */}
      {currentSnapshot && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* SLIDER TIMELINE PANEL (Left cols) */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 p-5 md:p-6 shadow-xs flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-1.5">
                <span className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
                  <Sliders className="h-4.5 w-4.5" />
                </span>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Interval Explorer</h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Drag the slider to select a specific timestamp and see the lane approaches snapshot at that exact time.
              </p>

              {/* Slider Input */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-xs font-bold text-slate-600">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Snapshot #{selectedSnapshotIndex + 1}</span>
                  <span className="flex items-center gap-1 text-indigo-600"><Clock className="h-3 w-3" /> {currentSnapshot.timestamp}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={parsedData.snapshots.length - 1}
                  value={selectedSnapshotIndex}
                  onChange={(e) => setSelectedSnapshotIndex(parseInt(e.target.value))}
                  className="w-full accent-indigo-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-extrabold">
                  <span>START</span>
                  <span>MIDPOINT</span>
                  <span>END OF LOG</span>
                </div>
              </div>

              {/* Interactive Snapshot stats */}
              <div className="border-t border-slate-100 pt-4 space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-semibold">Intersection Total Cumulative:</span>
                  <span className="text-slate-800 font-extrabold text-sm">{currentSnapshot.intersectionSum} units</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {currentSnapshot.lanes.map((l) => (
                    <div key={l.lane} className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 flex flex-col">
                      <span className="text-[9px] text-slate-400 font-black uppercase">{l.lane} Approach</span>
                      <span className="text-sm font-black text-slate-700 mt-0.5">{l.cumulativeTotal} <span className="text-[10px] text-slate-400 font-normal">units</span></span>
                      <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden mt-1.5">
                        <div
                          className="bg-[#4E6290] h-full rounded-full"
                          style={{ width: `${l.densityOccupancy}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-slate-500 font-bold mt-1 text-right">{l.densityOccupancy.toFixed(1)}% density</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="text-[10px] text-slate-400 mt-4 font-bold bg-slate-50 p-2.5 rounded-lg border border-dashed border-slate-200">
              💡 Use this to replay how traffic built up during the recorded session. Ideal for checking localized peak times!
            </div>
          </div>

          {/* 2D INTERSECTION VISUAL MAP (Right cols) */}
          <div className="lg:col-span-7 bg-[#1E293B] rounded-2xl p-6 shadow-md flex flex-col justify-between relative overflow-hidden min-h-[380px]">
            {/* Visual Header */}
            <div className="flex justify-between items-center z-10">
              <div className="space-y-0.5">
                <div className="text-[9px] text-indigo-400 font-black uppercase tracking-widest">STAP 2D JUNCTION OCCUPANCY REPLAY</div>
                <div className="text-xs text-white font-extrabold flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-rose-500" />
                  <span>Real-time Density Occupancy Map • {currentSnapshot.timestamp.split(" ")[1] || currentSnapshot.timestamp}</span>
                </div>
              </div>
              <div className="bg-[#0F172A] border border-slate-800 rounded-lg px-2.5 py-1 text-[10px] text-emerald-400 font-mono">
                SUM: {currentSnapshot.intersectionSum}
              </div>
            </div>

            {/* Custom 2D CSS Intersection Layout */}
            <div className="relative w-full h-48 md:h-56 mt-4 flex items-center justify-center">
              
              {/* Intersection Center Hub */}
              <div className="absolute w-12 h-12 bg-slate-800 border-2 border-dashed border-slate-700 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-[#10B981] animate-ping" />
              </div>

              {/* Approach Roads */}
              {/* NORTH Approach */}
              {(() => {
                const lane = currentSnapshot.lanes.find((l) => l.lane === "NORTH");
                return (
                  <div className="absolute top-0 bottom-[50%] w-10 border-l border-r border-slate-700/80 bg-slate-900 flex flex-col items-center justify-end pb-3">
                    <span className="text-[8px] text-slate-500 font-black">N</span>
                    <div className="w-1.5 h-16 bg-slate-800 rounded-full flex items-end overflow-hidden mt-1 border border-slate-800">
                      <div
                        className="bg-sky-500 w-full rounded-full"
                        style={{ height: `${lane ? lane.densityOccupancy : 0}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-white font-bold mt-1 leading-none">{lane ? lane.cumulativeTotal : 0}</span>
                  </div>
                );
              })()}

              {/* SOUTH Approach */}
              {(() => {
                const lane = currentSnapshot.lanes.find((l) => l.lane === "SOUTH");
                return (
                  <div className="absolute bottom-0 top-[50%] w-10 border-l border-r border-slate-700/80 bg-slate-900 flex flex-col items-center justify-start pt-3">
                    <span className="text-[10px] text-white font-bold mb-1 leading-none">{lane ? lane.cumulativeTotal : 0}</span>
                    <div className="w-1.5 h-16 bg-slate-800 rounded-full flex items-start overflow-hidden border border-slate-800">
                      <div
                        className="bg-emerald-500 w-full rounded-full"
                        style={{ height: `${lane ? lane.densityOccupancy : 0}%` }}
                      />
                    </div>
                    <span className="text-[8px] text-slate-500 font-black mt-1">S</span>
                  </div>
                );
              })()}

              {/* EAST Approach */}
              {(() => {
                const lane = currentSnapshot.lanes.find((l) => l.lane === "EAST");
                return (
                  <div className="absolute right-0 left-[50%] h-10 border-t border-b border-slate-700/80 bg-slate-900 flex items-center justify-start pl-3 gap-1">
                    <span className="text-[8px] text-slate-500 font-black leading-none">E</span>
                    <div className="h-1.5 w-16 bg-slate-800 rounded-full flex items-center justify-start overflow-hidden border border-slate-800">
                      <div
                        className="bg-amber-500 h-full rounded-full"
                        style={{ width: `${lane ? lane.densityOccupancy : 0}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-white font-bold leading-none">{lane ? lane.cumulativeTotal : 0}</span>
                  </div>
                );
              })()}

              {/* WEST Approach */}
              {(() => {
                const lane = currentSnapshot.lanes.find((l) => l.lane === "WEST");
                return (
                  <div className="absolute left-0 right-[50%] h-10 border-t border-b border-slate-700/80 bg-slate-900 flex items-center justify-end pr-3 gap-1">
                    <span className="text-[10px] text-white font-bold leading-none">{lane ? lane.cumulativeTotal : 0}</span>
                    <div className="h-1.5 w-16 bg-slate-800 rounded-full flex items-center justify-end overflow-hidden border border-slate-800">
                      <div
                        className="bg-pink-500 h-full rounded-full"
                        style={{ width: `${lane ? lane.densityOccupancy : 0}%` }}
                      />
                    </div>
                    <span className="text-[8px] text-slate-500 font-black leading-none">W</span>
                  </div>
                );
              })()}
            </div>

            {/* Visual Footer labels */}
            <div className="border-t border-slate-800 pt-3 flex justify-between items-center text-[10px] text-slate-400 font-mono mt-2 z-10">
              <div className="flex gap-4">
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-sky-500 rounded-full" /> N approach</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> S approach</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-amber-500 rounded-full" /> E approach</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-pink-500 rounded-full" /> W approach</span>
              </div>
              <span className="text-slate-500 text-[9px]">Heights/Widths represent density occupancy %</span>
            </div>
          </div>
        </div>
      )}

      {/* 5. RAW LEDGER SPREADSHEET TABLE VIEW */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Ledger Interval Logs</h3>
            <p className="text-xs text-slate-500">Full structured matrix of parsed snapshots from the ledger CSV.</p>
          </div>
        </div>

        {/* Scrollable Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200/80 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <th className="px-5 py-3">Timestamp / Interval</th>
                <th className="px-5 py-3">Approach</th>
                <th className="px-5 py-3">Vehicle Breakdown Details (Cumulative Totals)</th>
                <th className="px-5 py-3 text-right">Cumulative Total</th>
                <th className="px-5 py-3 text-right">Road Occupancy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {parsedData.snapshots.map((snap) => (
                <React.Fragment key={snap.timestamp}>
                  {/* First Lane Approach row with Timestamp */}
                  {snap.lanes.map((l, lIdx) => {
                    const vehiclesStr = Object.entries(l.vehicles)
                      .filter(([_, count]) => (count as number) > 0)
                      .map(([type, count]) => `${formatVehicleType(type)}: ${count}`)
                      .join(" • ");

                    return (
                      <tr key={`${snap.timestamp}-${l.lane}`} className="hover:bg-slate-50">
                        {lIdx === 0 ? (
                          <td className="px-5 py-3 font-extrabold text-slate-800 border-r border-slate-100/60" rowSpan={4}>
                            <div className="flex flex-col">
                              <span>{snap.timestamp.split(" ")[1] || snap.timestamp}</span>
                              <span className="text-[10px] text-slate-400 font-normal mt-0.5">{snap.timestamp.split(" ")[0]}</span>
                              <span className="text-[9px] bg-slate-100 text-slate-600 rounded px-1.5 py-0.5 mt-2 font-mono w-max">
                                Sum: {snap.intersectionSum}
                              </span>
                            </div>
                          </td>
                        ) : null}
                        <td className="px-5 py-3">
                          <span className="font-extrabold text-slate-700">{l.lane}</span>
                        </td>
                        <td className="px-5 py-3 text-slate-500 text-[11px] max-w-sm md:max-w-md lg:max-w-xl truncate" title={vehiclesStr}>
                          {vehiclesStr || "No vehicles recorded"}
                        </td>
                        <td className="px-5 py-3 text-right font-bold text-slate-700 font-mono">
                          {l.cumulativeTotal}
                        </td>
                        <td className="px-5 py-3 text-right font-mono">
                          <div className="flex items-center justify-end gap-2">
                            <span>{l.densityOccupancy.toFixed(1)}%</span>
                            <div className="w-12 bg-slate-100 h-1.5 rounded-full overflow-hidden shrink-0">
                              <div
                                className="bg-[#4E6290] h-full"
                                style={{ width: `${l.densityOccupancy}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}
    </>
  )}

  {/* 4. MODAL: LEDGER DATA VIEWER / EDITOR */}
      {isViewerOpen && viewingLedger && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-8">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fadeIn" 
            onClick={() => {
              if (isEditingViewer && !confirm("Unsaved changes will be lost. Close anyway?")) return;
              setIsViewerOpen(false);
            }}
          />
          <div className="relative w-full max-w-5xl max-h-[90vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-scaleIn">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#4E6290] text-white rounded-xl shadow-sm">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight truncate max-w-md">
                    {viewingLedger.filename}
                  </h3>
                  <p className="text-[10px] text-slate-500 font-bold">
                    {(viewingLedger.size / 1024).toFixed(2)} KB • Uploaded {new Date(viewingLedger.uploadedAt).toLocaleString()}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(viewingLedger, viewerCsvData)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-lg transition-all"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download</span>
                </button>
                <button
                  onClick={() => setIsViewerOpen(false)}
                  className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-all"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Toolbar */}
            <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex gap-1.5">
                <button 
                  onClick={() => setIsEditingViewer(false)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                    !isEditingViewer ? "bg-[#4E6290] text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  Table View
                </button>
                <button 
                  onClick={() => setIsEditingViewer(true)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                    isEditingViewer ? "bg-[#4E6290] text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  Raw CSV Editor
                </button>
              </div>

              {isEditingViewer ? (
                <div className="flex items-center gap-3">
                  {viewerStatus && (
                    <span className="text-[10px] font-bold text-teal-600 animate-pulse">{viewerStatus}</span>
                  )}
                  <button
                    onClick={handleSaveEdit}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-black text-[10px] uppercase rounded-lg shadow-sm transition-all"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>Save Changes</span>
                  </button>
                </div>
              ) : (
                <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5" />
                  <span>Interactive spreadsheet view powered by STAP Hub</span>
                </div>
              )}
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-auto p-0 bg-slate-50/30">
              {isEditingViewer ? (
                <textarea
                  value={viewerCsvData}
                  onChange={(e) => setViewerCsvData(e.target.value)}
                  className="w-full h-full min-h-[400px] p-6 font-mono text-xs text-slate-700 bg-white outline-none resize-none"
                  spellCheck={false}
                />
              ) : (
                <div className="p-6">
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                          {viewerCsvData.split("\n")[0]?.split(",").map((header, i) => (
                            <th key={i} className="px-4 py-3 text-left border-r border-slate-200 last:border-0">{header.trim()}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {viewerCsvData.split("\n").slice(1).filter(l => l.trim()).map((line, rowIdx) => (
                          <tr key={rowIdx} className="hover:bg-slate-50/50">
                            {line.split(",").map((cell, cellIdx) => (
                              <td key={cellIdx} className="px-4 py-2.5 border-r border-slate-100 last:border-0 text-slate-600 font-medium">
                                {cell.trim()}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {viewerCsvData.split("\n").length <= 1 && (
                    <div className="text-center py-12 text-slate-400 italic">No valid rows found in CSV.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL: MANUAL LEDGER UPLOAD */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fadeIn" 
            onClick={() => !isUploadingManual && setIsUploadModalOpen(false)}
          />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-scaleIn">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Manual Ledger Upload</h3>
              <button onClick={() => setIsUploadModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {!uploadingFile ? (
                <div 
                  className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center space-y-3 hover:border-[#4E6290] hover:bg-slate-50/50 transition-all cursor-pointer group"
                  onClick={() => document.getElementById('manual-file-input')?.click()}
                >
                  <div className="mx-auto w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 group-hover:text-[#4E6290] group-hover:scale-110 transition-all">
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-700">Click to select CSV ledger</p>
                    <p className="text-[10px] text-slate-400">Must follow STAP output format (.csv, .txt)</p>
                  </div>
                  <input 
                    id="manual-file-input"
                    type="file" 
                    className="hidden" 
                    accept=".csv,.txt"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setUploadingFile(file);
                    }}
                  />
                </div>
              ) : (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#4E6290] text-white rounded-lg">
                      <FileSpreadsheet className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black text-slate-800 truncate">{uploadingFile.name}</p>
                      <p className="text-[10px] text-slate-500 font-bold">{(uploadingFile.size / 1024).toFixed(2)} KB • Ready to upload</p>
                    </div>
                    <button 
                      onClick={() => setUploadingFile(null)}
                      className="text-slate-400 hover:text-rose-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="text-[10px] bg-amber-50 text-amber-700 p-2 rounded-lg border border-amber-100 flex gap-2">
                    <Info className="h-3.5 w-3.5 shrink-0" />
                    <span>This file will be marked as <b>User Uploaded</b> in the master ledger list.</span>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setIsUploadModalOpen(false)}
                  disabled={isUploadingManual}
                  className="flex-1 px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleManualUpload}
                  disabled={!uploadingFile || isUploadingManual}
                  className={`flex-1 px-4 py-2 text-xs font-black uppercase rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 ${
                    !uploadingFile || isUploadingManual 
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed" 
                      : "bg-[#4E6290] hover:bg-[#3D4F75] text-white"
                  }`}
                >
                  {isUploadingManual ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Confirm Upload</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 6. MODAL: SHARE REPORT */}
      {showShareModal && currentReport && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fadeIn" 
            onClick={() => !isSendingEmail && !isSavingToDrive && setShowShareModal(false)}
          />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-scaleIn border border-slate-200">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#4E6290] text-white rounded-xl shadow-lg shadow-[#4E6290]/20">
                  <Share className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Share Official Report</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{currentReport.type}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowShareModal(false)} 
                className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* File Preview Card */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex items-center gap-4">
                <div className="h-12 w-12 bg-white rounded-xl border border-slate-200 flex items-center justify-center text-rose-500 shadow-sm">
                  <FileText className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-slate-800 truncate">{currentReport.filename}</p>
                  <p className="text-[10px] text-slate-400 font-bold">Official PDF Document • Ref: {currentReport.doc.internal.pageSize.getWidth()}pt</p>
                </div>
                <button 
                  onClick={() => currentReport.doc.save(currentReport.filename)}
                  className="p-2 text-[#4E6290] hover:bg-[#4E6290]/10 rounded-xl transition-all"
                  title="Download Copy"
                >
                  <Download className="h-5 w-5" />
                </button>
              </div>

              {/* Action Tabs: Gmail vs Drive */}
              <div className="space-y-4">
                <div className="flex flex-col gap-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Delivery Options</span>
                  
                  {/* Save to Drive Action */}
                  <button
                    onClick={handleSaveToDrive}
                    disabled={isSavingToDrive}
                    className="w-full flex items-center gap-3 p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl transition-all group relative overflow-hidden active:scale-[0.98]"
                  >
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all">
                      <HardDrive className="h-5 w-5" />
                    </div>
                    <div className="text-left flex-1">
                      <p className="text-xs font-black text-slate-800">Save to Google Drive</p>
                      <p className="text-[10px] text-slate-400 font-medium">Upload to official STAP Reports archive</p>
                    </div>
                    {isSavingToDrive && <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />}
                  </button>

                  {/* Send via Email Section */}
                  <div className="p-4 bg-slate-50/50 border border-slate-200 rounded-2xl space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                        <Mail className="h-5 w-5" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-black text-slate-800">Send via Gmail</p>
                        <p className="text-[10px] text-slate-400 font-medium">Deliver as secure attachment</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <input 
                        type="email"
                        placeholder="Recipient Email Address"
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#4E6290]/20 focus:border-[#4E6290] transition-all"
                      />
                      <textarea 
                        placeholder="Add a message (optional)..."
                        value={emailNote}
                        onChange={(e) => setEmailNote(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#4E6290]/20 focus:border-[#4E6290] transition-all h-20 resize-none"
                      />
                      <button
                        onClick={handleSendEmail}
                        disabled={isSendingEmail || !recipientEmail}
                        className="w-full py-3 bg-[#4E6290] hover:bg-[#3D4F75] text-white font-black text-xs uppercase rounded-xl shadow-lg shadow-[#4E6290]/20 transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                      >
                        {isSendingEmail ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        <span>{isSendingEmail ? "Sending..." : "Send Now"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {shareSuccess && (
                <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl border border-emerald-100 text-[11px] font-bold flex items-center gap-2 animate-fadeIn">
                  <Check className="h-4 w-4" />
                  {shareSuccess}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
