import io
import pytest
import openpyxl
from app.services.smart_excel_parser import SmartExcelParser, ParsedGuidelineData


def test_parse_csv_content():
    """Verify smart parser parses CSV content correctly."""
    csv_bytes = (
        "Guideline Number,Guideline Text,Year\n"
        "1.1.1,Ensure early identification of symptoms,2022\n"
        "1.1.2,Prompt referral to specialist,2022\n"
    ).encode("utf-8")

    data = SmartExcelParser.parse(csv_bytes, filename="test_guideline.csv")
    assert isinstance(data, ParsedGuidelineData)
    assert len(data.recommendations) == 2
    assert data.recommendations[0].rec_number == "1.1.1"
    assert "early identification" in data.recommendations[0].rec_text
    assert data.recommendations[0].rec_year == "2022"


def test_parse_generated_excel():
    """Verify smart parser parses an in-memory openpyxl workbook correctly."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Data sheet"

    # Row 1: Headers
    ws.append(["Section", "Recommendation Number", "Recommendation text", "Year"])
    # Row 2: Section title (should be filtered out or tracked)
    ws.append(["1.1 Initial assessment", "", "", ""])
    # Row 3: Valid recommendation
    ws.append(["", "1.1.1", "Perform immediate diagnostic assessment within 1 hour.", "2024"])
    # Row 4: Another valid recommendation
    ws.append(["", "1.1.2", "Monitor vital signs using NEWS2 score.", "2024"])

    bio = io.BytesIO()
    wb.save(bio)
    excel_bytes = bio.getvalue()

    data = SmartExcelParser.parse(excel_bytes, filename="NG999_Baseline_Tool.xlsx")
    assert isinstance(data, ParsedGuidelineData)
    assert data.code == "NG999"
    assert len(data.recommendations) == 2
    assert data.recommendations[0].rec_number == "1.1.1"
    assert "diagnostic assessment" in data.recommendations[0].rec_text
    assert data.recommendations[1].rec_number == "1.1.2"
    assert "NEWS2" in data.recommendations[1].rec_text


def test_parse_invalid_file():
    with pytest.raises(Exception):
        SmartExcelParser.parse(b"not an excel or csv file", filename="invalid.xlsx")
