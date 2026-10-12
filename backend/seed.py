import pandas as pd
from sqlalchemy.orm import Session
from app.models.database import SessionLocal, engine
from app.models.schema import Base, Trust, Guideline, Recommendation

def seed_database():
    # Ensure tables are created
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    print("Seeding Trust...")
    # 1. Create the Trust
    trust = db.query(Trust).filter(Trust.name == "Liverpool Heart and Chest NFT").first()
    if not trust:
        trust = Trust(name="Liverpool Heart and Chest NFT", group_name="Group PoC")
        db.add(trust)
        db.commit()
        db.refresh(trust)
    
    print("Seeding Guideline...")
    # 2. Create the Guideline (NG253 Sepsis)
    guideline = db.query(Guideline).filter(Guideline.nice_id == "NG253").first()
    if not guideline:
        guideline = Guideline(
            nice_id="NG253",
            name="Suspected sepsis in people aged 16 or over: recognition, assessment and early management"
        )
        db.add(guideline)
        db.commit()
        db.refresh(guideline)

    print("Parsing Excel file...")
    # 3. Read the Excel file
    file_path = r"U:\Audit\Archibald Samuels\agy-nice-bat\bat-example-sepsis.xlsx"
    xls = pd.ExcelFile(file_path)
    
    # The actual data is usually on the second sheet (index 1)
    # We skip the first row (header=1) because row 0 in pandas is the title row
    df = pd.read_excel(xls, xls.sheet_names[1], header=1)
    
    # 4. Insert Recommendations
    print("Inserting Recommendations...")
    added_count = 0
    for index, row in df.iterrows():
        rec_text = row.iloc[0]
        guideline_rec = row.iloc[1]
        rec_year = row.iloc[2]
        
        # Skip rows that are just category headers (where guideline_rec is NaN)
        if pd.isna(guideline_rec):
            continue
            
        # Ensure it's treated as a string
        guideline_rec_str = str(guideline_rec).strip()
        
        # Check if already exists
        existing = db.query(Recommendation).filter(
            Recommendation.guideline_id == guideline.id,
            Recommendation.guideline_rec == guideline_rec_str
        ).first()
        
        if not existing:
            year_val = None
            if pd.notna(rec_year):
                try:
                    year_val = int(rec_year)
                except ValueError:
                    year_val = None
                    
            rec = Recommendation(
                guideline_id=guideline.id,
                guideline_rec=guideline_rec_str,
                rec_text=str(rec_text).strip(),
                rec_year=year_val
            )
            db.add(rec)
            added_count += 1
            
    db.commit()
    print(f"Successfully seeded {added_count} recommendations for NG253!")
    db.close()

if __name__ == "__main__":
    seed_database()
