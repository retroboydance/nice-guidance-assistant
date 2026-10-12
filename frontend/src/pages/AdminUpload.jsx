import { useState } from "react";
import { UploadCloud, CheckCircle, AlertTriangle } from "lucide-react";

export default function AdminUpload() {
  const [niceId, setNiceId] = useState("");
  const [name, setName] = useState("");
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

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
    if (!file || !niceId || !name) {
      setStatus({ type: "error", message: "Please fill all fields and select a file." });
      return;
    }
    
    setLoading(true);
    setStatus(null);
    
    const formData = new FormData();
    formData.append("nice_id", niceId);
    formData.append("name", name);
    formData.append("file", file);

    try {
      const res = await fetch("http://localhost:8000/api/admin/guidelines/upload", {
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
    <div className="p-8 max-w-3xl mx-auto h-full overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Admin: Upload Guidance</h1>
        <p className="text-gray-500">
          Upload a clean CSV containing the raw recommendation text. 
          If the guideline already exists, it will intelligently append new rules and audit-log changed text.
        </p>
      </div>

      <div className="bg-white border rounded-lg shadow-sm p-8">
        <form onSubmit={handleUpload} className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Guideline Reference</label>
              <input 
                type="text" 
                placeholder="e.g., NG253" 
                value={niceId}
                onChange={e => setNiceId(e.target.value)}
                className="w-full border rounded p-3 focus:ring-blue-500 focus:border-blue-500" 
                required 
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Guideline Name</label>
              <input 
                type="text" 
                placeholder="e.g., Suspected sepsis in over 16s" 
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full border rounded p-3 focus:ring-blue-500 focus:border-blue-500" 
                required 
              />
            </div>
          </div>

          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors ${
              isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:bg-gray-50'
            }`}
          >
            <UploadCloud className={`mx-auto h-12 w-12 mb-4 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
            <div className="text-sm text-gray-600 mb-2">
              <label className="cursor-pointer font-bold text-blue-600 hover:text-blue-800">
                <span>Click to browse</span>
                <input type="file" accept=".csv" className="hidden" onChange={e => setFile(e.target.files[0])} />
              </label>
              {" "}or drag and drop your CSV file here.
            </div>
            <p className="text-xs text-gray-500">
              CSV must contain two or three columns: <br/> <strong>Guideline Number</strong>, <strong>Guideline Text</strong>, and optionally <strong>Publish Info</strong> (e.g. '2016, amended 2025')
            </p>
            {file && (
              <div className="mt-4 inline-block bg-blue-50 text-blue-700 px-4 py-2 rounded font-medium text-sm border border-blue-200">
                Selected: {file.name}
              </div>
            )}
          </div>

          <div className="pt-4 flex justify-between items-center">
            {status ? (
              <div className={`flex items-center gap-2 text-sm font-medium ${status.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {status.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                {status.message}
              </div>
            ) : <div />}
            
            <button 
              type="submit" 
              disabled={loading}
              className="bg-blue-600 text-white px-8 py-3 rounded font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              {loading ? "Processing Upload..." : "Upload Guidelines"}
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 2: GENERATE ONE-CLICK ACCESS LINKS */}
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
    fetch("http://localhost:8000/api/auth/users")
      .then(res => res.json())
      .then(data => setUsers(data));

    fetch("http://localhost:8000/api/guidelines")
      .then(res => res.json())
      .then(data => setGuidelines(data));
  }, []);

  const handleGenerate = async () => {
    if (!selectedUser || !selectedGuideline) return;

    const res = await fetch("http://localhost:8000/api/auth/magic-link/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
            {users.map(u => (
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
            {guidelines.map(g => (
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
