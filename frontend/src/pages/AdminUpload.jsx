import { useState, useEffect } from "react";
import { UploadCloud, CheckCircle, AlertTriangle, DownloadCloud, Sparkles, FileSpreadsheet, Globe } from "lucide-react";
import { apiFetch } from "../api";

export default function AdminUpload() {
  // Direct NICE Fetch State
  const [fetchCode, setFetchCode] = useState("");
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchStatus, setFetchStatus] = useState(null);

  // File Upload State
  const [niceId, setNiceId] = useState("");
  const [name, setName] = useState("");
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleFetchFromNice = async (e) => {
    e.preventDefault();
    if (!fetchCode.trim()) return;
    setFetchLoading(true);
    setFetchStatus(null);
    try {
      const res = await apiFetch("/admin/guidelines/fetch", {
        method: "POST",
        body: JSON.stringify({ code: fetchCode.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setFetchStatus({
          type: "success",
          message: data.message || `Successfully imported ${data.name} (${data.nice_id}) with ${data.recommendation_count} recommendations.`,
        });
        setFetchCode("");
      } else {
        setFetchStatus({
          type: "error",
          message: data.detail || "Failed to fetch guideline from NICE.",
        });
      }
    } catch (err) {
      setFetchStatus({ type: "error", message: "Server connection failed." });
    }
    setFetchLoading(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setStatus({ type: "error", message: "Please select an Excel (.xlsx) or CSV file." });
      return;
    }

    const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
    if (!isExcel && (!niceId || !name)) {
      setStatus({ type: "error", message: "Guideline Reference and Name are required for CSV uploads." });
      return;
    }
    
    setLoading(true);
    setStatus(null);
    
    const formData = new FormData();
    if (niceId) formData.append("nice_id", niceId);
    if (name) formData.append("name", name);
    formData.append("file", file);

    try {
      const res = await apiFetch("/admin/guidelines/upload", {
        method: "POST",
        body: formData,
      });
      
      const data = await res.json();
      if (res.ok) {
        setStatus({ type: "success", message: data.message });
        setNiceId("");
        setName("");
        setFile(null);
        e.target.reset();
      } else {
        setStatus({ type: "error", message: data.detail || "Upload failed." });
      }
    } catch (err) {
      setStatus({ type: "error", message: "Server connection failed." });
    }
    setLoading(false);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto h-full overflow-y-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Admin: Guidance Management</h1>
        <p className="text-gray-500">
          Auto-fetch official guidelines directly from NICE without manual searching, or upload raw NICE Baseline Assessment spreadsheets (.xlsx).
        </p>
      </div>

      {/* SECTION 1: AUTO-FETCH FROM NICE */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50/40 border border-blue-200 rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-600 text-white rounded-md shadow-sm">
            <Globe size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">One-Click Auto-Fetch from NICE</h2>
              <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-blue-200">
                Recommended
              </span>
            </div>
            <p className="text-xs text-gray-600">
              Enter any NICE guideline code (e.g. <code>NG253</code>, <code>NG28</code>, <code>NG136</code>, <code>NG89</code>). The assistant will automatically fetch official baseline tools or guidance chapters directly from nice.org.uk.
            </p>
          </div>
        </div>

        <form onSubmit={handleFetchFromNice} className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="e.g. NG253 or CG161"
                value={fetchCode}
                onChange={(e) => setFetchCode(e.target.value.toUpperCase())}
                className="w-full border border-gray-300 rounded p-3 text-sm font-semibold tracking-wide uppercase bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={fetchLoading || !fetchCode.trim()}
              className="bg-blue-600 text-white px-6 py-3 rounded font-bold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm flex items-center gap-2 whitespace-nowrap"
            >
              <DownloadCloud size={18} />
              {fetchLoading ? "Fetching from NICE..." : "Fetch Guidance"}
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Quick references:</span>
            {["NG253", "NG28", "NG136", "NG143", "NG250", "NG89", "NG249"].map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setFetchCode(code)}
                className="text-blue-600 hover:underline font-medium hover:text-blue-800"
              >
                {code}
              </button>
            ))}
          </div>

          {fetchStatus && (
            <div className={`p-4 rounded text-sm font-medium flex items-center gap-2 border ${
              fetchStatus.type === 'success' 
                ? 'bg-green-50 text-green-800 border-green-200' 
                : 'bg-red-50 text-red-800 border-red-200'
            }`}>
              {fetchStatus.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
              {fetchStatus.message}
            </div>
          )}
        </form>
      </div>

      {/* SECTION 2: UPLOAD RAW EXCEL OR CSV */}
      <div className="bg-white border rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-emerald-600 text-white rounded-md shadow-sm">
            <FileSpreadsheet size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Upload Spreadsheet or CSV</h2>
            <p className="text-xs text-gray-500">
              Upload raw, unmodified NICE Baseline Assessment Tool Excel files (<code>.xlsx</code>) or standard CSVs.
            </p>
          </div>
        </div>

        <form onSubmit={handleUpload} className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Guideline Reference <span className="text-gray-400 font-normal">(optional for Excel)</span>
              </label>
              <input 
                type="text" 
                placeholder="e.g., NG253" 
                value={niceId}
                onChange={e => setNiceId(e.target.value)}
                className="w-full border rounded p-2.5 text-sm focus:ring-blue-500 focus:border-blue-500" 
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Guideline Name <span className="text-gray-400 font-normal">(optional for Excel)</span>
              </label>
              <input 
                type="text" 
                placeholder="e.g., Suspected sepsis in over 16s" 
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full border rounded p-2.5 text-sm focus:ring-blue-500 focus:border-blue-500" 
              />
            </div>
          </div>

          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300 hover:bg-gray-50'
            }`}
          >
            <UploadCloud className={`mx-auto h-10 w-10 mb-3 ${isDragging ? 'text-emerald-500' : 'text-gray-400'}`} />
            <div className="text-sm text-gray-600 mb-2">
              <label className="cursor-pointer font-bold text-emerald-600 hover:text-emerald-800">
                <span>Click to browse</span>
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => setFile(e.target.files[0])} />
              </label>
              {" "}or drag and drop your file here.
            </div>
            <p className="text-xs text-gray-500">
              Supports unmodified NICE Baseline Assessment Tool spreadsheets (.xlsx) or CSV files. Automatically extracts recommendation numbers, text, and publication year.
            </p>
            {file && (
              <div className="mt-4 inline-block bg-emerald-50 text-emerald-800 px-4 py-2 rounded font-medium text-sm border border-emerald-200">
                Selected: {file.name}
              </div>
            )}
          </div>

          <div className="flex justify-between items-center">
            {status ? (
              <div className={`flex items-center gap-2 text-sm font-medium ${status.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {status.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                {status.message}
              </div>
            ) : <div />}
            
            <button 
              type="submit" 
              disabled={loading}
              className="bg-emerald-600 text-white px-6 py-2.5 rounded font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              {loading ? "Processing File..." : "Upload & Ingest"}
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 3: GENERATE ONE-CLICK ACCESS LINKS */}
      <MagicLinkGenerator />
    </div>
  );
}

