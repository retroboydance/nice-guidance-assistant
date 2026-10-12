from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict

# ==========================================
# ASSESSMENT SCHEMAS
# ==========================================

class AssessmentBase(BaseModel):
    relevant: Optional[bool] = None
    meet: Optional[str] = None
    evidence: Optional[str] = None
    action: Optional[str] = None
    action_status: Optional[str] = "Not Started"
    risk: Optional[str] = None
    cost: Optional[str] = None
    capacity: Optional[str] = None
    deadline: Optional[date] = None
    lead: Optional[str] = None
    completed_by: Optional[str] = None

class AssessmentUpdate(AssessmentBase):
    """Payload sent by the frontend on Auto-Save."""
    recommendation_id: int

class ActionUpdateBase(BaseModel):
    update_text: str

class ActionUpdateResponse(ActionUpdateBase):
    id: int
    assessment_id: int
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class AssessmentResponse(AssessmentBase):
    id: int
    trust_id: int
    recommendation_id: int
    updates: List[ActionUpdateResponse] = []
    
    model_config = ConfigDict(from_attributes=True)

# ==========================================
# RECOMMENDATION & GUIDELINE SCHEMAS
# ==========================================

class RecommendationResponse(BaseModel):
    id: int
    guideline_id: int
    guideline_rec: str
    rec_text: str
    rec_year: Optional[int] = None
    publish_info: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class GuidelineResponse(BaseModel):
    id: int
    nice_id: str
    name: str

    model_config = ConfigDict(from_attributes=True)

class GuidelineDetailResponse(GuidelineResponse):
    """Returns the guideline along with all its recommendations."""
    recommendations: List[RecommendationResponse]

# ==========================================
# REPORTING SCHEMAS
# ==========================================

class ActionPlanItem(BaseModel):
    guideline: GuidelineResponse
    recommendation: RecommendationResponse
    assessment: AssessmentResponse

class ComplianceReportResponse(BaseModel):
    guideline_id: int
    total_recommendations: int
    relevant_count: int
    met_count: int
    compliance_percentage: float
    action_plan: List[ActionPlanItem]
