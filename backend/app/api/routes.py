import io
import csv
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Response
from sqlalchemy.orm import Session

from app.models.schema import Guideline, Recommendation, Assessment, RecommendationHistory
from app.api import schemas, deps

router = APIRouter()

# ==========================================
# 1. GUIDELINES (Global Data)
# ==========================================

@router.get("/guidelines", response_model=List[schemas.GuidelineResponse])
def get_guidelines(db: Session = Depends(deps.get_db)):
    """List all available NICE guidelines."""
    return db.query(Guideline).all()

@router.get("/guidelines/{guideline_id}", response_model=schemas.GuidelineDetailResponse)
def get_guideline_details(guideline_id: int, db: Session = Depends(deps.get_db)):
    """Get a specific guideline and all of its recommendations."""
    guideline = db.query(Guideline).filter(Guideline.id == guideline_id).first()
    if not guideline:
        raise HTTPException(status_code=404, detail="Guideline not found")
    return guideline

# ==========================================
# 2. ASSESSMENTS (Tenant Isolated Data)
# ==========================================

@router.get("/assessments/{guideline_id}", response_model=List[schemas.AssessmentResponse])
def get_trust_assessments_for_guideline(
    guideline_id: int, 
    db: Session = Depends(deps.get_db),
    trust_id: int = Depends(deps.get_current_trust_id)
):
    """
    Get all saved answers for a specific guideline.
    CRITICAL: This is strictly filtered by the current user's trust_id.
    """
    return db.query(Assessment).join(Recommendation).filter(
        Assessment.trust_id == trust_id,
        Recommendation.guideline_id == guideline_id
    ).all()

@router.post("/assessments", response_model=schemas.AssessmentResponse)
def auto_save_assessment(
    payload: schemas.AssessmentUpdate,
    db: Session = Depends(deps.get_db),
    trust_id: int = Depends(deps.get_current_trust_id)
):
    """
    Auto-save endpoint. 
    If the trust has already answered this recommendation, update it.
    If not, create a new row.
    """
    assessment = db.query(Assessment).filter(
        Assessment.trust_id == trust_id,
        Assessment.recommendation_id == payload.recommendation_id
    ).first()

    if assessment:
        # Update existing
        for key, value in payload.model_dump(exclude_unset=True).items():
            setattr(assessment, key, value)
    else:
        # Create new
        assessment = Assessment(**payload.model_dump(), trust_id=trust_id)
        db.add(assessment)

    db.commit()
    db.refresh(assessment)
    return assessment

# ==========================================
# 3. REPORTING
# ==========================================

@router.get("/reports/{guideline_id}/compliance", response_model=schemas.ComplianceReportResponse)
def get_compliance_report(
    guideline_id: int,
    db: Session = Depends(deps.get_db),
    trust_id: int = Depends(deps.get_current_trust_id)
):
    """
    Calculates the Compliance % and generates the Action Plan on the fly.
    """
    recommendations = db.query(Recommendation).filter(Recommendation.guideline_id == guideline_id).all()
    
    # Grab all assessments the trust has made for this guideline
    assessments = db.query(Assessment).join(Recommendation).filter(
        Assessment.trust_id == trust_id,
        Recommendation.guideline_id == guideline_id
    ).all()
    
    # Map them for easy lookup
    assessment_map = {a.recommendation_id: a for a in assessments}
    
    relevant_count = 0
    met_count = 0
    action_plan = []

    for rec in recommendations:
        assessment = assessment_map.get(rec.id)
        if not assessment:
            continue
            
        if assessment.relevant:
            relevant_count += 1
            # "Partial" does NOT count as met (as per our GEMINI.md rules)
            if assessment.meet == "Yes":
                met_count += 1
            elif assessment.meet in ["No", "Partial"]:
                action_plan.append({
                    "guideline": rec.guideline,
                    "recommendation": rec,
                    "assessment": assessment
                })
                
    compliance_percentage = 0.0
    if relevant_count > 0:
        compliance_percentage = round((met_count / relevant_count) * 100, 1)

    return {
        "guideline_id": guideline_id,
        "total_recommendations": len(recommendations),
        "relevant_count": relevant_count,
        "met_count": met_count,
        "compliance_percentage": compliance_percentage,
        "action_plan": action_plan
    }

