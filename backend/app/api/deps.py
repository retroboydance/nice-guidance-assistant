from fastapi import Header, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
from typing import Generator
import jwt
from app.models.database import SessionLocal

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

def get_db() -> Generator:
    """Dependency to get a database session for a request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_trust_id(token: str = Depends(oauth2_scheme)) -> int:
    """Extracts the trust_id from the JWT token to enforce data isolation."""
    try:
        payload = jwt.decode(token, "super-secret-nhs-key-for-poc", algorithms=["HS256"])
        trust_id = payload.get("trust_id")
        if trust_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return trust_id
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
