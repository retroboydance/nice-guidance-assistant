import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { CheckCircle2, AlertTriangle, Loader2, ArrowLeft, ArrowRight, Save, Check } from "lucide-react";
import { apiFetch } from "../api";

export default function Wizard() {
  const { guidelineId } = useParams();
  const navigate = useNavigate();
  
  const [guideline, setGuideline] = useState(null);
  const [assessments, setAssessments] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  // Save feedback state
  const [saveStatus, setSaveStatus] = useState("saved"); // "saving" | "saved" | "error"
  const [errorMessage, setErrorMessage] = useState("");
  const [completedModal, setCompletedModal] = useState(false);

  // Form state for current recommendation
  const [formData, setFormData] = useState({
    relevant: true,
    meet: "",
    evidence: "",
    action: "",
    action_status: "Not Started",
    lead: "",
    deadline: ""
  });

  useEffect(() => {
    const idToFetch = guidelineId || "1"; 
    
    const fetchData = async () => {
      setLoading(true);
      setFetchError("");
      try {
        // 1. Fetch Guideline and Recommendations
        const gRes = await apiFetch(`/guidelines/${idToFetch}`);
        if (!gRes.ok) {
          throw new Error(`Failed to load guideline (${gRes.status})`);
        }
        const gData = await gRes.json();
        
        // 2. Fetch previously saved Assessments for this Trust
        const aRes = await apiFetch(`/assessments/${idToFetch}`);
        let aData = [];
        if (aRes.ok) {
          aData = await aRes.json();
        } else if (aRes.status === 401) {
          console.warn("Unauthenticated when fetching assessments; using empty state.");
        }
        
        // Map assessments by recommendation_id for easy lookup
        const aMap = {};
        if (Array.isArray(aData)) {
          aData.forEach(a => { aMap[a.recommendation_id] = a; });
        }
        
        setGuideline(gData);
        setAssessments(aMap);
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch data", err);
        setFetchError(err.message || "Could not connect to server");
        setLoading(false);
      }
    };
    fetchData();
  }, [guidelineId]);

  // When changing pages, load the saved assessment into the form
  useEffect(() => {
    if (!guideline || !guideline.recommendations || guideline.recommendations.length === 0) return;
    
    const rec = guideline.recommendations[currentIndex];
    if (!rec) return;

    const saved = assessments[rec.id];
    
    if (saved) {
      setFormData({
        relevant: saved.relevant ?? true,
        meet: saved.meet || "",
        evidence: saved.evidence || "",
        action: saved.action || "",
        action_status: saved.action_status || "Not Started",
        lead: saved.lead || "",
        deadline: saved.deadline ? saved.deadline.substring(0, 10) : ""
      });
    } else {
      setFormData({
        relevant: true,
        meet: "",
        evidence: "",
        action: "",
        action_status: "Not Started",
        lead: "",
        deadline: ""
      });
    }
  }, [currentIndex, guideline, assessments]);

  const saveCurrentAssessment = async () => {
    if (!guideline || !guideline.recommendations || guideline.recommendations.length === 0) return false;
    
    const rec = guideline.recommendations[currentIndex];
    if (!rec) return false;

    const payload = { ...formData, recommendation_id: rec.id };
    
    setSaveStatus("saving");
    setErrorMessage("");

    try {
      const res = await apiFetch(`/assessments`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const detail = errorData.detail || `Server responded with status ${res.status}`;
        throw new Error(detail);
      }
      
      const savedData = await res.json();
      
      // Update local state
      setAssessments(prev => ({ ...prev, [rec.id]: savedData }));
      setSaveStatus("saved");
      return true;
    } catch (err) {
      console.error("Failed to save", err);
      setSaveStatus("error");
      setErrorMessage(err.message || "Failed to save assessment to server.");
      return false;
    }
  };

  const handleNext = async () => {
    const success = await saveCurrentAssessment();
    if (currentIndex < guideline.recommendations.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
    return success;
  };

  const handlePrev = async () => {
    await saveCurrentAssessment();
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleFinish = async () => {
    const success = await saveCurrentAssessment();
    if (success) {
      setCompletedModal(true);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 bg-gray-50 h-full">
        <Loader2 className="animate-spin text-nhs-blue mb-4" size={40} />
        <p className="text-gray-700 font-semibold">Loading Guideline Assessment...</p>
      </div>
    );
  }

  if (fetchError || !guideline || !guideline.recommendations || guideline.recommendations.length === 0) {
    return (
      <div className="p-8 max-w-2xl mx-auto my-12 bg-white border-l-4 border-nhs-red shadow-md">
        <h2 className="text-xl font-bold text-nhs-dark mb-2">Unable to Load Guideline</h2>
        <p className="text-gray-600 mb-6">{fetchError || "No recommendations found for this guideline."}</p>
        <button onClick={() => navigate("/")} className="btn-nhs-secondary">
          Return to Assessments List
        </button>
      </div>
    );
  }

  const currentRec = guideline.recommendations[currentIndex];
  const isLastRec = currentIndex === guideline.recommendations.length - 1;
  const showActionPlan = formData.meet === "No" || formData.meet === "Partial";

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-100">
      
      {/* TOP HEADER / BAR */}
      <div className="bg-nhs-pale border-b-4 border-white px-6 py-4 flex justify-between items-center shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-nhs-dark tracking-wide">{guideline.nice_id}: {guideline.name}</h2>
            
            {/* Auto-save status indicator badge */}
            <div className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded bg-white border border-gray-200">
              {saveStatus === "saving" && (
                <>
                  <Loader2 className="animate-spin text-nhs-blue" size={14} />
                  <span className="text-nhs-blue">Saving changes...</span>
                </>
              )}
              {saveStatus === "saved" && (
                <>
                  <CheckCircle2 className="text-green-600" size={14} />
                  <span className="text-green-700">All changes saved</span>
                </>
              )}
              {saveStatus === "error" && (
                <>
                  <AlertTriangle className="text-red-600" size={14} />
                  <span className="text-red-700">Save failed</span>
                </>
              )}
            </div>
          </div>
          <p className="text-sm font-medium text-nhs-dark mt-1">
            Recommendation {currentIndex + 1} of {guideline.recommendations.length}
          </p>
        </div>

        {/* NAVIGATION BUTTONS */}
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={handlePrev} 
            disabled={currentIndex === 0 || saveStatus === "saving"} 
            className="btn-nhs-secondary disabled:opacity-50 flex items-center gap-1.5"
          >
            <ArrowLeft size={16} />
            Previous
          </button>
          
          {!isLastRec ? (
            <button 
              type="button"
              onClick={handleNext} 
              disabled={saveStatus === "saving"}
              className="btn-nhs-primary flex items-center gap-1.5"
            >
              Save & Next
              <ArrowRight size={16} />
            </button>
          ) : (
            <button 
              type="button"
              onClick={handleFinish} 
              disabled={saveStatus === "saving"}
              className="bg-emerald-600 text-white px-5 py-2 rounded font-bold hover:bg-emerald-700 shadow-sm flex items-center gap-1.5 transition-colors"
            >
              <Check size={18} />
              Save & Complete
            </button>
          )}
        </div>
      </div>

      {/* ERROR BANNER IF SAVE FAILS */}
      {errorMessage && (
        <div className="bg-red-50 border-l-4 border-red-600 p-4 mx-6 mt-4 flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-red-600 flex-shrink-0" size={20} />
            <div>
              <p className="font-bold text-red-800 text-sm">Save Error</p>
              <p className="text-red-700 text-xs">{errorMessage}</p>
            </div>
          </div>
          <button 
            onClick={saveCurrentAssessment}
            className="px-3 py-1 bg-red-600 text-white rounded text-xs font-bold hover:bg-red-700"
          >
            Retry Save
          </button>
        </div>
      )}

      {/* SIDE-BY-SIDE CONTENT LAYOUT */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT SIDE: NICE Guidance (Read-Only) */}
        <div className="w-1/2 p-8 overflow-y-auto bg-nhs-blue text-white border-r-8 border-nhs-dark-blue">
          <span className="inline-block px-3 py-1 bg-white text-nhs-blue border border-nhs-blue rounded text-sm font-bold mb-6">
            REC {currentRec.guideline_rec}
          </span>
          <h3 className="text-2xl font-bold mb-4 leading-relaxed whitespace-pre-line">
            {currentRec.rec_text}
          </h3>
          {(currentRec.publish_info || currentRec.rec_year) && (
            <p className="text-sm font-medium mt-8 opacity-80">
              Published: {currentRec.publish_info || currentRec.rec_year}
            </p>
          )}
        </div>

        {/* RIGHT SIDE: Assessment Form */}
        <div className="w-1/2 p-8 overflow-y-auto bg-gray-50">
          <div className="max-w-xl mx-auto space-y-6 pb-12">
            
            {/* Relevance Selection */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Is this recommendation relevant to your Trust?
              </label>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="relevance"
                    checked={formData.relevant === true} 
                    onChange={() => setFormData(prev => ({ ...prev, relevant: true }))} 
                    className="w-4 h-4 text-nhs-blue focus:ring-nhs-blue" 
                  />
                  <span className="font-medium text-gray-800">Yes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="relevance"
                    checked={formData.relevant === false} 
                    onChange={() => setFormData(prev => ({ ...prev, relevant: false }))} 
                    className="w-4 h-4 text-nhs-blue focus:ring-nhs-blue" 
                  />
                  <span className="font-medium text-gray-800">No</span>
                </label>
              </div>
            </div>

            {formData.relevant && (
              <div className="bg-white p-6 rounded-lg shadow-sm border animate-in fade-in space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Does your service meet this recommendation?
                  </label>
                  <select 
                    value={formData.meet} 
                    onChange={(e) => setFormData(prev => ({ ...prev, meet: e.target.value }))}
                    className="w-full border-gray-300 rounded-md shadow-sm p-2.5 border focus:ring-2 focus:ring-nhs-blue focus:outline-none text-sm font-medium"
                  >
                    <option value="">Select compliance status...</option>
                    <option value="Yes">Yes - Fully Met</option>
                    <option value="Partial">Partial - Needs Action</option>
                    <option value="No">No - Needs Action</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Evidence of current activity
                  </label>
                  <textarea 
                    value={formData.evidence}
                    onChange={(e) => setFormData(prev => ({ ...prev, evidence: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-nhs-blue focus:outline-none" 
                    rows="4" 
                    placeholder="Record relevant policies, audit results, clinical guidelines or current practice evidence here..."
                  />
                </div>
              </div>
            )}

            {formData.relevant && showActionPlan && (
              <div className="bg-orange-50 border border-orange-200 p-6 rounded-lg shadow-sm animate-in fade-in">
                <h4 className="text-orange-900 font-bold mb-4 flex items-center gap-2">
                  <AlertTriangle size={18} className="text-orange-600" />
                  Action Plan Required
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Required Action</label>
                    <textarea 
                      value={formData.action} 
                      onChange={(e) => setFormData(prev => ({ ...prev, action: e.target.value }))} 
                      className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none" 
                      rows="2" 
                      placeholder="Specify the remedial steps required to achieve compliance..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Lead Person</label>
                      <input 
                        type="text" 
                        value={formData.lead} 
                        onChange={(e) => setFormData(prev => ({ ...prev, lead: e.target.value }))} 
                        className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none" 
                        placeholder="e.g. Dr S. Jenkins"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Target Deadline</label>
                      <input 
                        type="date" 
                        value={formData.deadline} 
                        onChange={(e) => setFormData(prev => ({ ...prev, deadline: e.target.value }))} 
                        className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none" 
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Action Status</label>
                    <select 
                      value={formData.action_status} 
                      onChange={(e) => setFormData(prev => ({ ...prev, action_status: e.target.value }))} 
                      className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    >
                      <option value="Not Started">Not Started</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Save button for immediate assurance */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={saveCurrentAssessment}
                disabled={saveStatus === "saving"}
                className="text-xs text-gray-600 hover:text-nhs-blue flex items-center gap-1 font-semibold"
              >
                <Save size={14} />
                Save current recommendation
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* COMPLETED MODAL */}
      {completedModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border-t-8 border-nhs-green shadow-2xl max-w-md w-full p-8 text-center animate-in fade-in zoom-in-95">
            <CheckCircle2 size={56} className="text-nhs-green mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-nhs-dark mb-2">Assessment Saved!</h3>
            <p className="text-gray-600 text-sm mb-6">
              All recommendations and responses for <strong>{guideline.nice_id}</strong> have been recorded to the database.
            </p>
            <div className="flex flex-col gap-3">
              <Link 
                to={`/report/${guideline.id}`}
                className="btn-nhs-primary text-center py-3"
              >
                View Compliance Report
              </Link>
              <Link 
                to="/"
                className="btn-nhs-secondary text-center py-2"
              >
                Back to All Assessments
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
