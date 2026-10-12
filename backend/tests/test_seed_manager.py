import json
import os
import tempfile
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.schema import Base, Guideline, Recommendation
from app.services.seed_manager import SeedManager
from app.services.smart_excel_parser import ParsedGuidelineData, ParsedRecommendation


@pytest.fixture
def db_session():
    test_engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=test_engine)
    TestingSession = sessionmaker(bind=test_engine)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()


def test_extract_codes_from_csv():
    with tempfile.NamedTemporaryFile("w", delete=False, suffix=".csv", encoding="utf-8") as f:
        f.write("Guideline Code,Topic\n")
        f.write("NG253,Sepsis\n")
        f.write(" ng250 ,Pneumonia\n")
        f.write("CG191,\n")
        f.write("invalid_row,Note\n")
        temp_csv = f.name

    try:
        codes = SeedManager._extract_codes_from_csv(temp_csv)
        assert codes == ["NG253", "NG250", "CG191"]
    finally:
        os.remove(temp_csv)


def test_export_and_load_seed_json(db_session):
    # 1. Insert a mock guideline
    data = ParsedGuidelineData(
        title="Test Guideline for Sepsis",
        code="NG253",
        recommendations=[
            ParsedRecommendation(rec_number="1.1.1", rec_text="Think could this be sepsis?", rec_year="2016", section_title="1.1 Signs"),
            ParsedRecommendation(rec_number="1.1.2", rec_text="Assess immediately", rec_year="2016", section_title="1.1 Signs"),
        ],
    )
    SeedManager.persist_guideline(data, db_session)
    db_session.commit()

    with tempfile.NamedTemporaryFile("w", delete=False, suffix=".json", encoding="utf-8") as f:
        temp_json = f.name

    try:
        # 2. Export to JSON
        count = SeedManager.export_to_json(db_session, file_path=temp_json)
        assert count == 1

        with open(temp_json, "r", encoding="utf-8") as f:
            exported = json.load(f)
        assert len(exported) == 1
        assert exported[0]["code"] == "NG253"
        assert len(exported[0]["recommendations"]) == 2

        # 3. Clear DB
        db_session.query(Recommendation).delete()
        db_session.query(Guideline).delete()
        db_session.commit()
        assert db_session.query(Guideline).count() == 0

        # 4. Load from JSON
        loaded_count = SeedManager.load_from_json(db_session, file_path=temp_json)
        assert loaded_count == 1
        assert db_session.query(Guideline).count() == 1
        assert db_session.query(Recommendation).count() == 2

        g = db_session.query(Guideline).first()
        assert g.nice_id == "NG253"
    finally:
        if os.path.exists(temp_json):
            os.remove(temp_json)


def test_auto_seed_if_empty(db_session):
    assert db_session.query(Guideline).count() == 0

    with tempfile.NamedTemporaryFile("w", delete=False, suffix=".json", encoding="utf-8") as f:
        f.write(json.dumps([
            {
                "code": "NG28",
                "name": "Type 2 Diabetes",
                "nice_url": "https://www.nice.org.uk/guidance/ng28",
                "recommendations": [
                    {"guideline_rec": "1.1.1", "rec_text": "Individualise care", "rec_year": "2015"}
                ]
            }
        ]))
        temp_json = f.name

    try:
        seeded = SeedManager.auto_seed_if_empty(db_session, file_path=temp_json)
        assert seeded is True
        assert db_session.query(Guideline).count() == 1

        # Second call should not re-seed since DB is not empty
        seeded_again = SeedManager.auto_seed_if_empty(db_session, file_path=temp_json)
        assert seeded_again is False
    finally:
        if os.path.exists(temp_json):
            os.remove(temp_json)