function MagicLinkGenerator() {
  const [users, setUsers] = useState([]);
  const [guidelines, setGuidelines] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedGuideline, setSelectedGuideline] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiFetch("/auth/users")
      .then(res => res.json())
      .then(data => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setUsers([]));

    apiFetch("/guidelines")
      .then(res => res.json())
      .then(data => setGuidelines(Array.isArray(data) ? data : []))
      .catch(() => setGuidelines([]));
  }, []);

  const handleGenerate = async () => {
    if (!selectedUser || !selectedGuideline) return;

    const res = await apiFetch("/auth/magic-link/generate", {
      method: "POST",
      body: JSON.stringify({
        target_user_id: parseInt(selectedUser),
        guideline_id: parseInt(selectedGuideline)
      })
    });
    const data = await res.json();
    setGeneratedLink(data.link);
    setCopied(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white border-2 border-nhs-pale shadow-sm p-8 max-w-4xl mt-10">
      <div className="border-b-2 border-nhs-pale pb-4 mb-6">
        <h2 className="text-2xl font-bold text-nhs-dark">Generate Auto-Login Link</h2>
        <p className="text-gray-500 font-medium">Create a secure, one-click link for a reviewer to bypass login and start assessing immediately.</p>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-sm font-bold text-nhs-dark mb-2">Select Reviewer</label>
          <select 
            value={selectedUser} 
            onChange={e => setSelectedUser(e.target.value)}
            className="w-full border-2 border-gray-300 p-3 bg-white font-medium"
          >
            <option value="">-- Choose User --</option>
            {(users || []).map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-bold text-nhs-dark mb-2">Target Guideline</label>
          <select 
            value={selectedGuideline} 
            onChange={e => setSelectedGuideline(e.target.value)}
            className="w-full border-2 border-gray-300 p-3 bg-white font-medium"
          >
            <option value="">-- Choose Guideline --</option>
            {(guidelines || []).map(g => (
              <option key={g.id} value={g.id}>{g.nice_id}: {g.name}</option>
            ))}
          </select>
        </div>
      </div>

      <button 
        onClick={handleGenerate}
        disabled={!selectedUser || !selectedGuideline}
        className="btn-nhs-secondary font-bold"
      >
        Generate Secure Link
      </button>

      {generatedLink && (
        <div className="mt-6 bg-nhs-pale p-4 border-l-4 border-nhs-blue flex flex-col gap-2 animate-in fade-in">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Single-Use Link (Valid for 48 Hours)</span>
          <div className="flex gap-2">
            <input 
              type="text" 
              readOnly 
              value={generatedLink} 
              className="w-full bg-white border border-gray-300 p-2 text-sm font-mono text-gray-600 outline-none"
            />
            <button 
              onClick={copyToClipboard}
              className="btn-nhs-primary whitespace-nowrap"
            >
              {copied ? "Copied!" : "Copy Link"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
