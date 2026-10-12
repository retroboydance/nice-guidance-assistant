"""
Root launcher for NICE Guidance Assistant CLI.
Enables running CLI commands without manually setting PYTHONPATH.

Usage:
  python nice_bat_cli.py import-csv sample_guidance_list.csv
  python nice_bat_cli.py fetch NG253
  python nice_bat_cli.py list
  python nice_bat_cli.py export-seed
  python nice_bat_cli.py load-seed
"""

import os
import sys

# Add backend directory to sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "backend"))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.cli import main

if __name__ == "__main__":
    main()
