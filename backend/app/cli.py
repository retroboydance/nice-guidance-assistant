"""
CLI management tool for NICE Guidance Assistant in agy-base.
Enables command-line seeding, fetching, and inspection of NICE guidelines.

Usage:
  python nice_bat_cli.py fetch NG253
  python nice_bat_cli.py seed-core
  python nice_bat_cli.py import-csv sample_guidance_list.csv
  python nice_bat_cli.py list
  python nice_bat_cli.py export-seed
  python nice_bat_cli.py load-seed
"""

import argparse
import sys
from app.models.database import engine, SessionLocal
from app.models.schema import Base, Guideline, Recommendation
from app.services.nice_fetcher import NiceFetcher
from app.services.seed_manager import SeedManager, DEFAULT_SEED_FILE

# Common core guidelines frequently audited across NHS Trusts
CORE_GUIDELINES = [
    "NG253",  # Sepsis
    "NG250",  # Pneumonia in adults
    "NG28",   # Type 2 Diabetes in adults
    "NG136",  # Hypertension in adults
    "NG143",  # Fever in under 5s
    "NG89",   # Venous thromboembolism (VTE) in over 16s
    "NG249",  # Falls in older people (updated from CG161)
]


def cmd_fetch(args):
    code = args.code
    print(f"Fetching guidance {code} from NICE...")
    db = SessionLocal()
    try:
        parsed = NiceFetcher.fetch_guideline(code)
        guideline = SeedManager.persist_guideline(parsed, db)
        db.commit()
        print(f"Successfully imported '{guideline.name}' ({guideline.nice_id})")
        print(f"Total recommendations: {len(parsed.recommendations)}")
    except Exception as e:
        print(f"Error fetching {code}: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


def cmd_seed_core(args):
    print(f"Seeding {len(CORE_GUIDELINES)} core NHS audit guidelines...")
    db = SessionLocal()
    success = 0
    failed = 0
    for code in CORE_GUIDELINES:
        print(f"\n--- Importing {code} ---")
        try:
            parsed = NiceFetcher.fetch_guideline(code)
            guideline = SeedManager.persist_guideline(parsed, db)
            db.commit()
            print(f"  OK: {guideline.name} ({len(parsed.recommendations)} recs)")
            success += 1
        except Exception as e:
            print(f"  FAILED {code}: {e}", file=sys.stderr)
            failed += 1
    db.close()
    print(f"\nFinished seeding: {success} succeeded, {failed} failed.")


def cmd_list(args):
    db = SessionLocal()
    try:
        guidelines = db.query(Guideline).order_by(Guideline.name).all()
        print(f"Available guidelines in library ({len(guidelines)} total):")
        for g in guidelines:
            rec_count = db.query(Recommendation).filter(Recommendation.guideline_id == g.id).count()
            print(f"  - [{g.nice_id or '---'}] {g.name} ({rec_count} recommendations)")
    finally:
        db.close()


def cmd_import_csv(args):
    csv_file = args.csv_file
    export_seed = not args.no_export_seed
    output_seed = args.seed_file or DEFAULT_SEED_FILE

    print(f"Reading guidelines from CSV: {csv_file}")
    db = SessionLocal()
    try:
        summary = SeedManager.import_from_csv(
            csv_file_path=csv_file,
            db=db,
            export_seed_after=export_seed,
            seed_output_path=output_seed,
        )
        print("\n=== Import Summary ===")
        print(f"Total codes requested: {summary['total_requested']}")
        print(f"Successfully imported: {summary['succeeded']}")
        print(f"Failed:                {summary['failed']}")
        print(f"Total recommendations: {summary['total_recommendations']}")
        if summary.get("seed_exported"):
            print(f"Exported seed file to: {summary['seed_file']}")

        for r in summary["results"]:
            status_symbol = "[OK]" if r["status"] == "success" else "[FAIL]"
            if r["status"] == "success":
                print(f"  {status_symbol} [{r['code']}] {r['title']} ({r['recommendations']} recs)")
            else:
                print(f"  {status_symbol} [{r['code']}] Error: {r.get('error')}")
    except Exception as e:
        print(f"Error processing CSV: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


def cmd_export_seed(args):
    output_path = args.output or DEFAULT_SEED_FILE
    print(f"Exporting database guidelines to {output_path}...")
    db = SessionLocal()
    try:
        count = SeedManager.export_to_json(db, output_path)
        print(f"Exported {count} guidelines successfully.")
    finally:
        db.close()


def cmd_load_seed(args):
    input_path = args.input or DEFAULT_SEED_FILE
    print(f"Loading guidelines from seed file: {input_path}...")
    db = SessionLocal()
    try:
        count = SeedManager.load_from_json(db, input_path)
        print(f"Loaded {count} guidelines successfully.")
    finally:
        db.close()


def main():
    Base.metadata.create_all(bind=engine)
    parser = argparse.ArgumentParser(description="NICE Guidance Assistant CLI Tool")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # fetch command
    fetch_parser = subparsers.add_parser("fetch", help="Fetch and import a single guideline by code (e.g. NG253)")
    fetch_parser.add_argument("code", help="NICE guideline code, e.g. NG253, CG161")
    fetch_parser.set_defaults(func=cmd_fetch)

    # seed-core command
    seed_parser = subparsers.add_parser("seed-core", help="Batch import common core audit guidelines")
    seed_parser.set_defaults(func=cmd_seed_core)

    # import-csv command
    csv_parser = subparsers.add_parser("import-csv", help="Batch import guidelines from a CSV file of references")
    csv_parser.add_argument("csv_file", help="Path to CSV file containing guideline references")
    csv_parser.add_argument("--no-export-seed", action="store_true", help="Do not export seed file after import")
    csv_parser.add_argument("--seed-file", help="Custom path for the exported seed JSON file")
    csv_parser.set_defaults(func=cmd_import_csv)

    # export-seed command
    export_parser = subparsers.add_parser("export-seed", help="Export guidelines currently in DB to a JSON seed file")
    export_parser.add_argument("--output", help="Custom output path for guidelines.json")
    export_parser.set_defaults(func=cmd_export_seed)

    # load-seed command
    load_parser = subparsers.add_parser("load-seed", help="Load guidelines from JSON seed file into DB")
    load_parser.add_argument("--input", help="Custom input path for guidelines.json")
    load_parser.set_defaults(func=cmd_load_seed)

    # list command
    list_parser = subparsers.add_parser("list", help="List all guidelines currently in the database")
    list_parser.set_defaults(func=cmd_list)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
