"""
main.py — Flora's FastAPI application.
Wraps carbon_math.py + parser.py with HTTP routes and persistence.
"""
from dotenv import load_dotenv
load_dotenv()  # Must run before importing ai_fallback, which reads
               # GEMINI_API_KEY from os.environ at call time.

import os
from datetime import datetime, timedelta
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from jose import JWTError, jwt
from passlib.context import CryptContext

from database import init_db, get_db, ActivityLog, UserProfile, User
from carbon_math import (
    calculate_co2,
    suggest_alternative,
    get_carbon_weather,
    get_climate_equivalents,       
    UnknownEmissionModeError,
)
from parser import parse_activity, UnrecognizedActivityError
from ai_fallback import classify_with_ai, parse_receipt_with_ai, generate_insight_summary, generate_weather_narrative, AIFallbackError
app = FastAPI(title="Flora API", description="Carbon footprint awareness platform")

# CORS: allows the React frontend (running on a different port) to call this API.
# In production, replace "*" with your actual deployed frontend URL for security.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Auth config ───────────────────────────────────────────────────────────────
SECRET_KEY        = os.getenv("JWT_SECRET", "flora-dev-secret-change-in-production")
ALGORITHM         = "HS256"
TOKEN_EXPIRE_DAYS = 30

pwd_context   = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)


def _hash_password(password: str) -> str:
    return pwd_context.hash(password)


def _verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _create_token(user_id: str) -> str:
    expire  = datetime.utcnow() + timedelta(days=TOKEN_EXPIRE_DAYS)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> str:
    """
    Dependency used by every protected route.
    Decodes the Bearer token and returns the user_id string.
    """
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


@app.on_event("startup")
def on_startup():
    init_db()


def _update_streak(db: Session, user_id: str):
    """
    Updates a user's logging streak. Called once per check-in.
    Streak logic: if the user's last log was yesterday, increment.
    If it was today already, no change (already counted). Otherwise reset to 1.
    """
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if profile is None:
        profile = UserProfile(user_id=user_id, current_streak_days=1, longest_streak_days=1,
                               last_log_date=datetime.utcnow())
        db.add(profile)
        db.commit()
        return

    today     = datetime.utcnow().date()
    last_date = profile.last_log_date.date() if profile.last_log_date else None

    if last_date == today:
        pass  # already logged today, streak unchanged
    elif last_date == today - timedelta(days=1):
        profile.current_streak_days += 1
    else:
        profile.current_streak_days = 1

    profile.longest_streak_days = max(profile.longest_streak_days, profile.current_streak_days)
    profile.last_log_date = datetime.utcnow()
    db.commit()


# ── Auth schemas ──────────────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    display_name: str | None = None
    email:        str
    password:     str


class LoginRequest(BaseModel):
    email:    str
    password: str


# ── Request/response schemas ──────────────────────────────────────────────────

class CheckInRequest(BaseModel):
    text: str
    user_response: str | None = None  # "accepted" | "declined" | None
    # If the user chose the suggested swap instead of their original
    # input, the frontend sends the swap's category/mode/quantity here
    # so we log what they ACTUALLY did, not the original plan.
    override_mode: str | None = None


class CheckInResponse(BaseModel):
    id: int
    category: str
    mode: str
    quantity: float
    actual_co2_kg: float
    alternative_offered: bool
    alternative_mode: str | None = None
    alternative_co2_kg: float | None = None
    savings_kg: float
    message: str
    source: str


class PreviewRequest(BaseModel):
    text: str


class PreviewResponse(BaseModel):
    category: str
    mode: str
    quantity: float
    actual_co2_kg: float
    alternative_offered: bool
    alternative_mode: str | None = None
    alternative_co2_kg: float | None = None
    savings_kg: float
    message: str
    source: str


