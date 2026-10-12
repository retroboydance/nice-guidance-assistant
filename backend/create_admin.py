import argparse
import sys
import os

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.models.database import SessionLocal, engine
from app.models.schema import Base, Trust, User
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def setup_admin(email, name, trust_name, password):
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # 1. Find or create Trust
        trust = db.query(Trust).filter(Trust.name == trust_name).first()
        if not trust:
            trust = Trust(name=trust_name, group_name="CPA Group")
            db.add(trust)
            db.commit()
            db.refresh(trust)
            print(f"[+] Created new Trust tenant: '{trust.name}' (ID: {trust.id})")
        else:
            print(f"[i] Using existing Trust tenant: '{trust.name}' (ID: {trust.id})")

        # 2. Find or create Master Admin User
        clean_email = email.strip().lower()
        user = db.query(User).filter(User.email == clean_email).first()

        hashed = pwd_context.hash(password)
        if user:
            user.name = name
            user.role = "admin"
            user.hashed_password = hashed
            user.trust_id = trust.id
            db.commit()
            print(f"[+] Updated existing account for {clean_email} to Master Admin.")
        else:
            user = User(
                email=clean_email,
                name=name,
                role="admin",
                hashed_password=hashed,
                trust_id=trust.id
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"[+] Created new Master Admin user: {name} ({clean_email})")

        print("\n=======================================================")
        print("  MASTER ADMIN PROFILE SUCCESSFULLY CONFIGURED")
        print("=======================================================")
        print(f"  Trust:    {trust.name}")
        print(f"  User:     {user.name}")
        print(f"  Email:    {user.email}")
        print(f"  Role:     {user.role.upper()}")
        print("=======================================================\n")

    finally:
        db.close()

def main():
    parser = argparse.ArgumentParser(description="Create or update Master Admin user for NICE Guidance Assistant.")
    parser.add_argument("--email", help="NHS email address for master admin")
    parser.add_argument("--name", help="Full display name (e.g. Dr Archibald Samuels)")
    parser.add_argument("--trust", help="Name of your NHS Trust (e.g. Liverpool Heart and Chest Hospital)", default="Liverpool Heart and Chest Hospital")
    parser.add_argument("--password", help="Password for master admin")

    args = parser.parse_args()

    email = args.email
    name = args.name
    trust_name = args.trust
    password = args.password

    # Interactive prompts if not passed as CLI flags
    if not email:
        email = input("Enter Master Admin NHS Email: ").strip()
    if not name:
        name = input("Enter Full Display Name (e.g. Archibald Samuels): ").strip()
    if not password:
        password = input("Enter Password / PIN: ").strip()
        if not password:
            password = "AdminPassword1!"
            print("[i] Using default password: AdminPassword1!")

    if not email:
        print("[-] Error: Email is required.")
        sys.exit(1)

    setup_admin(email, name, trust_name, password)

if __name__ == "__main__":
    main()