@router.get("/reports/{guideline_id}/export/csv")
def export_guideline_assessment_csv(
    guideline_id: int,
    db: Session = Depends(deps.get_db),
    trust_id: int = Depends(deps.get_current_trust_id)
):
    """
    Exports a comprehensive CSV for a specific guideline's baseline assessment.
    Contains all recommendations, responses, compliance status, and action plans.
    """
    guideline = db.query(Guideline).filter(Guideline.id == guideline_id).first()
    if not guideline:
        raise HTTPException(status_code=404, detail="Guideline not found")

    recommendations = db.query(Recommendation).filter(Recommendation.guideline_id == guideline_id).all()
    assessments = db.query(Assessment).join(Recommendation).filter(
        Assessment.trust_id == trust_id,
        Recommendation.guideline_id == guideline_id
    ).all()
    assessment_map = {a.recommendation_id: a for a in assessments}

    output = io.StringIO()
    writer = csv.writer(output)

    # Header Row
    writer.writerow([
        "Guideline Ref",
        "Guideline Title",
        "Recommendation Number",
        "Recommendation Text",
        "Published Info",
        "Relevant to Trust",
        "Meets Recommendation",
        "Evidence of Current Activity",
        "Required Action",
        "Action Status",
        "Lead Person",
        "Deadline",
        "Risk",
        "Cost",
        "Capacity",
        "Completed By",
        "Latest Progress Update"
    ])

    for rec in recommendations:
        a = assessment_map.get(rec.id)
        
        relevant_str = "Not Assessed"
        meet_str = "Not Assessed"
        evidence_str = ""
        action_str = ""
        action_status_str = ""
        lead_str = ""
        deadline_str = ""
        risk_str = ""
        cost_str = ""
        capacity_str = ""
        completed_by_str = ""
        latest_update_str = ""

        if a:
            if a.relevant is True:
                relevant_str = "Yes"
            elif a.relevant is False:
                relevant_str = "No"

            meet_str = a.meet or "Not Assessed"
            evidence_str = a.evidence or ""
            action_str = a.action or ""
            action_status_str = a.action_status or ""
            lead_str = a.lead or ""
            deadline_str = a.deadline.strftime("%Y-%m-%d") if a.deadline else ""
            risk_str = a.risk or ""
            cost_str = a.cost or ""
            capacity_str = a.capacity or ""
            completed_by_str = a.completed_by or ""
            if a.updates and len(a.updates) > 0:
                latest_update_str = f"[{a.updates[0].created_at.strftime('%Y-%m-%d')}] {a.updates[0].update_text}"

        writer.writerow([
            guideline.nice_id,
            guideline.name,
            rec.guideline_rec,
            rec.rec_text,
            rec.publish_info or (str(rec.rec_year) if rec.rec_year else ""),
            relevant_str,
            meet_str,
            evidence_str,
            action_str,
            action_status_str,
            lead_str,
            deadline_str,
            risk_str,
            cost_str,
            capacity_str,
            completed_by_str,
            latest_update_str
        ])

    csv_content = "\ufeff" + output.getvalue()
    filename = f"{guideline.nice_id}_Assessment_Report.csv"
    return Response(
        content=csv_content.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.get("/reports/{guideline_id}/export/action-plan/csv")
def export_guideline_action_plan_csv(
    guideline_id: int,
    db: Session = Depends(deps.get_db),
    trust_id: int = Depends(deps.get_current_trust_id)
):
    """
    Exports the Action Plan exceptions (Relevant=Yes, Met in [No, Partial]) for a specific guideline.
    """
    guideline = db.query(Guideline).filter(Guideline.id == guideline_id).first()
    if not guideline:
        raise HTTPException(status_code=404, detail="Guideline not found")

    assessments = db.query(Assessment).join(Recommendation).filter(
        Assessment.trust_id == trust_id,
        Recommendation.guideline_id == guideline_id,
        Assessment.relevant == True,
        Assessment.meet.in_(["No", "Partial"])
    ).all()

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "Guideline Ref",
        "Guideline Title",
        "Recommendation Number",
        "Recommendation Text",
        "Compliance Status",
        "Required Action",
        "Lead Person",
        "Deadline",
        "Action Status",
        "Risk",
        "Cost",
        "Capacity",
        "Latest Progress Update"
    ])

    for a in assessments:
        rec = a.recommendation
        deadline_str = a.deadline.strftime("%Y-%m-%d") if a.deadline else ""
        latest_update_str = ""
        if a.updates and len(a.updates) > 0:
            latest_update_str = f"[{a.updates[0].created_at.strftime('%Y-%m-%d')}] {a.updates[0].update_text}"

        writer.writerow([
            guideline.nice_id,
            guideline.name,
            rec.guideline_rec,
            rec.rec_text,
            a.meet,
            a.action or "",
            a.lead or "",
            deadline_str,
            a.action_status or "",
            a.risk or "",
            a.cost or "",
            a.capacity or "",
            latest_update_str
        ])

    csv_content = "\ufeff" + output.getvalue()
    filename = f"{guideline.nice_id}_Action_Plan.csv"
    return Response(
        content=csv_content.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.get("/actions/export/csv")
def export_global_actions_csv(
    db: Session = Depends(deps.get_db),
    trust_id: int = Depends(deps.get_current_trust_id)
):
    """
    Exports the global action plan across all guidelines as a CSV.
    """
    assessments = db.query(Assessment).join(Recommendation).filter(
        Assessment.trust_id == trust_id,
        Assessment.relevant == True,
        Assessment.meet.in_(["No", "Partial"])
    ).all()

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "Guideline Ref",
        "Guideline Title",
        "Recommendation Number",
        "Recommendation Text",
        "Compliance Status",
        "Required Action",
        "Lead Person",
        "Deadline",
        "Action Status",
        "Latest Progress Update"
    ])

    for a in assessments:
        rec = a.recommendation
        guideline = rec.guideline
        deadline_str = a.deadline.strftime("%Y-%m-%d") if a.deadline else ""
        latest_update_str = ""
        if a.updates and len(a.updates) > 0:
            latest_update_str = f"[{a.updates[0].created_at.strftime('%Y-%m-%d')}] {a.updates[0].update_text}"

        writer.writerow([
            guideline.nice_id,
            guideline.name,
            rec.guideline_rec,
            rec.rec_text,
            a.meet,
            a.action or "",
            a.lead or "",
            deadline_str,
            a.action_status or "",
            latest_update_str
        ])

    csv_content = "\ufeff" + output.getvalue()
    return Response(
        content=csv_content.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="Trust_Action_Tracker.csv"'}
    )


