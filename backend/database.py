"""
database.py — Database setup using SQLAlchemy.

Switched from SQLite to Supabase (PostgreSQL) for deployment.
The ORM models are identical — SQLAlchemy abstracts the difference.
Only three things changed from the SQLite version:
  1. DATABASE_URL now reads from the environment variable
  2. connect_args removed (that was SQLite-only)
  3. init_db() simplified — no PRAGMA migration needed on PostgreSQL,
     create_all() handles everything
"""

import os
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Boolean
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime

# Set this in your .env (or deployment environment variables):
# DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./flora.db")

engine       = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base         = declarative_base()


# ── Auth user table ───────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    email         = Column(String, unique=True, index=True, nullable=False)
    display_name  = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    created_at    = Column(DateTime, default=datetime.utcnow)


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id                  = Column(Integer, primary_key=True, index=True)
    user_id             = Column(String, index=True, default="anonymous")
    timestamp           = Column(DateTime, default=datetime.utcnow, index=True)
    raw_input           = Column(String)
    category            = Column(String, index=True)
    mode                = Column(String)
    quantity            = Column(Float)
    actual_co2_kg       = Column(Float)
    alternative_offered = Column(Boolean, default=False)
    alternative_mode    = Column(String, nullable=True)
    alternative_co2_kg  = Column(Float, nullable=True)
    savings_kg          = Column(Float, default=0.0)
    user_response       = Column(String, nullable=True)


class UserProfile(Base):
    __tablename__ = "user_profiles"

    user_id             = Column(String, primary_key=True)
    display_name        = Column(String, default="You")
    primary_transport   = Column(String, default="car_petrol")
    diet_pattern        = Column(String, default="chicken")
    current_streak_days = Column(Integer, default=0)
    longest_streak_days = Column(Integer, default=0)
    last_log_date       = Column(DateTime, nullable=True)

    # Extended lifestyle profile
    heating_type        = Column(String, nullable=True)
    energy_provider     = Column(String, nullable=True)
    shopping_habits     = Column(String, nullable=True)
    flights_per_year    = Column(String, nullable=True)
    home_type           = Column(String, nullable=True)
    household_size      = Column(String, nullable=True)


def init_db():
    """
    Creates all tables if they don't exist.
    PostgreSQL supports proper DDL — no manual column migration needed.
    SQLAlchemy's create_all() is safe to call repeatedly (skips existing tables).
    """
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()