from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
import jwt
from passlib.context import CryptContext

from app.models.schema import User, Guideline, GuidelineAssignment, Trust
from app.api.deps import get_db, get_current_trust_id
from app.api.auth import SECRET_KEY, ALGORITHM, pwd_context

router = APIRouter(prefix="/admin", tags=["admin_users"])

# ==========================================
# PYDANTIC SCHEMAS
# ==========================================

class UserCreateRequest(BaseModel):
    name: str
    email: str
    role: Optional[str] = "reviewer"
    password: Optional[str] = "Welcome1!"

class UserUpdateRequest(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None

class AssignmentCreateRequest(BaseModel):
    user_id: int
    guideline_id: int
    notes: Optional[str] = None

# ==========================================
# USER MANAGEMENT ENDPOINTS
# ==========================================

@router.get("/users")
def list_trust_users(
    db: Session = Depends(get_db),
    trust_id: int = Depends(get_current_trust_id)
):
    """List all users belonging to the current Trust."""
    users = db.query(User).filter(User.trust_id == trust_id).all()
    results = []
    for u in users:
        # Count assignments for this user
        assignment_count = db.query(GuidelineAssignment).filter(GuidelineAssignment.user_id == u.id).count()
        results.append({
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "trust_id": u.trust_id,
            "assignment_count": assignment_count
        })
    return results

@router.post("/users")
def create_user(
    req: UserCreateRequest,
    db: Session = Depends(get_db),
    trust_id: int = Depends(get_current_trust_id)
):
    """Create a new user within the current Trust."""
    clean_email = req.email.strip().lower()
    if not clean_email or "@" not in clean_email:
        raise HTTPException(status_code=400, detail="A valid email address is required.")

    existing = db.query(User).filter(User.email == clean_email).first()
    if existing:
        raise HTTPException(status_code=400, detail="A user with this email already exists.")

    password_to_hash = req.password.strip() if req.password else "Welcome1!"
    new_user = User(
        name=req.name.strip(),
        email=clean_email,
        role=req.role if req.role in ["admin", "reviewer", "group_lead"] else "reviewer",
        hashed_password=pwd_context.hash(password_to_hash),
        trust_id=trust_id
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "id": new_user.id,
        "name": new_user.name,
        "email": new_user.email,
        "role": new_user.role,
        "trust_id": new_user.trust_id
    }

@router.put("/users/{user_id}")
def update_user(
    user_id: int,
    req: UserUpdateRequest,
    db: Session = Depends(get_db),
    trust_id: int = Depends(get_current_trust_id)
):
    """Update a user's role, name, or reset their password."""
    user = db.query(User).filter(User.id == user_id, User.trust_id == trust_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found in this Trust.")

    if req.name is not None and req.name.strip():
        user.name = req.name.strip()
    if req.role is not None and req.role in ["admin", "reviewer", "group_lead"]:
        user.role = req.role
    if req.password is not None and req.password.strip():
        user.hashed_password = pwd_context.hash(req.password.strip())

    db.commit()
    return {"status": "success", "message": f"User {user.name} updated successfully."}

@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    trust_id: int = Depends(get_current_trust_id)
):
    """Remove a user from the Trust."""
    user = db.query(User).filter(User.id == user_id, User.trust_id == trust_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found in this Trust.")

    # Remove any assignments for this user first
    db.query(GuidelineAssignment).filter(GuidelineAssignment.user_id == user_id).delete()

    db.delete(user)
    db.commit()
    return {"status": "success", "message": "User and their assignments removed."}

# ==========================================
# GUIDELINE ASSIGNMENT ENDPOINTS
# ==========================================

@router.get("/assignments")
def list_assignments(
    db: Session = Depends(get_db),
    trust_id: int = Depends(get_current_trust_id)
):
    """List all guideline assignments within the current Trust."""
    assignments = db.query(GuidelineAssignment).filter(GuidelineAssignment.trust_id == trust_id).all()
    results = []
    for a in assignments:
        # Pre-generate a fresh 7-day magic link for convenience
        expire = datetime.utcnow() + timedelta(days=7)
        token_data = {
            "sub": str(a.user.id),
            "role": a.user.role,
            "trust_id": a.user.trust_id,
            "target_guideline": a.guideline.id,
            "exp": expire,
            "magic": True
        }
        magic_token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)
        magic_link = f"http://localhost:5173/access?token={magic_token}"

        results.append({
            "id": a.id,
            "user_id": a.user_id,
            "user_name": a.user.name,
            "user_email": a.user.email,
            "guideline_id": a.guideline_id,
            "nice_id": a.guideline.nice_id,
            "guideline_name": a.guideline.name,
            "status": a.status,
            "assigned_at": a.assigned_at.strftime("%Y-%m-%d %H:%M"),
            "notes": a.notes or "",
            "magic_link": magic_link
        })
    return results

@router.post("/assignments")
def create_assignment(
    req: AssignmentCreateRequest,
    db: Session = Depends(get_db),
    trust_id: int = Depends(get_current_trust_id)
):
    """Assign a guideline to a user and generate a magic link."""
    user = db.query(User).filter(User.id == req.user_id, User.trust_id == trust_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Reviewer not found in this Trust.")

    guideline = db.query(Guideline).filter(Guideline.id == req.guideline_id).first()
    if not guideline:
        raise HTTPException(status_code=404, detail="Guideline not found.")

    # Check if already assigned
    existing = db.query(GuidelineAssignment).filter(
        GuidelineAssignment.trust_id == trust_id,
        GuidelineAssignment.user_id == req.user_id,
        GuidelineAssignment.guideline_id == req.guideline_id
    ).first()

    if existing:
        if req.notes:
            existing.notes = req.notes
        db.commit()
        assignment = existing
    else:
        assignment = GuidelineAssignment(
            trust_id=trust_id,
            user_id=req.user_id,
            guideline_id=req.guideline_id,
            notes=req.notes
        )
        db.add(assignment)
        db.commit()
        db.refresh(assignment)

    # Generate 7-day magic link
    expire = datetime.utcnow() + timedelta(days=7)
    token_data = {
        "sub": str(user.id),
        "role": user.role,
        "trust_id": user.trust_id,
        "target_guideline": guideline.id,
        "exp": expire,
        "magic": True
    }
    magic_token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)
    magic_link = f"http://localhost:5173/access?token={magic_token}"

    return {
        "id": assignment.id,
        "user_name": user.name,
        "user_email": user.email,
        "nice_id": guideline.nice_id,
        "guideline_name": guideline.name,
        "status": assignment.status,
        "magic_link": magic_link
    }

@router.delete("/assignments/{assignment_id}")
def delete_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    trust_id: int = Depends(get_current_trust_id)
):
    """Remove a guideline assignment."""
    assignment = db.query(GuidelineAssignment).filter(
        GuidelineAssignment.id == assignment_id,
        GuidelineAssignment.trust_id == trust_id
    ).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found.")

    db.delete(assignment)
    db.commit()
    return {"status": "success", "message": "Assignment deleted."}
