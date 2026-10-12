"""
Seed Manager for NICE Guidelines in NICE Guidance Assistant.
Handles exporting guidelines to version-controlled JSON seed files,
importing from JSON seeds, auto-seeding empty databases on startup,
and batch-importing from user-provided CSV reference lists.
"""

import csv
import json
import logging
import os
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from app.models.schema import Guideline, Recommendation, RecommendationHistory
from app.services.nice_fetcher import NiceFetcher, NiceFetcherError
from app.services.smart_excel_parser import ParsedGuidelineData, ParsedRecommendation

logger = logging.getLogger(__name__)

SEEDS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "seeds"))
DEFAULT_SEED_FILE = os.path.join(SEEDS_DIR, "guidelines.json")


class SeedManager:
    """Manages serialization, loading, and batch imports of guideline reference data."""

    @classmethod
    def export_to_json(cls, db: Session, file_path: str = DEFAULT_SEED_FILE) -> int:
        """Exports all guidelines and recommendations from the DB to a JSON seed file."""
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        guidelines = db.query(Guideline).order_by(Guideline.nice_id).all()

        export_data = []
        for g in guidelines:
            recs = (
                db.query(Recommendation)
                .filter(Recommendation.guideline_id == g.id)
                .order_by(Recommendation.id)
                .all()
            )
            export_data.append({
                "code": g.nice_id,
                "name": g.name,
                "nice_url": f"https://www.nice.org.uk/guidance/{g.nice_id.lower()}",
                "recommendations": [
                    {
                        "guideline_rec": r.guideline_rec,
                        "rec_text": r.rec_text,
                        "publish_info": r.publish_info or (str(r.rec_year) if r.rec_year else ""),
                    }
                    for r in recs
                ],
            })

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(export_data, f, indent=2, ensure_ascii=False)

        logger.info(f"Exported {len(export_data)} guidelines to {file_path}")
        return len(export_data)

    @classmethod
    def load_from_json(cls, db: Session, file_path: str = DEFAULT_SEED_FILE) -> int:
        """Loads guidelines and recommendations from a JSON seed file into the DB."""
        if not os.path.exists(file_path):
            logger.warning(f"Seed file not found at {file_path}")
            return 0

        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        imported_count = 0
        for item in data:
            parsed = ParsedGuidelineData(
                title=item["name"],
                code=item.get("code") or "",
                recommendations=[
                    ParsedRecommendation(
                        rec_number=r["guideline_rec"],
                        rec_text=r["rec_text"],
                        rec_year=r.get("publish_info") or r.get("rec_year") or "",
                    )
                    for r in item.get("recommendations", [])
                ],
            )
            cls.persist_guideline(parsed, db)
            imported_count += 1

        db.commit()
        logger.info(f"Loaded {imported_count} guidelines from {file_path}")
        return imported_count

    @classmethod
    def auto_seed_if_empty(cls, db: Session, file_path: str = DEFAULT_SEED_FILE) -> bool:
        """If the database has no guidelines and a seed file exists, populates automatically."""
        count = db.query(Guideline).count()
        if count == 0 and os.path.exists(file_path):
            logger.info("Guideline library is empty. Auto-seeding from seed file...")
            cls.load_from_json(db, file_path)
            return True
        return False

    @classmethod
    def import_from_csv(
        cls,
        csv_file_path: str,
        db: Session,
        export_seed_after: bool = True,
        seed_output_path: str = DEFAULT_SEED_FILE,
    ) -> Dict[str, Any]:
        """
        Reads a CSV file containing NICE guidance references, fetches each BAT,
        saves to DB, and optionally exports to the JSON seed file.
        """
        if not os.path.exists(csv_file_path):
            raise FileNotFoundError(f"CSV file not found: {csv_file_path}")

        codes = cls._extract_codes_from_csv(csv_file_path)
        logger.info(f"Found {len(codes)} guideline code(s) in {csv_file_path}: {codes}")

        results: List[Dict[str, Any]] = []
        total_recs = 0

        for code in codes:
            try:
                parsed = NiceFetcher.fetch_guideline(code)
                guideline = cls.persist_guideline(parsed, db)
                num_recs = len(parsed.recommendations)
                total_recs += num_recs
                results.append({
                    "code": code,
                    "status": "success",
                    "title": guideline.name,
                    "recommendations": num_recs,
                })
            except Exception as e:
                logger.error(f"Failed to fetch {code}: {e}")
                results.append({
                    "code": code,
                    "status": "failed",
                    "error": str(e),
                })

        db.commit()

        seed_exported = False
        if export_seed_after:
            cls.export_to_json(db, seed_output_path)
            seed_exported = True

        return {
            "total_requested": len(codes),
            "succeeded": sum(1 for r in results if r["status"] == "success"),
            "failed": sum(1 for r in results if r["status"] == "failed"),
            "total_recommendations": total_recs,
            "seed_exported": seed_exported,
            "seed_file": seed_output_path if seed_exported else None,
            "results": results,
        }

    @classmethod
    def persist_guideline(cls, parsed_data: ParsedGuidelineData, db: Session) -> Guideline:
        """Idempotently saves or updates a guideline and its recommendations in the database."""
        nice_id = parsed_data.code.upper() if parsed_data.code else "GUIDELINE"
        guideline = db.query(Guideline).filter(Guideline.nice_id == nice_id).first()

        if not guideline:
            guideline = Guideline(
                nice_id=nice_id,
                name=parsed_data.title,
            )
            db.add(guideline)
            db.flush()
        else:
            guideline.name = parsed_data.title
            db.flush()

        for rec in parsed_data.recommendations:
            existing = db.query(Recommendation).filter(
                Recommendation.guideline_id == guideline.id,
                Recommendation.guideline_rec == rec.rec_number,
            ).first()

            if existing:
                if existing.rec_text != rec.rec_text:
                    history = RecommendationHistory(
                        recommendation_id=existing.id,
                        old_text=existing.rec_text,
                    )
                    db.add(history)
                    existing.rec_text = rec.rec_text
                if rec.rec_year:
                    existing.publish_info = rec.rec_year
            else:
                db_rec = Recommendation(
                    guideline_id=guideline.id,
                    guideline_rec=rec.rec_number,
                    rec_text=rec.rec_text,
                    publish_info=rec.rec_year,
                )
                db.add(db_rec)

        db.flush()
        return guideline

    @staticmethod
    def _extract_codes_from_csv(csv_path: str) -> List[str]:
        """Extracts unique NICE codes from various CSV formats (single column, headers, etc.)."""
        codes: List[str] = []
        with open(csv_path, "r", encoding="utf-8-sig", errors="ignore") as f:
            reader = csv.reader(f)
            header = None
            code_col_idx = 0

            for row in reader:
                if not row or all(not str(cell).strip() for cell in row):
                    continue

                if header is None:
                    header = [c.strip().lower() for c in row]
                    for idx, h in enumerate(header):
                        if any(k in h for k in ["code", "guideline", "reference", "id", "ref"]):
                            code_col_idx = idx
                            break
                    try:
                        first_val = NiceFetcher.normalise_code(row[code_col_idx])
                        if first_val not in codes:
                            codes.append(first_val)
                    except Exception:
                        pass
                    continue

                raw_val = row[code_col_idx] if code_col_idx < len(row) else ""
                try:
                    norm = NiceFetcher.normalise_code(raw_val)
                    if norm not in codes:
                        codes.append(norm)
                except Exception:
                    continue

        return codes
