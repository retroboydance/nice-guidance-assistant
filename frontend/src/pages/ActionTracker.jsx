import React, { useState, useEffect } from "react";
import { Filter, ChevronDown, ChevronRight, AlertTriangle, Send, Download } from "lucide-react";
import { apiFetch } from "../api";

export default function ActionTracker() {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState({});
  const [newUpdates, setNewUpdates] = useState({});

  useEffect(() => {
    apiFetch("/actions")
      .then(res => res.json())
      .then(data => {
        setActions(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error loading actions:", err);
        setActions([]);
        setLoading(false);
      });
  }, []);

  const updateStatus = async (assessmentId, newStatus) => {
    // Note: full implementation would POST to an update endpoint.
    // For now, doing a local update.
    setActions(actions.map(item => 
      item.assessment.id === assessmentId 
        ? { ...item, assessment: { ...item.assessment, action_status: newStatus } }
        : item
    ));
  };

  const toggleRow = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const submitUpdate = async (assessmentId) => {
    const text = newUpdates[assessmentId];
    if (!text) return;

    try {
      const res = await apiFetch(`/assessments/${assessmentId}/updates`, {
        method: 'POST',
        body: JSON.stringify({ update_text: text })
      });
      const savedUpdate = await res.json();
      
      // Update local state to show it immediately
      setActions(actions.map(item => {
        if (item.assessment.id === assessmentId) {
          return {
            ...item,
            assessment: {
              ...item.assessment,
              updates: [savedUpdate, ...(item.assessment.updates || [])]
            }
          };
        }
        return item;
      }));
      setNewUpdates(prev => ({ ...prev, [assessmentId]: "" }));
    } catch (err) {
      console.error("Failed to add update", err);
    }
  };

  const handleExportGlobalCSV = async () => {
    try {
      const res = await apiFetch("/actions/export/csv");
      if (!res.ok) throw new Error("Failed to export action tracker");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Trust_Action_Tracker.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
      alert("Failed to export action tracker CSV.");
    }
  };

  if (loading) return <div className="p-8">Loading actions...</div>;

  return (
    <div className="p-8 h-full flex flex-col bg-white">
      <div className="flex justify-between items-end mb-8 border-b-4 border-nhs-blue pb-4">
        <div>
          <h1 className="text-4xl font-bold text-nhs-dark mb-2">Global Action Tracker</h1>
          <p className="text-lg text-nhs-dark opacity-90">Track and update open actions across all NICE guidelines.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleExportGlobalCSV}
            className="btn-nhs-primary flex items-center gap-2"
          >
            <Download size={18} />
            Export Actions CSV
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-nhs-pale font-bold text-nhs-dark hover:bg-gray-300 transition-colors shadow-sm">
            <Filter size={18} />
            Filter: Overdue
          </button>
        </div>
      </div>

      <div className="flex-1 bg-white shadow-sm overflow-hidden flex flex-col border-2 border-nhs-pale">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-sm text-nhs-dark">
            <thead className="bg-nhs-pale border-b-4 border-nhs-dark-blue text-nhs-dark uppercase text-xs font-bold sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 w-10"></th>
                <th className="px-6 py-3 w-32">Guideline</th>
                <th className="px-6 py-3 w-32">Rec</th>
                <th className="px-6 py-3">Action Required</th>
                <th className="px-6 py-3 w-40">Lead</th>
                <th className="px-6 py-3 w-40">Deadline</th>
                <th className="px-6 py-3 w-40">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {actions.length === 0 ? (
                <tr><td colSpan="7" className="p-8 text-center text-gray-500">No active actions found! Excellent.</td></tr>
              ) : actions.map(item => {
                const assessment = item.assessment;
                const isExpanded = expandedRows[assessment.id];
                
                // Determine if overdue
                const today = new Date();
                today.setHours(0,0,0,0);
                const deadlineDate = assessment.deadline ? new Date(assessment.deadline) : null;
                const isOverdue = deadlineDate && deadlineDate < today && assessment.action_status !== 'Completed';

                return (
                  <React.Fragment key={assessment.id}>
                    <tr className={`hover:bg-gray-50 ${isExpanded ? 'bg-blue-50/30' : ''}`}>
                      <td className="px-4 py-4 cursor-pointer" onClick={() => toggleRow(assessment.id)}>
                        {isExpanded ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
                      </td>
                      <td className="px-6 py-4">
                        <div className="relative group inline-block cursor-help hover:z-50">
                          <span className="font-bold text-blue-600 border-b border-dashed border-blue-300">
                            {item.guideline.nice_id}
                          </span>
                          <div className="absolute left-0 top-full mt-2 hidden group-hover:block w-64 bg-gray-900 text-white text-xs rounded shadow-xl p-2 z-[100]">
                            {item.guideline.name}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="relative group inline-block cursor-help hover:z-50">
                          <span className="font-bold text-gray-900 border-b border-dashed border-gray-400">
                            {item.recommendation.guideline_rec}
                          </span>
                          <div className="absolute left-0 top-full mt-2 hidden group-hover:block w-max max-w-3xl bg-gray-900 text-white text-xs rounded shadow-xl p-3 z-[100] whitespace-pre-wrap leading-relaxed">
                            {item.recommendation.rec_text}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {assessment.action || <span className="text-gray-400 italic">No action specified</span>}
                      </td>
                      <td className="px-6 py-4">
                        {assessment.lead || <span className="text-gray-400 italic">Unassigned</span>}
                      </td>
                      <td className="px-6 py-4">
                        {assessment.deadline ? (
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                              {assessment.deadline}
                            </span>
                            {isOverdue && <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded uppercase flex items-center gap-1"><AlertTriangle size={10} /> Overdue</span>}
                          </div>
                        ) : <span className="text-gray-400 italic">None</span>}
                      </td>
                      <td className="px-6 py-4">
                        <select 
                          value={assessment.action_status} 
                          onChange={(e) => updateStatus(assessment.id, e.target.value)}
                          className={`border rounded p-1 text-xs font-semibold ${
                            assessment.action_status === 'Completed' ? 'bg-green-50 text-green-700 border-green-200' :
                            assessment.action_status === 'In Progress' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            'bg-gray-100 text-gray-700 border-gray-300'
                          }`}
                        >
                          <option value="Not Started">Not Started</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Completed">Completed</option>
                        </select>
                      </td>
                    </tr>
                    
                    {/* EXPANDABLE ROW FOR UPDATES */}
                    {isExpanded && (
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <td colSpan="7" className="px-10 py-6">
                          <div className="max-w-4xl mx-auto pl-6 border-l-2 border-blue-200 space-y-4">
                            <h4 className="text-sm font-bold text-gray-800">Progress Updates</h4>
                            
                            {/* List of existing updates */}
                            {(!assessment.updates || assessment.updates.length === 0) ? (
                              <p className="text-sm text-gray-500 italic">No updates recorded yet.</p>
                            ) : (
                              <div className="space-y-3">
                                {assessment.updates.map(update => (
                                  <div key={update.id} className="bg-white p-3 rounded border shadow-sm text-sm">
                                    <div className="text-xs text-gray-400 font-medium mb-1">
                                      {new Date(update.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                                    </div>
                                    <div className="text-gray-700">{update.update_text}</div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Add new update form */}
                            <div className="mt-4 flex gap-2">
                              <input 
                                type="text"
                                value={newUpdates[assessment.id] || ""}
                                onChange={(e) => setNewUpdates({...newUpdates, [assessment.id]: e.target.value})}
                                placeholder="Add a new dated update..."
                                className="flex-1 border border-gray-300 rounded p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                                onKeyDown={(e) => e.key === 'Enter' && submitUpdate(assessment.id)}
                              />
                              <button 
                                onClick={() => submitUpdate(assessment.id)}
                                className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 flex items-center gap-2"
                              >
                                <Send size={16} /> Save
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