def _parse_and_calculate(text: str):
    """
    Shared logic used by BOTH /preview-swap (no DB write) and /check-in
    (writes to ActivityLog). Keeping this in one place means the preview
    a user sees is GUARANTEED to match what actually gets logged --
    there's no way for the two numbers to drift apart.
    """
    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="text cannot be empty")

    try:
        parsed = parse_activity(text)
    except UnrecognizedActivityError:
        try:
            parsed = classify_with_ai(text)
        except AIFallbackError as e:
            raise HTTPException(status_code=422, detail=str(e))

    category, mode, quantity = parsed["category"], parsed["mode"], parsed["quantity"]

    try:
        actual_co2 = calculate_co2(category, mode, quantity)
        suggestion = suggest_alternative(category, mode, quantity)
    except UnknownEmissionModeError as e:
        raise HTTPException(status_code=422, detail=str(e))

    if suggestion:
        message = (
            f"{mode.replace('_', ' ')} ({quantity} units) "
            f"produced {actual_co2}kg CO2. Try {suggestion['alternative_mode']} instead "
            f"to save ~{suggestion['savings_kg']}kg ({suggestion['savings_pct']}%)."
        )
    else:
        message = f"{mode.replace('_', ' ')} is already a low-impact choice. No swap needed!"

    return {
        "category": category,
        "mode": mode,
        "quantity": quantity,
        "actual_co2": actual_co2,
        "suggestion": suggestion,
        "message": message,
        "source": parsed.get("source", "rules"),
    }


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "Flora API is running"}


# ── Auth routes ───────────────────────────────────────────────────────────────

@app.post("/auth/signup")
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email         = payload.email,
        display_name  = payload.display_name or "You",
        password_hash = _hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Also create a UserProfile so streak/stats work immediately
    profile = UserProfile(user_id=str(user.id))
    db.add(profile)
    db.commit()

    token = _create_token(str(user.id))
    return {
        "token": token,
        "user": {"id": user.id, "email": user.email, "display_name": user.display_name},
    }


