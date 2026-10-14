import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Mail, Copy, Check, ExternalLink, X, Send, Download } from "lucide-react";
import { apiFetch } from "../api";

export default function GuidelineList() {
  const [guidelines, setGuidelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGuideline, setSelectedGuideline] = useState(null);
  const [reviewerEmail, setReviewerEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/guidelines")
      .then(res => res.json())
      .then(data => {
        setGuidelines(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error loading guidelines:", err);
        setGuidelines([]);
        setLoading(false);
      });
  }, []);

  const handleOpenModal = (g) => {
    setSelectedGuideline(g);
    setReviewerEmail("");
    setInviteResult(null);
    setError("");
    setCopied(false);
  };

  const handleCloseModal = () => {
    setSelectedGuideline(null);
    setReviewerEmail("");
    setInviteResult(null);
    setError("");
  };

  const handleSendInvite = async (e) => {
    e.preventDefault();
    if (!reviewerEmail.trim()) return;

    setInviting(true);
    setError("");

    try {
      const res = await apiFetch("/auth/magic-link/invite", {
        method: "POST",
        body: JSON.stringify({
          email: reviewerEmail.trim(),
          guideline_id: selectedGuideline.id
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to generate reviewer link");
      }

      setInviteResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setInviting(false);
    }
  };

  const handleCopy = () => {
    if (!inviteResult?.link) return;
    navigator.clipboard.writeText(inviteResult.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleQuickExport = async (g) => {
    try {
      const res = await apiFetch(`/reports/${g.id}/export/csv`);
      if (!res.ok) throw new Error("Failed to export assessment report");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${g.nice_id}_Assessment_Report.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
      alert("Failed to export assessment report CSV.");
    }
  };

  if (loading) return <div className="p-8">Loading guidelines...</div>;

  return (
    <div className="p-8 h-full bg-white overflow-y-auto">
      <div className="mb-10 border-b-4 border-nhs-blue pb-6">
        <h1 className="text-4xl font-bold text-nhs-dark mb-3">Available Assessments</h1>
        <p className="text-lg text-nhs-dark opacity-90">Select a NICE baseline assessment tool to begin reviewing your trust's compliance, or assign it directly to a clinical lead.</p>
      </div>
      
      <div className="grid gap-6 max-w-5xl">
        {guidelines.map(g => (
          <div key={g.id} className="bg-nhs-pale p-8 border-l-8 border-nhs-blue shadow-sm flex justify-between items-center">
            <div>
              <span className="inline-block px-3 py-1 bg-white text-nhs-blue border border-nhs-blue rounded text-sm font-bold mb-3">{g.nice_id}</span>
              <h2 className="text-2xl font-bold text-nhs-dark">{g.name}</h2>
            </div>
            <div className="flex items-center gap-3 ml-8">
              <button 
                onClick={() => handleOpenModal(g)}
                className="btn-nhs-secondary flex items-center gap-2 whitespace-nowrap"
              >
                <Mail size={18} />
                Send to Reviewer
              </button>
              <button 
                onClick={() => handleQuickExport(g)}
                title="Export Assessment CSV"
                className="btn-nhs-secondary flex items-center gap-1.5 whitespace-nowrap"
              >
                <Download size={18} />
                Export CSV
              </button>
              <Link to={`/report/${g.id}`} className="btn-nhs-secondary whitespace-nowrap">
                View Report
              </Link>
              <Link to={`/wizard/${g.id}`} className="btn-nhs-primary whitespace-nowrap">
                Start Assessment
              </Link>
            </div>
          </div>
        ))}
        {guidelines.length === 0 && (
          <div className="text-center p-12 bg-nhs-pale border-t-4 border-nhs-blue text-nhs-dark font-medium text-lg">
            No guidelines have been uploaded yet.
          </div>
        )}
      </div>

      {/* MODAL: ASSIGN / SEND TO REVIEWER */}
      {selectedGuideline && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border-t-8 border-nhs-blue shadow-2xl max-w-lg w-full p-8 relative animate-in fade-in zoom-in-95">
            <button 
              onClick={handleCloseModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-nhs-dark"
            >
              <X size={24} />
            </button>

            <div className="mb-6">
              <span className="inline-block px-2.5 py-0.5 bg-nhs-pale text-nhs-blue border border-nhs-blue font-bold text-xs rounded mb-2">
                {selectedGuideline.nice_id}
              </span>
              <h3 className="text-2xl font-bold text-nhs-dark leading-snug">
                Send Assessment to Reviewer
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {selectedGuideline.name}
              </p>
            </div>

            {!inviteResult ? (
              <form onSubmit={handleSendInvite} className="space-y-5">
                {error && (
                  <div className="bg-red-50 border-l-4 border-nhs-red text-nhs-red p-3 text-sm font-semibold">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-nhs-dark mb-2">
                    Reviewer's NHS Email Address
                  </label>
                  <input 
                    type="email" 
                    required
                    placeholder="e.g. j.smith@lhch.nhs.uk"
                    value={reviewerEmail}
                    onChange={e => setReviewerEmail(e.target.value)}
                    className="w-full border-2 border-gray-300 p-3 text-base outline-none focus:border-nhs-blue focus:ring-4 focus:ring-nhs-yellow transition-all"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    A secure auto-login link will be generated. The reviewer will bypass password login and be taken straight to Recommendation 1.
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button 
                    type="button" 
                    onClick={handleCloseModal}
                    className="btn-nhs-secondary"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={inviting || !reviewerEmail}
                    className="btn-nhs-primary flex items-center gap-2"
                  >
                    <Send size={18} />
                    {inviting ? "Generating Link..." : "Create Reviewer Link"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="bg-nhs-pale border-l-4 border-nhs-green p-4">
                  <div className="font-bold text-nhs-dark text-base">
                    Access link ready for {inviteResult.email}!
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Valid for 7 days. Anyone with this link can complete this assessment without a password.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                    Single-Use Assessment URL
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      readOnly 
                      value={inviteResult.link} 
                      className="w-full bg-gray-50 border border-gray-300 p-2.5 text-xs font-mono text-gray-700 outline-none select-all"
                    />
                    <button 
                      onClick={handleCopy}
                      className="btn-nhs-secondary flex items-center gap-1.5 whitespace-nowrap text-sm py-2 px-3"
                    >
                      {copied ? <Check size={16} className="text-nhs-green" /> : <Copy size={16} />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex flex-col gap-3">
                  <a
                    href={`mailto:${encodeURIComponent(inviteResult.email)}?subject=${encodeURIComponent(`NICE Baseline Assessment: ${inviteResult.nice_id} (${inviteResult.guideline_name})`)}&body=${encodeURIComponent(
`Dear Colleague,

Please review and complete the NICE baseline assessment for ${inviteResult.nice_id}: ${inviteResult.guideline_name}.

You can access your assessment directly using the secure link below (no password required):
${inviteResult.link}

Kind regards,
Clinical Governance & Audit Team`
                    )}`}
                    className="btn-nhs-primary flex items-center justify-center gap-2 text-center text-base py-3"
                  >
                    <ExternalLink size={18} />
                    Open Pre-filled Email in Outlook
                  </a>

                  <button 
                    onClick={handleCloseModal}
                    className="btn-nhs-secondary text-sm py-2"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

