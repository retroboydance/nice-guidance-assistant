import os
import sys

# Add the project root to the path so we can import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models.database import SessionLocal, engine
from app.models.schema import Base, Trust, User
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def seed_users():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # 1. Ensure Trusts exist
    trust1 = db.query(Trust).filter_by(name="Liverpool Heart and Chest Hospital").first()
    if not trust1:
        trust1 = Trust(name="Liverpool Heart and Chest Hospital", group_name="CPA Group")
        db.add(trust1)
        
    trust2 = db.query(Trust).filter_by(name="Royal Papworth Hospital").first()
    if not trust2:
        trust2 = Trust(name="Royal Papworth Hospital", group_name="CPA Group")
        db.add(trust2)
        
    db.commit()
    
    # 2. Ensure Users exist
    # Admin User for LHCH
    admin_email = "admin@lhch.nhs.uk"
    if not db.query(User).filter_by(email=admin_email).first():
        user = User(
            email=admin_email,
            name="Clinical Lead (LHCH)",
            hashed_password=pwd_context.hash("Welcome1!"),
            role="admin",
            trust_id=trust1.id
        )
        db.add(user)

    # Reviewer User for Papworth
    reviewer_email = "reviewer@papworth.nhs.uk"
    if not db.query(User).filter_by(email=reviewer_email).first():
        user = User(
            email=reviewer_email,
            name="Audit Nurse (Papworth)",
            hashed_password=pwd_context.hash("Welcome1!"),
            role="reviewer",
            trust_id=trust2.id
        )
        db.add(user)
        
    db.commit()
    print("Successfully seeded Trusts and Users!")
    print("--------------------------------------------------")
    print(f"Login 1 (LHCH): {admin_email} / Welcome1!")
    print(f"Login 2 (Papworth): {reviewer_email} / Welcome1!")
    
if __name__ == "__main__":
    seed_users()
