import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Uses DATABASE_URL env var if provided (e.g. in Docker or PostgreSQL), otherwise defaults to local SQLite file
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./nice_bat_dev.db")

connect_args = {"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args=connect_args
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
