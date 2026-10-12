import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Search, Download, FileSpreadsheet } from "lucide-react";

export default function Report() {
  const { guidelineId } = useParams();
  const navigate = useNavigate();
  
  const [guidelines, setGuidelines] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const [report, setReport] = useState(null);
  const [guideline, setGuideline] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // 1. Fetch the list of all guidelines for the selector
  useEffect(() => {
    fetch("http://localhost:8000/api/guidelines")
      .then(res => res.json())
      .then(data => setGuidelines(data));
  }, []);

  // 2. Fetch the specific report data when the URL ID changes
  useEffect(() => {
    if (!guidelineId) {
      setReport(null);
      setGuideline(null);
      return;
    }
    
    setLoading(true);
    Promise.all([
      fetch(`http://localhost:8000/api/reports/${guidelineId}/compliance`).then(res => res.json()),
      fetch(`http://localhost:8000/api/guidelines/${guidelineId}`).then(res => res.json())
    ]).then(([reportData, guidelineData]) => {
      if (reportData && !reportData.detail && Array.isArray(reportData.action_plan)) {
        setReport(reportData);
      } else {
        setReport(null);
      }
      if (guidelineData && !guidelineData.detail) {
        setGuideline(guidelineData);
      }
      setLoading(false);
    }).catch(err => {
      console.error("Error fetching report", err);
      setReport(null);
      setLoading(false);
    });
  }, [guidelineId]);

  // Handle selecting a guideline from the dropdown
  const handleSelectGuideline = (id) => {
    setIsDropdownOpen(false);
    setSearchQuery("");
    navigate(`/report/${id}`);
  };

  const handleExportCSV = async () => {
    try {
      const res = await fetch(`http://localhost:8000/api/reports/${guidelineId}/export/csv`);
      if (!res.ok) throw new Error("Failed to export assessment report");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${guideline?.nice_id || "Guideline"}_Assessment_Report.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
      alert("Failed to export assessment report CSV.");
    }
  };

  const handleExportActionPlanCSV = async () => {
    try {
      const res = await fetch(`http://localhost:8000/api/reports/${guidelineId}/export/action-plan/csv`);
      if (!res.ok) throw new Error("Failed to export action plan");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${guideline?.nice_id || "Guideline"}_Action_Plan.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
      alert("Failed to export action plan CSV.");
    }
  };

  const filteredGuidelines = guidelines.filter(g => 
    g.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    g.nice_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8 max-w-6xl mx-auto w-full h-full overflow-y-auto flex flex-col">
      
      {/* HEADER & SELECTOR */}
      <div className="mb-8 border-b-4 border-nhs-blue pb-6">
        <h1 className="text-4xl font-bold text-nhs-dark mb-4">Compliance Report</h1>
        
        {/* Searchable Custom Dropdown */}
        <div className="relative w-full max-w-2xl">
          <label className="block text-sm font-bold text-nhs-dark mb-2">Select NICE Guidance</label>
          <div 
            className="border-2 border-gray-300 bg-white p-3 flex items-center cursor-text focus-within:border-nhs-blue focus-within:ring-4 focus-within:ring-nhs-yellow transition-all"
            onClick={() => setIsDropdownOpen(true)}
          >
            <Search size={20} className="text-gray-500 mr-3" />
            <input 
              type="text" 
              placeholder={guideline ? `${guideline.nice_id}: ${guideline.name}` : "Search for e.g., 'Sepsis' or 'NG253'..."}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsDropdownOpen(true);
              }}
              className="w-full outline-none text-nhs-dark font-medium placeholder-gray-500"
            />
          </div>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute z-50 w-full mt-1 bg-white border-2 border-nhs-dark shadow-xl max-h-80 overflow-y-auto">
              {filteredGuidelines.length > 0 ? (
                filteredGuidelines.map(g => (
                  <div 
                    key={g.id} 
                    onClick={() => handleSelectGuideline(g.id)}
                    className="p-4 border-b border-gray-100 hover:bg-nhs-blue hover:text-white cursor-pointer transition-colors"
                  >
                    <div className="font-bold">{g.nice_id}</div>
                    <div className="text-sm opacity-90">{g.name}</div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-gray-500 italic">No matching guidelines found.</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CLICK AWAY LISTENER (simple hack) */}
      {isDropdownOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)}></div>
      )}

      {/* STATE: NO SELECTION OR LOADING */}
      {!guidelineId && !loading && (
        <div className="flex-1 flex items-center justify-center text-gray-500 text-lg">
          Please select a guidance using the search bar above to view its compliance report.
        </div>
      )}
      
      {loading && <div className="p-8 text-nhs-dark font-bold text-xl">Loading compliance data...</div>}

      {/* MAIN REPORT */}
      {guidelineId && report && report.action_plan && guideline && !loading && (
        <div className="animate-in fade-in">
          <div className="flex justify-between items-end mb-6">
            <h2 className="text-2xl font-bold text-nhs-dark">Report: {guideline.nice_id}</h2>
            <div className="flex gap-3">
              <button 
                onClick={handleExportCSV}
                className="btn-nhs-primary flex items-center gap-2"
                title="Download full baseline assessment report with all recommendations and responses"
              >
                <Download size={18} />
                Export Assessment CSV
              </button>
              <button 
                onClick={handleExportActionPlanCSV}
                className="btn-nhs-secondary flex items-center gap-2"
                title="Download only the recommendations that require action"
              >
                <FileSpreadsheet size={18} />
                Export Action Plan CSV
              </button>
            </div>
          </div>

          {/* Top Stats Cards */}
          <div className="grid grid-cols-4 gap-6 mb-10">
            <div className="bg-nhs-pale p-6 border-l-8 border-nhs-blue shadow-sm flex flex-col justify-between">
              <p className="text-sm font-bold text-nhs-dark uppercase tracking-wide">Overall Compliance</p>
              <div className="flex items-end gap-2 mt-4">
                <span className={`text-5xl font-black ${report.compliance_percentage >= 80 ? 'text-nhs-green' : report.compliance_percentage >= 50 ? 'text-orange-600' : 'text-nhs-red'}`}>
                  {report.compliance_percentage}%
                </span>
              </div>
            </div>
            <div className="bg-white p-6 border-2 border-nhs-pale shadow-sm">
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">Total Relevant Recs</p>
              <span className="text-4xl font-bold text-nhs-dark block mt-4">{report.relevant_count}</span>
              <p className="text-xs text-gray-400 mt-2 font-bold">Out of {report.total_recommendations} total</p>
            </div>
            <div className="bg-white p-6 border-2 border-nhs-pale shadow-sm">
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">Fully Met</p>
              <span className="text-4xl font-bold text-nhs-green block mt-4">{report.met_count}</span>
            </div>
            <div className="bg-white p-6 border-2 border-nhs-pale shadow-sm">
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">Actions Required</p>
              <span className="text-4xl font-bold text-orange-600 block mt-4">{(report.action_plan || []).length}</span>
            </div>
          </div>

          {/* Action Plan Table */}
          <h2 className="text-2xl font-bold mb-4 text-nhs-dark">Action Plan (Exceptions)</h2>
          <div className="bg-white border-2 border-nhs-pale shadow-sm overflow-hidden mb-12">
            <table className="w-full text-left text-sm text-nhs-dark">
              <thead className="bg-nhs-pale border-b-4 border-nhs-dark-blue uppercase text-xs font-bold text-nhs-dark">
                <tr>
                  <th className="px-6 py-4 w-24">Rec</th>
                  <th className="px-6 py-4 w-32">Status</th>
                  <th className="px-6 py-4">Action Required</th>
                  <th className="px-6 py-4 w-40">Lead</th>
                  <th className="px-6 py-4 w-32">Deadline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {(report.action_plan || []).length === 0 ? (
                  <tr><td colSpan="5" className="px-6 py-8 text-center text-gray-500 italic font-medium">No active action plans for this guideline. Everything is fully met or not relevant!</td></tr>
                ) : (report.action_plan || []).map(item => (
                  <tr key={item.recommendation.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-nhs-blue">{item.recommendation.guideline_rec}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 border-2 text-xs font-bold uppercase tracking-wider ${item.assessment.meet === 'Partial' ? 'border-orange-300 bg-orange-50 text-orange-800' : 'border-nhs-red bg-red-50 text-nhs-red'}`}>
                        {item.assessment.meet}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium">{item.assessment.action || <span className="italic text-gray-400">Not specified</span>}</td>
                    <td className="px-6 py-4 font-bold">{item.assessment.lead || <span className="italic text-gray-400">Unassigned</span>}</td>
                    <td className="px-6 py-4 font-medium">{item.assessment.deadline || <span className="italic text-gray-400">None</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
