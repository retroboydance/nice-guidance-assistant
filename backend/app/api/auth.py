from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import jwt
from passlib.context import CryptContext
from pydantic import BaseModel

from app.models.schema import User, Guideline
from app.api.deps import get_db, get_current_trust_id, get_app_base_url

SECRET_KEY = "super-secret-nhs-key-for-poc"
ALGORITHM = "HS256"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
router = APIRouter(prefix="/auth", tags=["auth"])

class LoginRequest(BaseModel):
    email: str
    password: str

@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not pwd_context.verify(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
        
    # Generate token
    expire = datetime.utcnow() + timedelta(days=30)
    token_data = {
        "sub": str(user.id), 
        "role": user.role, 
        "trust_id": user.trust_id,
        "exp": expire
    }
    token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)
    
    return {
        "access_token": token, 
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "trust_id": user.trust_id
        }
    }

class MagicLinkRequest(BaseModel):
    target_user_id: int
    guideline_id: int

@router.get("/users")
def get_users(db: Session = Depends(get_db)):
    users = db.query(User).all()
    return [{"id": u.id, "email": u.email, "name": u.name, "role": u.role} for u in users]

@router.post("/magic-link/generate")
def generate_magic_link(req: MagicLinkRequest, request: Request, db: Session = Depends(get_db)):
    target_user = db.query(User).filter(User.id == req.target_user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    expire = datetime.utcnow() + timedelta(hours=48)
    token_data = {
        "sub": str(target_user.id),
        "role": target_user.role,
        "trust_id": target_user.trust_id,
        "target_guideline": req.guideline_id,
        "exp": expire,
        "magic": True
    }
    token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)
    base_url = get_app_base_url(request)
    link = f"{base_url}/access?token={token}"
    return {"link": link}

class MagicConsumeRequest(BaseModel):
    token: str

@router.post("/magic-link/consume")
def consume_magic_link(req: MagicConsumeRequest, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(req.token, SECRET_KEY, algorithms=[ALGORITHM])
        if not payload.get("magic"):
            raise HTTPException(status_code=400, detail="Invalid link type")
            
        user_id = int(payload.get("sub"))
        user = db.query(User).filter(User.id == user_id).first()
        
        # Issue standard session token
        expire = datetime.utcnow() + timedelta(days=30)
        session_token_data = {
            "sub": str(user.id), 
            "role": user.role, 
            "trust_id": user.trust_id,
            "exp": expire
        }
        session_token = jwt.encode(session_token_data, SECRET_KEY, algorithm=ALGORITHM)
        
        return {
            "access_token": session_token,
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "role": user.role,
                "trust_id": user.trust_id
            },
            "target_guideline": payload.get("target_guideline")
        }
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired secure link")

class InviteReviewerRequest(BaseModel):
    email: str
    guideline_id: int

@router.post("/magic-link/invite")
def invite_reviewer(
    req: InviteReviewerRequest,
    request: Request,
    db: Session = Depends(get_db),
    trust_id: int = Depends(get_current_trust_id)
):
    clean_email = req.email.strip().lower()
    if not clean_email or "@" not in clean_email:
        raise HTTPException(status_code=400, detail="Please enter a valid NHS email address")

    # Find or auto-provision reviewer user for this Trust
    user = db.query(User).filter(User.email == clean_email).first()
    if not user:
        username_part = clean_email.split("@")[0]
        name = " ".join([part.capitalize() for part in username_part.replace(".", " ").replace("_", " ").split()])
        user = User(
            email=clean_email,
            name=name,
            hashed_password=pwd_context.hash("MagicAccessOnly!"),
            role="reviewer",
            trust_id=trust_id
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    guideline = db.query(Guideline).filter(Guideline.id == req.guideline_id).first()
    if not guideline:
        raise HTTPException(status_code=404, detail="Guideline not found")

    expire = datetime.utcnow() + timedelta(days=7)  # 7-day link
    token_data = {
        "sub": str(user.id),
        "role": user.role,
        "trust_id": user.trust_id,
        "target_guideline": guideline.id,
        "exp": expire,
        "magic": True
    }
    token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)
    base_url = get_app_base_url(request)
    link = f"{base_url}/access?token={token}"

    return {
        "link": link,
        "email": user.email,
        "user_name": user.name,
        "nice_id": guideline.nice_id,
        "guideline_name": guideline.name
    }

