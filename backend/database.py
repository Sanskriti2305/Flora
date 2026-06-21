"""
database.py — SQLite database setup using SQLAlchemy.

Design choice: SQLite for the hackathon (zero setup, file-based, perfect for
a demo/judge to run instantly with no external DB server needed). The code
is written against SQLAlchemy's ORM, so swapping to PostgreSQL later is a
one-line connection string change, not a rewrite.
"""

from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Boolean, text
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime

DATABASE_URL = "sqlite:///./flora.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ── NEW: Auth user table ──────────────────────────────────────────────────────
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
    display_name        = Column(String, default="You")   # ← was "Friend", fixed
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
    Creates tables if they don't exist, then adds any missing columns
    to existing tables (safe migration for SQLite which lacks ALTER TABLE
    support for adding multiple columns at once).
    """
    # Creates all new tables (including `users`) if they don't exist yet.
    # Existing tables are left untouched — no data loss.
    Base.metadata.create_all(bind=engine)

    with engine.connect() as conn:
        # ── Migrate user_profiles: add extended lifestyle columns ─────────────
        existing_profile_cols = [
            row[1] for row in
            conn.execute(text("PRAGMA table_info(user_profiles)")).fetchall()
        ]
        for col_name, col_type in [
            ("heating_type",     "VARCHAR"),
            ("energy_provider",  "VARCHAR"),
            ("shopping_habits",  "VARCHAR"),
            ("flights_per_year", "VARCHAR"),
            ("home_type",        "VARCHAR"),
            ("household_size",   "VARCHAR"),
        ]:
            if col_name not in existing_profile_cols:
                conn.execute(text(
                    f"ALTER TABLE user_profiles ADD COLUMN {col_name} {col_type}"
                ))

        # ── Migrate users: add any new columns safely ─────────────────────────
        existing_user_cols = [
            row[1] for row in
            conn.execute(text("PRAGMA table_info(users)")).fetchall()
        ]
        for col_name, col_type in [
            ("display_name",  "VARCHAR"),
            ("created_at",    "DATETIME"),
        ]:
            if col_name not in existing_user_cols:
                conn.execute(text(
                    f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"
                ))

        conn.commit()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()