# ==========================================
# 4. ACTION TRACKER (Global)
# ==========================================

@router.get("/actions", response_model=List[schemas.ActionPlanItem])
def get_global_action_tracker(
    db: Session = Depends(deps.get_db),
    trust_id: int = Depends(deps.get_current_trust_id)
):
    """
    Returns all assessments across ALL guidelines that are Relevant = Yes, 
    but Met = No/Partial.
    """
    assessments = db.query(Assessment).join(Recommendation).filter(
        Assessment.trust_id == trust_id,
        Assessment.relevant == True,
        Assessment.meet.in_(["No", "Partial"])
    ).all()
    
    result = []
    for a in assessments:
        result.append({
            "guideline": a.recommendation.guideline,
            "recommendation": a.recommendation,
            "assessment": a
        })
    return result

@router.post("/assessments/{assessment_id}/updates", response_model=schemas.ActionUpdateResponse)
def add_action_update(
    assessment_id: int,
    payload: schemas.ActionUpdateBase,
    db: Session = Depends(deps.get_db),
    trust_id: int = Depends(deps.get_current_trust_id)
):
    """Adds a new dated progress update to a specific assessment action."""
    # Ensure the assessment belongs to the trust
    assessment = db.query(Assessment).filter(
        Assessment.id == assessment_id, 
        Assessment.trust_id == trust_id
    ).first()
    
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
        
    from app.models.schema import ActionUpdate
    new_update = ActionUpdate(
        assessment_id=assessment_id,
        update_text=payload.update_text
    )
    db.add(new_update)
    db.commit()
    db.refresh(new_update)
    return new_update

# ==========================================
# 5. ADMIN INGESTION
# ==========================================

from app.services.smart_excel_parser import SmartExcelParser
from app.services.nice_fetcher import NiceFetcher, NiceFetcherError
from app.services.seed_manager import SeedManager


