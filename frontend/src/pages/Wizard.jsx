import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";

export default function Wizard() {
  const { guidelineId } = useParams();
  
  const [guideline, setGuideline] = useState(null);
  const [assessments, setAssessments] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

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
    // We are hardcoding NG253 for the demo if guidelineId is missing
    const idToFetch = guidelineId || "1"; 
    
    const fetchData = async () => {
      try {
        // 1. Fetch Guideline and Recommendations
        const gRes = await fetch(`http://localhost:8000/api/guidelines/${idToFetch}`);
        const gData = await gRes.json();
        
        // 2. Fetch previously saved Assessments for this Trust
        const aRes = await fetch(`http://localhost:8000/api/assessments/${idToFetch}`);
        const aData = await aRes.json();
        
        // Map assessments by recommendation_id for easy lookup
        const aMap = {};
        aData.forEach(a => { aMap[a.recommendation_id] = a; });
        
        setGuideline(gData);
        setAssessments(aMap);
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch data", err);
      }
    };
    fetchData();
  }, [guidelineId]);

  // When changing pages, load the saved assessment into the form
  useEffect(() => {
    if (!guideline || guideline.recommendations.length === 0) return;
    
    const rec = guideline.recommendations[currentIndex];
    const saved = assessments[rec.id];
    
    if (saved) {
      setFormData({
        relevant: saved.relevant ?? true,
        meet: saved.meet || "",
        evidence: saved.evidence || "",
        action: saved.action || "",
        action_status: saved.action_status || "Not Started",
        lead: saved.lead || "",
        deadline: saved.deadline ? saved.deadline.substring(0,10) : ""
      });
    } else {
      // Defaults
      setFormData({
        relevant: true, meet: "", evidence: "", action: "", action_status: "Not Started", lead: "", deadline: ""
      });
    }
  }, [currentIndex, guideline, assessments]);

  const saveCurrentAssessment = async () => {
    const rec = guideline.recommendations[currentIndex];
    const payload = { ...formData, recommendation_id: rec.id };
    
    try {
      const res = await fetch(`http://localhost:8000/api/assessments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const savedData = await res.json();
      
      // Update local state
      setAssessments(prev => ({ ...prev, [rec.id]: savedData }));
    } catch (err) {
      console.error("Failed to save", err);
    }
  };

  const handleNext = async () => {
    await saveCurrentAssessment();
    if (currentIndex < guideline.recommendations.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrev = async () => {
    await saveCurrentAssessment();
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  if (loading) return <div className="p-8">Loading Guideline Data...</div>;
  if (!guideline || guideline.recommendations.length === 0) return <div className="p-8">No recommendations found.</div>;

  const currentRec = guideline.recommendations[currentIndex];
  const showActionPlan = formData.meet === "No" || formData.meet === "Partial";

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-100">
      
      <div className="bg-nhs-pale border-b-4 border-white px-6 py-4 flex justify-between items-center shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-nhs-dark tracking-wide">{guideline.nice_id}: {guideline.name}</h2>
          <p className="text-sm font-medium text-nhs-dark mt-1">Recommendation {currentIndex + 1} of {guideline.recommendations.length}</p>
        </div>
        <div className="flex gap-4">
          <button onClick={handlePrev} disabled={currentIndex === 0} className="btn-nhs-secondary disabled:opacity-50">Previous & Save</button>
          <button onClick={handleNext} disabled={currentIndex === guideline.recommendations.length - 1} className="btn-nhs-primary disabled:opacity-50">Save & Next</button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT SIDE: NICE Guidance */}
        <div className="w-1/2 p-8 overflow-y-auto bg-nhs-blue text-white border-r-8 border-nhs-dark-blue">
          <span className="inline-block px-3 py-1 bg-white text-nhs-blue border border-nhs-blue rounded text-sm font-bold mb-6">REC {currentRec.guideline_rec}</span>
          <h3 className="text-2xl font-bold mb-4 leading-relaxed">{currentRec.rec_text}</h3>
          {(currentRec.publish_info || currentRec.rec_year) && (
            <p className="text-sm font-medium mt-8 opacity-80">
              Published: {currentRec.publish_info || currentRec.rec_year}
            </p>
          )}
        </div>

        {/* RIGHT SIDE: Assessment Form */}
        <div className="w-1/2 p-8 overflow-y-auto bg-gray-50">
          <div className="max-w-xl mx-auto space-y-8 pb-12">
            
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <label className="block text-sm font-semibold text-gray-700 mb-3">Is this recommendation relevant to your Trust?</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={formData.relevant === true} onChange={() => setFormData({...formData, relevant: true})} className="w-4 h-4 text-blue-600" />
                  <span>Yes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={formData.relevant === false} onChange={() => setFormData({...formData, relevant: false})} className="w-4 h-4 text-blue-600" />
                  <span>No</span>
                </label>
              </div>
            </div>

            {formData.relevant && (
              <div className="bg-white p-6 rounded-lg shadow-sm border animate-in fade-in">
                <label className="block text-sm font-semibold text-gray-700 mb-3">Does your service meet this recommendation?</label>
                <select 
                  value={formData.meet} 
                  onChange={(e) => setFormData({...formData, meet: e.target.value})}
                  className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select status...</option>
                  <option value="Yes">Yes - Fully Met</option>
                  <option value="Partial">Partial - Needs Action</option>
                  <option value="No">No - Needs Action</option>
                </select>

                <label className="block text-sm font-semibold text-gray-700 mt-6 mb-2">Evidence of current activity</label>
                <textarea 
                  value={formData.evidence}
                  onChange={(e) => setFormData({...formData, evidence: e.target.value})}
                  className="w-full border rounded-md p-3 text-sm focus:ring-blue-500 focus:border-blue-500" 
                  rows="4" 
                  placeholder="Record your evidence here..."
                />
              </div>
            )}

            {formData.relevant && showActionPlan && (
              <div className="bg-orange-50 border border-orange-200 p-6 rounded-lg shadow-sm animate-in fade-in">
                <h4 className="text-orange-800 font-bold mb-4">Action Plan Details</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Required Action</label>
                    <textarea value={formData.action} onChange={(e) => setFormData({...formData, action: e.target.value})} className="w-full border rounded p-2" rows="2" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Lead Person</label>
                      <input type="text" value={formData.lead} onChange={(e) => setFormData({...formData, lead: e.target.value})} className="w-full border rounded p-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Deadline</label>
                      <input type="date" value={formData.deadline} onChange={(e) => setFormData({...formData, deadline: e.target.value})} className="w-full border rounded p-2" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Action Status</label>
                    <select value={formData.action_status} onChange={(e) => setFormData({...formData, action_status: e.target.value})} className="w-full border rounded p-2">
                      <option value="Not Started">Not Started</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
