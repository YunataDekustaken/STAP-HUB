import React, { useState } from "react";
import { ShieldCheck, FileText, Scale, Lock, Eye, ChevronRight } from "lucide-react";

export default function LegalTab() {
  const [activeSection, setActiveSection] = useState<"PRIVACY" | "TERMS">("PRIVACY");

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12" id="legal-tab-view">
      {/* Header */}
      <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-blue-400" />
              <h1 className="text-2xl font-black tracking-tight">Legal & Compliance Center</h1>
            </div>
            <p className="text-slate-400 text-sm max-w-lg font-medium leading-relaxed">
              Official documentation for the STAP Traffic Automation Program. 
              Required for regulatory compliance and platform verification.
            </p>
          </div>
          <div className="flex bg-slate-800 p-1 rounded-xl gap-1 border border-slate-700 w-full md:w-auto">
            <button
              onClick={() => setActiveSection("PRIVACY")}
              className={`flex-1 md:flex-initial px-6 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                activeSection === "PRIVACY" ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Lock className="h-3.5 w-3.5" />
              Privacy Policy
            </button>
            <button
              onClick={() => setActiveSection("TERMS")}
              className={`flex-1 md:flex-initial px-6 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                activeSection === "TERMS" ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Scale className="h-3.5 w-3.5" />
              Terms of Service
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {activeSection === "PRIVACY" ? (
          <div className="p-8 md:p-12 space-y-8 animate-fade-in">
            <section className="space-y-4">
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Eye className="h-5 w-5 text-blue-500" />
                Privacy Policy
              </h2>
              <p className="text-slate-500 text-xs font-medium uppercase tracking-widest">Effective Date: June 29, 2026</p>
              <div className="prose prose-slate max-w-none space-y-4 text-slate-600 text-sm leading-relaxed">
                <p>
                  At STAP (Smart Traffic Automation Program), we prioritize the security and privacy of our users and the citizens captured by our smart infrastructure. This Privacy Policy outlines how we handle data collected through our CCTV network and administrative tools.
                </p>
                
                <h3 className="text-slate-900 font-bold text-base pt-2">1. Data Collection</h3>
                <p>
                  We collect information necessary for the operation of the traffic system, including:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Account Information:</strong> Name, email, and roles for STAP administrators.</li>
                  <li><strong>Footage Metadata:</strong> Timestamps, camera IDs, and incident descriptions provided in requests.</li>
                  <li><strong>Visual Data:</strong> CCTV footage captured by our smart poles, processed primarily for traffic analysis and incident verification.</li>
                </ul>

                <h3 className="text-slate-900 font-bold text-base pt-2">2. Usage of Google Workspace Data</h3>
                <p>
                  Our application integrates with Google Workspace (Gmail and Drive) to facilitate footage sharing. We only access the minimum scopes required to send notification emails and manage CCTV archives on behalf of the authorized administrator.
                </p>

                <h3 className="text-slate-900 font-bold text-base pt-2">3. Data Retention</h3>
                <p>
                  CCTV footage is retained on active disk arrays for a period of 30 days before being automatically rotated out, unless flagged for an active investigation or certified report request.
                </p>
              </div>
            </section>
          </div>
        ) : (
          <div className="p-8 md:p-12 space-y-8 animate-fade-in">
            <section className="space-y-4">
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Scale className="h-5 w-5 text-blue-500" />
                Terms of Service
              </h2>
              <p className="text-slate-500 text-xs font-medium uppercase tracking-widest">Last Updated: June 29, 2026</p>
              <div className="prose prose-slate max-w-none space-y-4 text-slate-600 text-sm leading-relaxed">
                <p>
                  By accessing the STAP Hub platform, you agree to comply with the following terms governing the use of our traffic automation and CCTV archival systems.
                </p>

                <h3 className="text-slate-900 font-bold text-base pt-2">1. Authorized Use</h3>
                <p>
                  Access to the administrative dashboard is strictly limited to authorized personnel. Sharing of credentials or unauthorized extraction of CCTV data is a violation of the STAP Security Protocol.
                </p>

                <h3 className="text-slate-900 font-bold text-base pt-2">2. Footage Request Protocol</h3>
                <p>
                  All footage requests must be for legitimate academic, legal, or investigative purposes. STAP reserves the right to reject any request that does not meet privacy requirements or lacks proper documentation (e.g., Subpoena or Official Request Letter).
                </p>

                <h3 className="text-slate-900 font-bold text-base pt-2">3. Liability</h3>
                <p>
                  STAP provides traffic monitoring services "as-is". While we strive for 100% uptime of our disk arrays and cameras, we are not liable for data loss due to hardware failure or connectivity issues at the physical node level.
                </p>
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Verification Badge */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center border border-blue-100 shadow-sm">
            <ShieldCheck className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-800">Compliance Verified</p>
            <p className="text-[10px] text-slate-500 font-medium">This application adheres to Google API User Data Policy.</p>
          </div>
        </div>
        <div className="hidden md:block">
          <span className="px-3 py-1 bg-white border border-blue-200 text-blue-700 text-[10px] font-bold rounded-lg shadow-xs">
            Official STAP Document v17.2
          </span>
        </div>
      </div>
    </div>
  );
}
