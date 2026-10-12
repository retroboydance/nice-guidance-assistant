from fastapi import Header, HTTPException, Depends, Request
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

def get_app_base_url(request: Request) -> str:
    """
    Intelligently determines the base URL of the frontend application.
    Checks:
    1. APP_BASE_URL environment variable
    2. Origin header (e.g. http://10.45.2.123:8080)
    3. Referer header
    4. X-Forwarded-Host (from Nginx)
    5. Host header
    """
    import os
    from urllib.parse import urlparse

    env_url = os.getenv("APP_BASE_URL")
    if env_url:
        return env_url.rstrip("/")

    origin = request.headers.get("origin")
    if origin:
        return origin.rstrip("/")

    referer = request.headers.get("referer")
    if referer:
        parsed = urlparse(referer)
        return f"{parsed.scheme}://{parsed.netloc}".rstrip("/")

    forwarded_host = request.headers.get("x-forwarded-host")
    forwarded_proto = request.headers.get("x-forwarded-proto", "http")
    if forwarded_host:
        return f"{forwarded_proto}://{forwarded_host}".rstrip("/")

    host = request.headers.get("host")
    if host:
        return f"http://{host}".rstrip("/")

    return "http://localhost:5173"