@app.post("/auth/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not _verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = _create_token(str(user.id))
    return {
        "token": token,
        "user": {"id": user.id, "email": user.email, "display_name": user.display_name},
    }


@app.get("/auth/me")
def get_me(user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user": {"id": user.id, "email": user.email, "display_name": user.display_name}}


# ── App routes (user_id now comes from token, not query param) ────────────────

@app.post("/preview-swap", response_model=PreviewResponse)
def preview_swap(payload: PreviewRequest, user_id: str = Depends(get_current_user)):
    """
    Calculates what an activity WOULD cost and what swap WOULD be
    suggested, without writing anything to the database. Lets the
    frontend show "here's what this costs, want to switch?" BEFORE
    anything is committed to the user's log.
    """
    result     = _parse_and_calculate(payload.text)
    suggestion = result["suggestion"]

    return PreviewResponse(
        category            = result["category"],
        mode                = result["mode"],
        quantity            = result["quantity"],
        actual_co2_kg       = result["actual_co2"],
        alternative_offered = bool(suggestion),
        alternative_mode    = suggestion["alternative_mode"]  if suggestion else None,
        alternative_co2_kg  = suggestion["alternative_co2_kg"] if suggestion else None,
        savings_kg          = suggestion["savings_kg"] if suggestion else 0.0,
        message             = result["message"],
        source              = result["source"],
    )


@app.post("/check-in", response_model=CheckInResponse)
def check_in(
    payload: CheckInRequest,
    db:      Session = Depends(get_db),
    user_id: str     = Depends(get_current_user),
):
    """
    Commits an activity to the user's log. If override_mode is given
    (the user chose the suggested swap instead of their original plan),
    that becomes what's actually logged.
    """
    result = _parse_and_calculate(payload.text)
    category, mode, quantity = result["category"], result["mode"], result["quantity"]
    actual_co2, suggestion   = result["actual_co2"], result["suggestion"]
    message, source          = result["message"], result["source"]

    # User chose the suggested swap instead of their original plan --
    # log the swap's mode/CO2 instead, and count the full original-vs-
    # swap difference as real savings.
    if payload.override_mode and suggestion and payload.override_mode == suggestion["alternative_mode"]:
        savings_kg    = suggestion["savings_kg"]
        mode          = suggestion["alternative_mode"]
        actual_co2    = suggestion["alternative_co2_kg"]
        user_response = "accepted"
    else:
        savings_kg    = 0.0
        user_response = payload.user_response or ("declined" if suggestion else None)

    log = ActivityLog(
        user_id             = user_id,
        timestamp           = datetime.utcnow(),
        raw_input           = payload.text,
        category            = category,
        mode                = mode,
        quantity            = quantity,
        actual_co2_kg       = actual_co2,
        alternative_offered = bool(suggestion),
        alternative_mode    = suggestion["alternative_mode"]  if suggestion else None,
        alternative_co2_kg  = suggestion["alternative_co2_kg"] if suggestion else None,
        savings_kg          = savings_kg,
        user_response       = user_response,
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    _update_streak(db, user_id)

    return CheckInResponse(
        id                  = log.id,
        category            = category,
        mode                = mode,
        quantity            = quantity,
        actual_co2_kg       = actual_co2,
        alternative_offered = bool(suggestion),
        alternative_mode    = log.alternative_mode,
        alternative_co2_kg  = log.alternative_co2_kg,
        savings_kg          = log.savings_kg,
        message             = message,
        source              = source,
    )


@app.get("/stats")
def get_stats(
    period:  str     = "week",
    db:      Session = Depends(get_db),
    user_id: str     = Depends(get_current_user),
):
    """
    Returns total CO2 saved for a given period: day, week, month, year, all_time.
    Stats are computed live from ActivityLog, never stored, so they can't go stale.
    """
    now        = datetime.utcnow()
    period_map = {
        "day":   now - timedelta(days=1),
        "week":  now - timedelta(weeks=1),
        "month": now - timedelta(days=30),
        "year":  now - timedelta(days=365),
    }

    query = db.query(func.sum(ActivityLog.savings_kg)).filter(ActivityLog.user_id == user_id)
    if period in period_map:
        query = query.filter(ActivityLog.timestamp >= period_map[period])
    elif period != "all_time":
        raise HTTPException(status_code=400, detail="invalid period")

    total_saved  = query.scalar() or 0.0
    total_logged = db.query(ActivityLog).filter(ActivityLog.user_id == user_id).count()

    return {
        "period":                 period,
        "total_co2_saved_kg":     round(total_saved, 3),
        "total_activities_logged": total_logged,
        "trees_equivalent":       round(total_saved / 21, 2),
    }


@app.get("/history")
def get_history(
    limit:   int     = 20,
    db:      Session = Depends(get_db),
    user_id: str     = Depends(get_current_user),
):
    logs = (
        db.query(ActivityLog)
        .filter(ActivityLog.user_id == user_id)
        .order_by(ActivityLog.timestamp.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id":           l.id,
            "timestamp":    l.timestamp.isoformat(),
            "raw_input":    l.raw_input,
            "category":     l.category,
            "mode":         l.mode,
            "actual_co2_kg": l.actual_co2_kg,
            "savings_kg":   l.savings_kg,
        }
        for l in logs
    ]


@app.get("/weather")
def get_weather(
    db:      Session = Depends(get_db),
    user_id: str     = Depends(get_current_user),
):
    # ── Today's total ────────────────────────────────────────────────────────
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    total_today = (
        db.query(func.sum(ActivityLog.actual_co2_kg))
        .filter(ActivityLog.user_id == user_id, ActivityLog.timestamp >= today_start)
        .scalar()
        or 0.0
    )
    total_today = round(total_today, 3)

    # ── 7-day real forecast from DB ──────────────────────────────────────────
    seven_day = []
    for i in range(6, -1, -1):   # 6 days ago → today
        day_start = (datetime.utcnow() - timedelta(days=i)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        day_end = day_start + timedelta(days=1)
        day_kg = (
            db.query(func.sum(ActivityLog.actual_co2_kg))
            .filter(
                ActivityLog.user_id == user_id,
                ActivityLog.timestamp >= day_start,
                ActivityLog.timestamp < day_end,
            )
            .scalar()
            or 0.0
        )
        seven_day.append({
            "d":        (datetime.utcnow() - timedelta(days=i)).strftime("%a"),
            "kg":       round(day_kg, 1),
            "is_today": i == 0,
        })

    # ── Weather label + EPA-sourced equivalents ──────────────────────────────
    weather     = get_carbon_weather(total_today)
    equivalents = get_climate_equivalents(total_today)

    # ── AI narrative (picks/phrases one sourced fact, never invents numbers) ─
    narrative = generate_weather_narrative(weather, equivalents)

    return {
        **weather,
        "seven_day_forecast":  seven_day,
        "climate_equivalents": equivalents,
        "narrative":           narrative,
    }


@app.get("/insights")
def get_insights(
    db:      Session = Depends(get_db),
    user_id: str     = Depends(get_current_user),
):
    """
    Powers the Insights page: per-day totals for the last 7 days,
    category breakdown for the week, and an anonymous peer percentile.
    All pure SQL aggregation -- no AI involved.
    """
    week_start = datetime.utcnow() - timedelta(days=7)

    rows = (
        db.query(ActivityLog.timestamp, ActivityLog.actual_co2_kg)
        .filter(ActivityLog.user_id == user_id, ActivityLog.timestamp >= week_start)
        .all()
    )
    daily_totals = {}
    for ts, co2 in rows:
        day_key = ts.date().isoformat()
        daily_totals[day_key] = daily_totals.get(day_key, 0.0) + co2

    category_rows = (
        db.query(ActivityLog.category, func.sum(ActivityLog.actual_co2_kg))
        .filter(ActivityLog.user_id == user_id, ActivityLog.timestamp >= week_start)
        .group_by(ActivityLog.category)
        .all()
    )
    total_co2 = sum(c for _, c in category_rows) or 1
    breakdown = {cat: round((co2 / total_co2) * 100, 1) for cat, co2 in category_rows}

    user_total     = sum(daily_totals.values())
    all_user_totals = (
        db.query(ActivityLog.user_id, func.sum(ActivityLog.actual_co2_kg))
        .filter(ActivityLog.timestamp >= week_start)
        .group_by(ActivityLog.user_id)
        .all()
    )
    other_totals = [t for uid, t in all_user_totals if uid != user_id]
    if other_totals:
        lower_count = sum(1 for t in other_totals if user_total <= t)
        percentile  = round((lower_count / len(other_totals)) * 100, 1)
    else:
        percentile = None

    summary_text     = generate_insight_summary(daily_totals, breakdown, percentile)
    trees_equivalent = round(user_total / 21, 1)

    return {
        "daily_totals_kg":           daily_totals,
        "category_breakdown_pct":    breakdown,
        "peer_percentile_lower_than": percentile,
        "total_week_co2_kg":         round(user_total, 3),
        "trees_equivalent":          trees_equivalent,
        "ai_summary":                summary_text,
    }


class LifestyleUpdate(BaseModel):
    display_name:      str | None = None
    primary_transport: str | None = None
    diet_pattern:      str | None = None
    heating_type:      str | None = None
    energy_provider:   str | None = None
    shopping_habits:   str | None = None
    flights_per_year:  str | None = None
    home_type:         str | None = None
    household_size:    str | None = None


@app.get("/profile")
def get_profile(
    db:      Session = Depends(get_db),
    user_id: str     = Depends(get_current_user),
):
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if profile is None:
        profile = UserProfile(user_id=user_id)
        db.add(profile)
        db.commit()
        db.refresh(profile)

    # Pull display_name from the User table so it stays in sync with auth
    user = db.query(User).filter(User.id == int(user_id)).first()

    total_saved  = (
        db.query(func.sum(ActivityLog.savings_kg))
        .filter(ActivityLog.user_id == user_id)
        .scalar()
        or 0.0
    )
    total_logged = db.query(ActivityLog).filter(ActivityLog.user_id == user_id).count()

    return {
        "user_id":               profile.user_id,
        "display_name":          user.display_name if user else profile.display_name,
        "primary_transport":     profile.primary_transport,
        "diet_pattern":          profile.diet_pattern,
        "current_streak_days":   profile.current_streak_days,
        "longest_streak_days":   profile.longest_streak_days,
        "total_co2_saved_kg":    round(total_saved, 3),
        "total_activities_logged": total_logged,
        "badges":                _compute_badges(profile, total_saved, total_logged),
        "heating_type":          profile.heating_type,
        "energy_provider":       profile.energy_provider,
        "shopping_habits":       profile.shopping_habits,
        "flights_per_year":      profile.flights_per_year,
        "home_type":             profile.home_type,
        "household_size":        profile.household_size,
    }


@app.patch("/profile")
def update_profile(
    payload: LifestyleUpdate,
    db:      Session = Depends(get_db),
    user_id: str     = Depends(get_current_user),
):
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if profile is None:
        profile = UserProfile(user_id=user_id)
        db.add(profile)

    if payload.primary_transport is not None: profile.primary_transport = payload.primary_transport
    if payload.diet_pattern      is not None: profile.diet_pattern      = payload.diet_pattern
    if payload.heating_type      is not None: profile.heating_type      = payload.heating_type
    if payload.energy_provider   is not None: profile.energy_provider   = payload.energy_provider
    if payload.shopping_habits   is not None: profile.shopping_habits   = payload.shopping_habits
    if payload.flights_per_year  is not None: profile.flights_per_year  = payload.flights_per_year
    if payload.home_type         is not None: profile.home_type         = payload.home_type
    if payload.household_size    is not None: profile.household_size    = payload.household_size

    # If display_name is updated, sync it to the User table too
    if payload.display_name is not None:
        user = db.query(User).filter(User.id == int(user_id)).first()
        if user:
            user.display_name = payload.display_name

    db.commit()
    return {"status": "updated"}


# Badge thresholds -- explicit, auditable conditions rather than hidden
# magic numbers. Each badge is a (id, label, condition_fn) tuple.
BADGE_DEFINITIONS = [
    ("first_log",         "First log",            lambda p, saved, logged: logged >= 1),
    ("seven_day_streak",  "7-day streak",          lambda p, saved, logged: p.longest_streak_days >= 7),
    ("thirty_day_streak", "30-day streak",         lambda p, saved, logged: p.longest_streak_days >= 30),
    ("hundred_kg_saved",  "100 kg saved",          lambda p, saved, logged: saved >= 100),
    ("ten_logs",          "10 activities logged",  lambda p, saved, logged: logged >= 10),
]


def _compute_badges(profile: UserProfile, total_saved: float, total_logged: int):
    return [
        {"id": badge_id, "label": label, "earned": condition(profile, total_saved, total_logged)}
        for badge_id, label, condition in BADGE_DEFINITIONS
    ]


class ReceiptScanRequest(BaseModel):
    raw_text: str


@app.post("/receipt-scan")
def receipt_scan(
    payload: ReceiptScanRequest,
    db:      Session = Depends(get_db),
    user_id: str     = Depends(get_current_user),
):
    """
    Parses pasted receipt text, scores each food item's CO2 with our own
    sourced ingredient table, and logs each item as a separate ActivityLog
    row -- so receipt scanning feeds the same stats/insights/streak engine
    as every other check-in.
    """
    try:
        result = parse_receipt_with_ai(payload.raw_text)
    except AIFallbackError as e:
        raise HTTPException(status_code=422, detail=str(e))

    logged_items = []
    for item in result["items"]:
        log = ActivityLog(
            user_id             = user_id,
            timestamp           = datetime.utcnow(),
            raw_input           = f"receipt item: {item['ingredient']} ({item['grams']}g)",
            category            = "diet",
            mode                = item["ingredient"],
            quantity            = item["grams"],
            actual_co2_kg       = item["co2_kg"],
            alternative_offered = False,
            savings_kg          = 0.0,
            user_response       = None,
        )
        db.add(log)
        logged_items.append(item)

    db.commit()
    _update_streak(db, user_id)

    return {
        "items":       logged_items,
        "total_co2_kg": result["total_co2_kg"],
        "items_logged": len(logged_items),
    }


from fastapi import UploadFile, File
import base64
from ai_fallback import extract_text_from_image_with_ai

@app.post("/scan-receipt-image")
async def scan_receipt_image(
    file:    UploadFile = File(...),
    db:      Session    = Depends(get_db),
    user_id: str        = Depends(get_current_user),
):
    """
    Accepts an uploaded image of a receipt, uses Gemini vision to extract
    text, then scores each item with parse_receipt_with_ai — same pipeline
    as /receipt-scan but starting from an image instead of pasted text.
    """
    contents  = await file.read()
    image_b64 = base64.b64encode(contents).decode("utf-8")

    try:
        raw_text = extract_text_from_image_with_ai(image_b64, file.content_type)
        result   = parse_receipt_with_ai(raw_text)
    except AIFallbackError as e:
        raise HTTPException(status_code=422, detail=str(e))

    logged_items = []
    for item in result["items"]:
        log = ActivityLog(
            user_id             = user_id,
            timestamp           = datetime.utcnow(),
            raw_input           = f"receipt image: {item['ingredient']} ({item['grams']}g)",
            category            = "diet",
            mode                = item["ingredient"],
            quantity            = item["grams"],
            actual_co2_kg       = item["co2_kg"],
            alternative_offered = False,
            savings_kg          = 0.0,
            user_response       = None,
        )
        db.add(log)
        logged_items.append(item)

    db.commit()
    _update_streak(db, user_id)

    return {
        "items":        logged_items,
        "total_co2_kg": result["total_co2_kg"],
        "items_logged": len(logged_items),
    }