@router.post("/admin/guidelines/fetch")
def fetch_guideline_from_nice(
    payload: dict,
    db: Session = Depends(deps.get_db)
):
    """Admin endpoint to auto-fetch a guideline and all its recommendations directly from NICE."""
    code = payload.get("code") or payload.get("nice_id")
    if not code:
        raise HTTPException(status_code=400, detail="Missing guideline code.")
    try:
        parsed = NiceFetcher.fetch_guideline(code)
        guideline = SeedManager.persist_guideline(parsed, db)
        db.commit()
        return {
            "message": f"Successfully fetched '{guideline.name}' ({guideline.nice_id}) from NICE with {len(parsed.recommendations)} recommendations.",
            "nice_id": guideline.nice_id,
            "name": guideline.name,
            "recommendation_count": len(parsed.recommendations),
        }
    except NiceFetcherError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching from NICE: {e}")


@router.post("/admin/guidelines/upload")
async def upload_guideline_csv(
    nice_id: str = Form(None),
    name: str = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(deps.get_db)
):
    """Admin endpoint to ingest or update a guideline via raw NICE Excel spreadsheet (.xlsx) or CSV."""
    content = await file.read()
    filename = file.filename or ""

    # Check if uploaded file is an Excel file
    if filename.endswith(".xlsx") or filename.endswith(".xls") or (b"PK\x03\x04" in content[:4]):
        try:
            parsed = SmartExcelParser.parse(content, filename=filename)
            if nice_id:
                parsed.code = nice_id
            if name:
                parsed.title = name
            guideline = SeedManager.persist_guideline(parsed, db)
            db.commit()
            return {
                "message": f"Successfully processed '{guideline.name}' ({guideline.nice_id}). Ingested {len(parsed.recommendations)} recommendations.",
                "nice_id": guideline.nice_id,
                "name": guideline.name,
                "recommendation_count": len(parsed.recommendations),
            }
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse Excel file: {e}")

    # Fallback / standard CSV parsing
    if not nice_id or not name:
        try:
            parsed = SmartExcelParser.parse(content, filename=filename)
            guideline = SeedManager.persist_guideline(parsed, db)
            db.commit()
            return {
                "message": f"Successfully processed '{guideline.name}' ({guideline.nice_id}). Ingested {len(parsed.recommendations)} recommendations.",
                "nice_id": guideline.nice_id,
                "name": guideline.name,
                "recommendation_count": len(parsed.recommendations),
            }
        except Exception:
            raise HTTPException(status_code=400, detail="nice_id and name are required for CSV uploads.")

    # 1. Get or Create Guideline
    guideline = db.query(Guideline).filter(Guideline.nice_id == nice_id).first()
    if not guideline:
        guideline = Guideline(nice_id=nice_id, name=name)
        db.add(guideline)
        db.commit()
        db.refresh(guideline)
    else:
        guideline.name = name
        db.commit()

    # 2. Parse CSV
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("cp1252", errors="replace")
        
    reader = csv.reader(io.StringIO(text))
    
    changes = 0
    added = 0
    
    for row in reader:
        if len(row) < 2:
            continue
            
        rec_num = row[0].strip()
        rec_text = row[1].strip()
        publish_info = row[2].strip() if len(row) > 2 else None
        
        # Heuristic to skip header rows
        if rec_num.lower() in ["number", "rec", "guideline number", ""]:
            continue
            
        if not rec_text:
            continue
            
        # Check if rec exists
        rec = db.query(Recommendation).filter(
            Recommendation.guideline_id == guideline.id,
            Recommendation.guideline_rec == rec_num
        ).first()
        
        if rec:
            has_changes = False
            if rec.rec_text != rec_text:
                # Audit trail
                history = RecommendationHistory(
                    recommendation_id=rec.id,
                    old_text=rec.rec_text
                )
                db.add(history)
                rec.rec_text = rec_text
                has_changes = True
                
            if publish_info and rec.publish_info != publish_info:
                rec.publish_info = publish_info
                has_changes = True
                
            if has_changes:
                changes += 1
        else:
            new_rec = Recommendation(
                guideline_id=guideline.id,
                guideline_rec=rec_num,
                rec_text=rec_text,
                publish_info=publish_info
            )
            db.add(new_rec)
            added += 1
            
    db.commit()
    return {"message": f"Successfully processed. Added {added} and Updated {changes} recommendations for {nice_id}."}
