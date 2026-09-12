from fastapi import FastAPI, APIRouter, Depends, HTTPException, File, UploadFile, Form, Request as FastAPIRequest, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel
from typing import Optional, List, Any, Dict
import uuid
from datetime import datetime, timezone, timedelta
import re
import httpx
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi.responses import StreamingResponse
import io
import shutil
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter
from openpyxl.drawing.image import Image as XLImage
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image as RLImage
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors as rl_colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Uploads directory for file storage
UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

SECRET_KEY = os.environ.get('JWT_SECRET', 'bdvv-secret-key-2024')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
# auto_error=False so the dependency doesn't 401 when no Authorization header is present
# (we fall back to the httpOnly cookie in get_current_user)
security = HTTPBearer(auto_error=False)

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def serialize_doc(doc):
    if doc is None:
        return None
    result = {}
    for key, value in doc.items():
        if key == '_id':
            continue
        elif isinstance(value, datetime):
            result[key] = value.isoformat()
        elif isinstance(value, dict):
            result[key] = serialize_doc(value)
        elif isinstance(value, list):
            result[key] = [serialize_doc(v) if isinstance(v, dict) else v for v in value]
        else:
            result[key] = value
    return result


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(
    request: FastAPIRequest,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
):
    """
    Resolve the current user from either:
      1. httpOnly cookie `bdvv_token` (preferred, set by /auth/login)
      2. Authorization: Bearer <token> header (backward-compat / mobile clients)
    """
    token: Optional[str] = None
    # 1. Try Authorization header first (explicit Bearer wins over cookie)
    if credentials and credentials.credentials:
        token = credentials.credentials
    # 2. Fall back to httpOnly cookie
    if not token:
        token = request.cookies.get("bdvv_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.staff.find_one({"id": user_id})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return serialize_doc({k: v for k, v in user.items() if k not in ['_id', 'pin_hash']})
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ── Protected admin names (cannot be deleted) ────────────────────────────────
PROTECTED_ADMINS = {"yash doshi", "dolly doshi", "isha doshi", "neel doshi"}

AVATAR_COLORS = [
    "#e8a830", "#4aa3ff", "#27ae60", "#b76e79", "#c0392b",
    "#9b59b6", "#1abc9c", "#e67e22", "#2980b9", "#e74c3c",
]

def get_avatar_color(name: str) -> str:
    idx = sum(ord(c) for c in name) % len(AVATAR_COLORS)
    return AVATAR_COLORS[idx]

def get_initials(name: str) -> str:
    parts = name.strip().split()
    if len(parts) >= 2:
        return (parts[0][0] + parts[-1][0]).upper()
    return name[:2].upper() if name else "??"


# ── Models ──────────────────────────────────────────────────────────────────

class PinLoginRequest(BaseModel):
    staff_id: str
    pin: str


class StaffCreate(BaseModel):
    name: str
    role: str = "sales"   # admin, sales, operations, accounts, tour_guide
    pin: str              # 4-digit PIN


class StaffUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None


class StaffPinReset(BaseModel):
    new_pin: str


class EnquiryCreate(BaseModel):
    client_name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    destination: str
    travel_date: Optional[str] = None
    return_date: Optional[str] = None
    pax_adults: int = 1
    pax_children: int = 0
    budget: Optional[str] = None
    travel_type: Optional[str] = None
    service_type: Optional[str] = "Tour"
    source: Optional[str] = "Manual"
    pipeline_stage: str = "New"
    notes: Optional[str] = None
    assigned_to: Optional[str] = None
    company: str = "BDVV"
    client_id: Optional[str] = None
    assigned_to_staff_id: Optional[str] = None
    assigned_to_name: Optional[str] = None
    followup_at: Optional[str] = None


class EnquiryStageUpdate(BaseModel):
    stage: str


class SavedSiteCreate(BaseModel):
    label: str
    url: str
    category: str


class ClientCreate(BaseModel):
    full_name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    dob: Optional[str] = None
    address: Optional[str] = None
    passport_no: Optional[str] = None
    passport_expiry: Optional[str] = None
    nationality: str = "Indian"
    seat_preference: Optional[str] = None
    meal_preference: Optional[str] = None
    hotel_rating: Optional[str] = None
    notes: Optional[str] = None


class NoteCreate(BaseModel):
    note: str


class FollowupUpdate(BaseModel):
    followup_at: Optional[str] = None


class LostUpdate(BaseModel):
    lost_reason: str
    lost_notes: Optional[str] = None


class AssignUpdate(BaseModel):
    staff_id: Optional[str] = None
    staff_name: Optional[str] = None


class LinkClientUpdate(BaseModel):
    client_id: Optional[str] = None


class DocumentAdd(BaseModel):
    title: str
    doc_type: str
    notes: Optional[str] = None
    image_data: Optional[str] = None


class QuoteItemCreate(BaseModel):
    id: Optional[str] = None
    category: str = "Hotels"
    title: str = ""
    description: Optional[str] = None
    qty: float = 1
    unit_price: float = 0
    currency: str = "INR"
    roe_to_base: float = 1.0
    # ── Flight-specific fields ──────────────────────────────
    from_location: Optional[str] = None    # e.g. BOM, Mumbai
    to_location: Optional[str] = None      # e.g. DXB, Dubai
    flight_date: Optional[str] = None
    dep_time: Optional[str] = None
    arr_time: Optional[str] = None
    airline: Optional[str] = None
    flight_no: Optional[str] = None
    flight_class: Optional[str] = None    # Economy, Business, First
    pnr: Optional[str] = None
    fare_adult: Optional[float] = None
    fare_child: Optional[float] = None    # CHD 12-15
    fare_infant: Optional[float] = None   # CHID under 12
    no_adults: Optional[int] = None       # defaults to quote pax_adults
    no_children: Optional[int] = None     # defaults to quote pax_children
    no_infants: Optional[int] = None      # defaults to quote pax_infant
    # ── Hotel-specific fields ───────────────────────────────
    city: Optional[str] = None
    hotel_name: Optional[str] = None
    check_in: Optional[str] = None
    check_out: Optional[str] = None
    nights: Optional[int] = None
    room_type: Optional[str] = None
    meal_plan: Optional[str] = None       # BB, HB, FB, AI, RO, EP
    no_of_rooms: Optional[int] = None
    rate_per_night: Optional[float] = None
    # ── Tour / Transfer / Visa-specific fields ──────────────
    rate_type: Optional[str] = None       # per_person, per_vehicle, per_group
    service_count: Optional[float] = None
    # ── Stopover fields (flights) ────────────────────────────
    stopovers: Optional[List[Dict]] = None  # [{city, duration, flight_no, airline, dep_time, arr_time}]
    # ── Package fields ───────────────────────────────────────
    package_items: Optional[List[Dict]] = None  # [{name, item_type, internal_cost}]
    show_itemised: Optional[bool] = False


class QuoteCreate(BaseModel):
    quote_type: str = "International Tour"
    base_currency: str = "INR"
    enquiry_id: Optional[str] = None
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    destination: Optional[str] = None
    travel_date: Optional[str] = None
    return_date: Optional[str] = None
    pax_adults: int = 1
    pax_children: int = 0
    pax_infant: int = 0                   # CHD under 12 / infants
    validity_date: Optional[str] = None
    notes: Optional[str] = None
    markup_type: str = "percentage"        # "percentage" or "fixed"
    markup_value: float = 0
    gst_rate: Optional[float] = None   # None = use default from tax_profiles collection
    tcs_rate: Optional[float] = None   # None = use default from tax_profiles collection
    tcs_enabled: bool = False
    items: List[QuoteItemCreate] = []
    itinerary_id: Optional[str] = None    # linked itinerary


class QuoteStatusUpdate(BaseModel):
    status: str


class AlertCreate(BaseModel):
    message: str
    due_at: Optional[str] = None
    linked_entity_type: Optional[str] = None  # "enquiry", "client", "quote"
    linked_entity_id: Optional[str] = None
    linked_entity_name: Optional[str] = None
    repeat: str = "none"  # "none", "daily", "weekly"


class AlertSnooze(BaseModel):
    snoozed_until: str


class AlertDismiss(BaseModel):
    re_alert: bool = False


class VisaApplicationCreate(BaseModel):
    enquiry_id: Optional[str] = None
    client_name: str
    country: str
    visa_type: str = "Tourist"
    appointment_date: Optional[str] = None
    submission_date: Optional[str] = None
    notes: Optional[str] = None
    status: str = "In Progress"


# ── Auth Endpoints ─────────────────────────────────────────────────────────

@api_router.get("/auth/staff")
async def get_staff_list():
    staff = await db.staff.find({"is_active": True}, {"_id": 0, "pin_hash": 0}).to_list(100)
    return [serialize_doc(s) for s in staff]


@api_router.post("/auth/login")
async def pin_login(request: PinLoginRequest, response: Response):
    staff = await db.staff.find_one({"id": request.staff_id})
    if not staff:
        raise HTTPException(status_code=401, detail="Staff not found")
    if not pwd_context.verify(request.pin, staff.get("pin_hash", "")):
        raise HTTPException(status_code=401, detail="Incorrect PIN")

    token = create_access_token({
        "sub": staff["id"],
        "name": staff["name"],
        "role": staff["role"]
    })

    # Set httpOnly cookie — inaccessible to JavaScript, resistant to XSS token theft
    response.set_cookie(
        key="bdvv_token",
        value=token,
        httponly=True,
        samesite="lax",
        max_age=ACCESS_TOKEN_EXPIRE_HOURS * 3600,
        path="/",
    )

    await db.activity_log.insert_one({
        "id": str(uuid.uuid4()),
        "entity_type": "auth",
        "entity_id": staff["id"],
        "action": "login",
        "details": f"{staff['name']} logged in",
        "user_name": staff["name"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    user_data = serialize_doc({k: v for k, v in staff.items() if k not in ['_id', 'pin_hash']})
    # Return token in body as well for clients that need it (backward compatibility)
    return {"token": token, "user": user_data}


@api_router.post("/auth/logout")
async def logout(response: Response):
    """Clear the httpOnly auth cookie."""
    response.delete_cookie(key="bdvv_token", path="/")
    return {"success": True}


@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user


# ── Enquiry Endpoints ──────────────────────────────────────────────────────

@api_router.get("/enquiries")
async def get_enquiries(
    stage: Optional[str] = None,
    company: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if stage:
        query["pipeline_stage"] = stage
    if company:
        query["company"] = company
    enquiries = await db.enquiries.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [serialize_doc(e) for e in enquiries]


@api_router.post("/enquiries")
async def create_enquiry(enquiry: EnquiryCreate, current_user: dict = Depends(get_current_user)):
    doc = enquiry.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    doc["created_by"] = current_user["name"]
    doc["status"] = "New"
    await db.enquiries.insert_one(doc)
    doc.pop("_id", None)
    await db.activity_log.insert_one({
        "id": str(uuid.uuid4()), "entity_type": "enquiry", "entity_id": doc["id"],
        "action": "created", "details": f"New enquiry: {doc['client_name']} -> {doc['destination']}",
        "user_name": current_user["name"], "created_at": datetime.now(timezone.utc).isoformat()
    })
    # Auto-create follow-up alert 2 days after enquiry creation
    follow_up_due = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    await db.alerts.insert_one({
        "id": str(uuid.uuid4()),
        "message": f"Follow up due: {doc['client_name']} \u2014 {doc['destination']} enquiry",
        "due_at": follow_up_due,
        "linked_entity_type": "enquiry",
        "linked_entity_id": doc["id"],
        "linked_entity_name": doc["client_name"],
        "type": "auto_followup",
        "repeat": "none",
        "dismissed": False,
        "snoozed_until": None,
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.get("name", ""),
    })
    return doc


@api_router.get("/enquiries/{enquiry_id}")
async def get_enquiry(enquiry_id: str, current_user: dict = Depends(get_current_user)):
    enquiry = await db.enquiries.find_one({"id": enquiry_id}, {"_id": 0})
    if not enquiry:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    return serialize_doc(enquiry)


@api_router.put("/enquiries/{enquiry_id}")
async def update_enquiry(enquiry_id: str, enquiry: EnquiryCreate, current_user: dict = Depends(get_current_user)):
    update_data = enquiry.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.enquiries.update_one({"id": enquiry_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    updated = await db.enquiries.find_one({"id": enquiry_id}, {"_id": 0})
    return serialize_doc(updated)


@api_router.patch("/enquiries/{enquiry_id}/stage")
async def update_stage(enquiry_id: str, update: EnquiryStageUpdate, current_user: dict = Depends(get_current_user)):
    result = await db.enquiries.update_one(
        {"id": enquiry_id},
        {"$set": {"pipeline_stage": update.stage, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    await db.activity_log.insert_one({
        "id": str(uuid.uuid4()), "entity_type": "enquiry", "entity_id": enquiry_id,
        "action": "stage_changed", "details": f"Stage -> {update.stage}",
        "user_name": current_user["name"], "created_at": datetime.now(timezone.utc).isoformat()
    })
    updated = await db.enquiries.find_one({"id": enquiry_id}, {"_id": 0})
    return serialize_doc(updated)


@api_router.patch("/enquiries/{enquiry_id}/followup")
async def set_followup(enquiry_id: str, update: FollowupUpdate, current_user: dict = Depends(get_current_user)):
    result = await db.enquiries.update_one(
        {"id": enquiry_id},
        {"$set": {"followup_at": update.followup_at, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    updated = await db.enquiries.find_one({"id": enquiry_id}, {"_id": 0})
    return serialize_doc(updated)


@api_router.patch("/enquiries/{enquiry_id}/lost")
async def mark_lost(enquiry_id: str, update: LostUpdate, current_user: dict = Depends(get_current_user)):
    result = await db.enquiries.update_one(
        {"id": enquiry_id},
        {"$set": {
            "pipeline_stage": "Lost",
            "lost_reason": update.lost_reason,
            "lost_notes": update.lost_notes,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    await db.activity_log.insert_one({
        "id": str(uuid.uuid4()), "entity_type": "enquiry", "entity_id": enquiry_id,
        "action": "marked_lost", "details": f"Lost reason: {update.lost_reason}",
        "user_name": current_user["name"], "created_at": datetime.now(timezone.utc).isoformat()
    })
    updated = await db.enquiries.find_one({"id": enquiry_id}, {"_id": 0})
    return serialize_doc(updated)


@api_router.patch("/enquiries/{enquiry_id}/assign")
async def assign_enquiry(enquiry_id: str, update: AssignUpdate, current_user: dict = Depends(get_current_user)):
    result = await db.enquiries.update_one(
        {"id": enquiry_id},
        {"$set": {
            "assigned_to_staff_id": update.staff_id,
            "assigned_to_name": update.staff_name,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    updated = await db.enquiries.find_one({"id": enquiry_id}, {"_id": 0})
    return serialize_doc(updated)


@api_router.patch("/enquiries/{enquiry_id}/client")
async def link_client(enquiry_id: str, update: LinkClientUpdate, current_user: dict = Depends(get_current_user)):
    result = await db.enquiries.update_one(
        {"id": enquiry_id},
        {"$set": {"client_id": update.client_id, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    updated = await db.enquiries.find_one({"id": enquiry_id}, {"_id": 0})
    return serialize_doc(updated)


@api_router.get("/enquiries/{enquiry_id}/notes")
async def get_enquiry_notes(enquiry_id: str, current_user: dict = Depends(get_current_user)):
    notes = await db.notes.find(
        {"entity_id": enquiry_id, "entity_type": "enquiry"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return [serialize_doc(n) for n in notes]


@api_router.post("/enquiries/{enquiry_id}/notes")
async def add_enquiry_note(enquiry_id: str, note: NoteCreate, current_user: dict = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "entity_type": "enquiry",
        "entity_id": enquiry_id,
        "note": note.note,
        "author_name": current_user["name"],
        "author_staff_id": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notes.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.delete("/enquiries/{enquiry_id}")
async def delete_enquiry(enquiry_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.enquiries.delete_one({"id": enquiry_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    return {"message": "Deleted"}


# ── Client Endpoints ───────────────────────────────────────────────────────

@api_router.get("/clients")
async def get_clients(
    q: Optional[str] = None,
    phone: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    filters = []
    if q:
        filters.append({"$or": [
            {"full_name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
            {"passport_no": {"$regex": q, "$options": "i"}}
        ]})
    if phone:
        filters.append({"phone": {"$regex": phone, "$options": "i"}})
    if filters:
        query = {"$and": filters} if len(filters) > 1 else filters[0]
    clients = await db.clients.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [serialize_doc(c) for c in clients]


@api_router.post("/clients")
async def create_client(client: ClientCreate, current_user: dict = Depends(get_current_user)):
    doc = client.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    doc["created_by"] = current_user["name"]
    doc["ff_numbers"] = []
    doc["document_vault"] = []
    await db.clients.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/clients/{client_id}")
async def get_client(client_id: str, current_user: dict = Depends(get_current_user)):
    c = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Client not found")
    return serialize_doc(c)


@api_router.put("/clients/{client_id}")
async def update_client(client_id: str, client: ClientCreate, current_user: dict = Depends(get_current_user)):
    update_data = client.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.clients.update_one({"id": client_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Client not found")
    updated = await db.clients.find_one({"id": client_id}, {"_id": 0})
    return serialize_doc(updated)


@api_router.delete("/clients/{client_id}")
async def delete_client(client_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.clients.delete_one({"id": client_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Client not found")
    return {"message": "Deleted"}


@api_router.post("/clients/{client_id}/documents")
async def add_document(client_id: str, doc_data: DocumentAdd, current_user: dict = Depends(get_current_user)):
    doc_entry = {
        "id": str(uuid.uuid4()),
        "title": doc_data.title,
        "doc_type": doc_data.doc_type,
        "notes": doc_data.notes,
        "image_data": doc_data.image_data,
        "added_by": current_user["name"],
        "added_at": datetime.now(timezone.utc).isoformat()
    }
    result = await db.clients.update_one(
        {"id": client_id},
        {"$push": {"document_vault": doc_entry}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Client not found")
    return doc_entry


@api_router.delete("/clients/{client_id}/documents/{doc_id}")
async def delete_document(client_id: str, doc_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.clients.update_one(
        {"id": client_id},
        {"$pull": {"document_vault": {"id": doc_id}}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Client not found")
    return {"message": "Deleted"}


@api_router.get("/clients/{client_id}/notes")
async def get_client_notes(client_id: str, current_user: dict = Depends(get_current_user)):
    notes = await db.notes.find(
        {"entity_id": client_id, "entity_type": "client"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return [serialize_doc(n) for n in notes]


@api_router.post("/clients/{client_id}/notes")
async def add_client_note(client_id: str, note: NoteCreate, current_user: dict = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "entity_type": "client",
        "entity_id": client_id,
        "note": note.note,
        "author_name": current_user["name"],
        "author_staff_id": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notes.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/clients/{client_id}/enquiries")
async def get_client_enquiries(client_id: str, current_user: dict = Depends(get_current_user)):
    enquiries = await db.enquiries.find(
        {"client_id": client_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return [serialize_doc(e) for e in enquiries]


# ── Client Categorized Document File Uploads ─────────────────────────────────

ALLOWED_DOC_CATEGORIES = [
    "passport_identity", "financial", "cover_letter",
    "visa_application", "travel_proof", "photographs"
]

ALLOWED_FILE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "application/pdf"]


@api_router.post("/clients/{client_id}/files")
async def upload_client_file(
    client_id: str,
    file: UploadFile = File(...),
    category: str = Form(...),
    note: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    c = await db.clients.find_one({"id": client_id})
    if not c:
        raise HTTPException(status_code=404, detail="Client not found")
    if file.content_type not in ALLOWED_FILE_TYPES:
        raise HTTPException(status_code=400, detail="File type not allowed. Use PNG, JPG, WEBP or PDF.")
    if category not in ALLOWED_DOC_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category.")
    file_dir = UPLOADS_DIR / "clients" / client_id
    file_dir.mkdir(parents=True, exist_ok=True)
    file_id = str(uuid.uuid4())
    suffix = Path(file.filename or "file").suffix.lower() or ".bin"
    file_name = f"{file_id}{suffix}"
    file_path = file_dir / file_name
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    doc = {
        "id": file_id,
        "client_id": client_id,
        "category": category,
        "original_name": file.filename or file_name,
        "file_name": file_name,
        "file_url": f"/api/uploads/clients/{client_id}/{file_name}",
        "file_type": file.content_type,
        "size": len(content),
        "note": note or "",
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "uploaded_by": current_user.get("name", ""),
    }
    await db.client_documents.insert_one(doc)
    return serialize_doc({k: v for k, v in doc.items() if k != "_id"})


@api_router.get("/clients/{client_id}/files")
async def list_client_files(client_id: str, current_user: dict = Depends(get_current_user)):
    files = await db.client_documents.find(
        {"client_id": client_id}, {"_id": 0}
    ).sort("uploaded_at", -1).to_list(200)
    return [serialize_doc(f) for f in files]


@api_router.delete("/clients/{client_id}/files/{file_id}")
async def delete_client_file(client_id: str, file_id: str, current_user: dict = Depends(get_current_user)):
    file_doc = await db.client_documents.find_one({"id": file_id, "client_id": client_id})
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    file_path = UPLOADS_DIR / "clients" / client_id / file_doc["file_name"]
    if file_path.exists():
        file_path.unlink()
    await db.client_documents.delete_one({"id": file_id})
    return {"status": "deleted"}


# ── CRM Endpoints ──────────────────────────────────────────────────────────

@api_router.get("/crm/followups")
async def get_crm_followups(current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    today_end = now.replace(hour=23, minute=59, second=59, microsecond=999999).isoformat()

    due_today = await db.enquiries.find(
        {
            "followup_at": {"$gte": today_start, "$lte": today_end},
            "pipeline_stage": {"$nin": ["Lost", "Converted"]}
        },
        {"_id": 0}
    ).to_list(50)

    overdue = await db.enquiries.find(
        {
            "followup_at": {"$lt": today_start, "$ne": None, "$exists": True},
            "pipeline_stage": {"$nin": ["Lost", "Converted"]}
        },
        {"_id": 0}
    ).to_list(50)

    return {
        "due_today": [serialize_doc(e) for e in due_today],
        "overdue": [serialize_doc(e) for e in overdue]
    }


# ── Dashboard Endpoints ────────────────────────────────────────────────────

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    total_leads = await db.enquiries.count_documents({"created_at": {"$gte": month_start}})
    conversions = await db.enquiries.count_documents({"pipeline_stage": "Converted"})
    try:
        active_bookings = await db.bookings.count_documents({"status": "Confirmed"})
    except Exception:
        active_bookings = 0
    stages = ["New", "Qualified", "Quoted", "Follow-up", "Converted", "Lost"]
    pipeline = {s: await db.enquiries.count_documents({"pipeline_stage": s}) for s in stages}
    service_types = ["Tour", "Flight", "Visa", "Passport", "Insurance"]
    services = {st: await db.enquiries.count_documents({"service_type": st}) for st in service_types}
    activities = await db.activity_log.find({}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    return {
        "total_leads_month": total_leads, "conversions": conversions,
        "active_bookings": active_bookings, "revenue": 0,
        "pipeline_breakdown": pipeline, "service_breakdown": services,
        "recent_activity": [serialize_doc(a) for a in activities]
    }


@api_router.get("/dashboard/alerts")
async def get_dashboard_alerts(current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    next_7 = (now + timedelta(days=7)).date().isoformat()
    next_60 = (now + timedelta(days=60)).date().isoformat()
    today = now.date().isoformat()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    today_end = now.replace(hour=23, minute=59, second=59, microsecond=999999).isoformat()

    departures = await db.enquiries.find(
        {"travel_date": {"$gte": today, "$lte": next_7}, "pipeline_stage": {"$in": ["Converted"]}},
        {"_id": 0}
    ).to_list(20)
    try:
        passports = await db.clients.find(
            {"passport_expiry": {"$gte": today, "$lte": next_60}}, {"_id": 0}
        ).to_list(20)
    except Exception:
        passports = []
    try:
        visa_apps = await db.visa_applications.find(
            {"appointment_date": {"$gte": today, "$lte": next_7}}, {"_id": 0}
        ).to_list(20)
    except Exception:
        visa_apps = []
    try:
        wa_unread = await db.whatsapp_messages.count_documents({"is_read": False})
    except Exception:
        wa_unread = 0

    followups_due = await db.enquiries.find(
        {
            "followup_at": {"$gte": today_start, "$lte": today_end},
            "pipeline_stage": {"$nin": ["Lost", "Converted"]}
        },
        {"_id": 0}
    ).to_list(20)

    followups_overdue = await db.enquiries.find(
        {
            "followup_at": {"$lt": today_start, "$ne": None, "$exists": True},
            "pipeline_stage": {"$nin": ["Lost", "Converted"]}
        },
        {"_id": 0}
    ).to_list(20)

    return {
        "departures": [serialize_doc(d) for d in departures],
        "passport_expiries": [serialize_doc(p) for p in passports],
        "visa_appointments": [serialize_doc(v) for v in visa_apps],
        "overdue_payments": [], "wa_unread": wa_unread, "insurance_renewals": [],
        "followups_due_today": [serialize_doc(f) for f in followups_due],
        "followups_overdue": [serialize_doc(f) for f in followups_overdue]
    }


# ── Sites Endpoints ────────────────────────────────────────────────────────

@api_router.get("/sites")
async def get_saved_sites(current_user: dict = Depends(get_current_user)):
    sites = await db.saved_sites.find({}, {"_id": 0}).sort("sort_order", 1).to_list(200)
    return [serialize_doc(s) for s in sites]


@api_router.post("/sites")
async def add_saved_site(site: SavedSiteCreate, current_user: dict = Depends(get_current_user)):
    doc = site.model_dump()
    doc.update({"id": str(uuid.uuid4()), "added_by": current_user["name"], "sort_order": 999,
                "created_at": datetime.now(timezone.utc).isoformat()})
    await db.saved_sites.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.delete("/sites/{site_id}")
async def delete_saved_site(site_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.saved_sites.delete_one({"id": site_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Site not found")
    return {"message": "Deleted"}


# ── Staff & Activity ───────────────────────────────────────────────────────

@api_router.get("/staff")
async def get_staff(current_user: dict = Depends(get_current_user)):
    staff = await db.staff.find({}, {"_id": 0, "pin_hash": 0}).to_list(100)
    return [serialize_doc(s) for s in staff]


@api_router.get("/activity")
async def get_activity(limit: int = 20, current_user: dict = Depends(get_current_user)):
    activities = await db.activity_log.find({}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return [serialize_doc(a) for a in activities]




# ── Quote Helpers ──────────────────────────────────────────────────────────

QUOTE_STATUSES = ["Draft", "Sent", "Accepted", "Rejected"]
QUOTE_TYPES = ["International Tour", "International Tour + Cruise", "Domestic"]
ITEM_CATEGORIES = ["Hotels", "Flights", "Visa Fees", "Transfers", "Sightseeing", "Misc"]
CURRENCIES = ["INR", "USD", "AED", "EUR", "GBP", "SGD", "THB", "MYR", "LKR", "NPR"]


async def generate_quote_number() -> str:
    year = datetime.now(timezone.utc).year
    counter_key = f"quote_no_{year}"
    result = await db.counters.find_one_and_update(
        {"key": counter_key},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True
    )
    seq = result["seq"]
    return f"QT-{year}-{seq:03d}"


def compute_quote_totals(
    items_raw: List[QuoteItemCreate],
    markup_type: str = "percentage",
    markup_value: float = 0.0,
    gst_rate: float = 0.0,
    tcs_rate: float = 0.0,
    tcs_enabled: bool = False,
) -> dict:
    """Compute all quote financial totals.
    Formula:
      Operating Cost (OC) = sum of (qty × unit_price × roe_to_base) across all items
      Markup   = OC × markup_value% (if percentage) OR flat markup_value (if fixed)
      Sub-total = OC + Markup
      GST      = Sub-total × gst_rate%
      TCS      = (Sub-total + GST) × tcs_rate%  (only when tcs_enabled)
      Grand Total = Sub-total + GST + TCS
    """
    computed_items = []
    operating_cost = 0.0
    for item_in in items_raw:
        qty = float(item_in.qty or 1)
        unit_price = float(item_in.unit_price or 0)
        roe = float(item_in.roe_to_base or 1.0)
        amt = round(qty * unit_price, 2)
        amt_base = round(amt * roe, 2)
        operating_cost += amt_base
        d = item_in.model_dump()
        d["id"] = d.get("id") or str(uuid.uuid4())
        d["amount"] = amt
        d["amount_base"] = amt_base
        computed_items.append(d)

    operating_cost = round(operating_cost, 2)

    if markup_type == "percentage":
        markup_amount = round(operating_cost * float(markup_value) / 100.0, 2)
    else:
        markup_amount = round(float(markup_value), 2)

    subtotal = round(operating_cost + markup_amount, 2)
    gst_amount = round(subtotal * float(gst_rate or 0) / 100.0, 2)

    tcs_amount = 0.0
    if tcs_enabled:
        tcs_amount = round((subtotal + gst_amount) * float(tcs_rate or 0) / 100.0, 2)

    grand_total = round(subtotal + gst_amount + tcs_amount, 2)

    return {
        "items": computed_items,
        "operating_cost": operating_cost,
        "markup_amount": markup_amount,
        "subtotal": subtotal,
        "gst_amount": gst_amount,
        "tcs_amount": tcs_amount,
        "grand_total_base": grand_total,
    }


def generate_quote_pdf(quote: dict) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=15 * mm, leftMargin=15 * mm, topMargin=15 * mm, bottomMargin=15 * mm
    )
    styles = getSampleStyleSheet()
    brand_dark = rl_colors.HexColor("#0a1628")
    brand_gold = rl_colors.HexColor("#c9a84c")
    brand_light = rl_colors.HexColor("#f2f4f8")
    story = []

    # ── Header: Logo + Company Info + Quotation title ──────────────────────────
    logo_path = str(ROOT_DIR / "static" / "bdv_logo.png")
    logo_cell = RLImage(logo_path, width=58 * mm, height=20 * mm) if os.path.exists(logo_path) else \
        Paragraph("<b>Blue Diamond Voyage &amp; Vision</b>",
                  ParagraphStyle("logo", parent=styles["Normal"], fontSize=13,
                                 textColor=brand_dark, fontName="Helvetica-Bold"))

    company_info = Paragraph(
        "<font size='8'><b>Blue Diamond Voyage &amp; Vision</b><br/>"
        "<font color='#5b6475'>IATA No: 14347782  &nbsp;|&nbsp; Rajkot, Gujarat, India<br/>"
        "+91 97148 59797</font></font>",
        ParagraphStyle("co", parent=styles["Normal"], fontSize=8, textColor=brand_dark)
    )

    ht = Table([[
        logo_cell,
        company_info,
        Paragraph(
            f"<b>QUOTATION</b><br/>"
            f"<font size='9' color='#5b6475'>{quote.get('quote_no', '')}</font>",
            ParagraphStyle("qt", parent=styles["Normal"], fontSize=22,
                           textColor=brand_gold, fontName="Helvetica-Bold", alignment=TA_RIGHT)
        )
    ]], colWidths=[62 * mm, 58 * mm, 60 * mm])
    ht.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, 0), 1.5, brand_gold),
    ]))
    story.append(ht)
    story.append(Spacer(1, 3 * mm))

    mt = Table([[
        "Date:", (quote.get("created_at") or "")[:10],
        "Status:", quote.get("status", "Draft"),
        "Valid Until:", quote.get("validity_date") or "—"
    ]], colWidths=[18 * mm, 35 * mm, 16 * mm, 22 * mm, 22 * mm, 67 * mm])
    mt.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("FONTNAME", (4, 0), (4, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BACKGROUND", (0, 0), (-1, -1), brand_light),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(mt)
    story.append(Spacer(1, 4 * mm))

    ct = Table([
        ["Client:", quote.get("client_name") or "—", "Destination:", quote.get("destination") or "—"],
        ["Phone:", quote.get("phone") or "—", "Travel Date:", quote.get("travel_date") or "—"],
        ["Email:", quote.get("email") or "—", "Return Date:", quote.get("return_date") or "—"],
        ["Quote Type:", quote.get("quote_type") or "—", "Pax:",
         f"{quote.get('pax_adults', 1)} Adults, {quote.get('pax_children', 0)} Children"],
        ["Base Currency:", quote.get("base_currency") or "INR", "", ""],
    ], colWidths=[25 * mm, 60 * mm, 28 * mm, 67 * mm])
    ct.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [rl_colors.white, brand_light]),
        ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.4, rl_colors.HexColor("#e6e9f0")),
    ]))
    story.append(ct)
    story.append(Spacer(1, 5 * mm))

    items = quote.get("items", [])
    if items:
        story.append(Paragraph(
            "<b>Package Inclusions</b>",
            ParagraphStyle("sec", parent=styles["Normal"], fontSize=11, textColor=brand_dark,
                           fontName="Helvetica-Bold", spaceAfter=3)
        ))
        # Client-facing table — NO pricing columns; only what is included
        ih = ["#", "Category", "Service / Description", "Qty"]
        rows = [ih]
        for idx, item in enumerate(items, 1):
            title_desc = item.get("title", "")
            if item.get("description"):
                title_desc += "\n" + item["description"]
            rows.append([
                str(idx),
                item.get("category", ""),
                title_desc,
                f"{item.get('qty', 1):.0f}",
            ])
        it = Table(rows, colWidths=[8*mm, 28*mm, 128*mm, 16*mm], repeatRows=1)
        it.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), brand_dark),
            ("TEXTCOLOR", (0, 0), (-1, 0), rl_colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("ALIGN", (3, 0), (3, -1), "CENTER"),
            ("ALIGN", (0, 0), (0, -1), "CENTER"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [rl_colors.white, brand_light]),
            ("GRID", (0, 0), (-1, -1), 0.4, rl_colors.HexColor("#e6e9f0")),
            ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        story.append(it)
        story.append(Spacer(1, 5 * mm))

    gt = quote.get("grand_total_base", 0)
    bc = quote.get("base_currency", "INR")

    # ── Grand Total only — no breakdown rows shown to client ──────────────────
    gst_r  = quote.get("gst_rate", 0)
    tcs_en = quote.get("tcs_enabled", False)
    tcs_r  = quote.get("tcs_rate", 0)
    tax_note = f"(Incl. GST {float(gst_r):.1f}%"
    if tcs_en:
        tax_note += f" + TCS {float(tcs_r):.1f}%"
    tax_note += ")"

    gtt = Table([[
        Paragraph(
            f"<b>TOTAL AMOUNT ({bc})</b><br/>"
            f"<font size='7' color='#c9a84c'>{tax_note}</font>",
            ParagraphStyle("gtl", parent=styles["Normal"], fontSize=12,
                           textColor=rl_colors.white, fontName="Helvetica-Bold")),
        Paragraph(f"<b>{gt:,.2f}</b>",
                  ParagraphStyle("gtr", parent=styles["Normal"], fontSize=13,
                                 textColor=brand_gold, fontName="Helvetica-Bold", alignment=TA_RIGHT)),
    ]], colWidths=[130 * mm, 50 * mm])
    gtt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), brand_dark),
        ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(gtt)

    if quote.get("notes"):
        story.append(Spacer(1, 5 * mm))
        story.append(Paragraph(
            "<b>Notes / Terms</b>",
            ParagraphStyle("nh", parent=styles["Normal"], fontSize=9, textColor=brand_dark,
                           fontName="Helvetica-Bold", spaceAfter=2)
        ))
        story.append(Paragraph(
            quote["notes"],
            ParagraphStyle("nb", parent=styles["Normal"], fontSize=8,
                           textColor=rl_colors.HexColor("#555555"))
        ))

    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph(
        "This is a computer-generated quotation. Prices are valid until the validity date mentioned above.",
        ParagraphStyle("ft", parent=styles["Normal"], fontSize=7,
                       textColor=rl_colors.HexColor("#888888"), alignment=TA_CENTER)
    ))
    doc.build(story)
    return buffer.getvalue()


def generate_quote_excel(quote: dict) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Quotation"

    D_HEX = "0A1628"
    L_HEX = "F2F4F8"

    def sc(cell, bold=False, size=10, col="000000", bg=None, align="left", wrap=False):
        cell.font = Font(name="Calibri", bold=bold, size=size, color=col)
        if bg:
            cell.fill = PatternFill(start_color=bg, end_color=bg, fill_type="solid")
        cell.alignment = Alignment(horizontal=align, vertical="center", wrap_text=wrap)

    # ── Header rows: logo area + company info ──────────────────────────────────
    # Row 1-3: logo (left) + company info (right) + quote title (center)
    ws.row_dimensions[1].height = 32
    ws.row_dimensions[2].height = 16
    ws.row_dimensions[3].height = 16

    # Add logo image
    logo_path = os.path.join(os.path.dirname(__file__), "static", "bdv_logo.png")
    if os.path.exists(logo_path):
        try:
            xl_logo = XLImage(logo_path)
            xl_logo.width = 168   # pixels ≈ 6cm
            xl_logo.height = 56   # pixels ≈ 2cm
            ws.add_image(xl_logo, "A1")
        except Exception:
            pass  # silently skip if image fails

    # Company info in F1-J3
    ws.merge_cells("F1:J3")
    ci = ws.cell(row=1, column=6,
                 value="Blue Diamond Voyage & Vision\nIATA: 14347782  |  Rajkot, Gujarat, India\n+91 97148 59797")
    sc(ci, bold=False, size=9, align="right")
    ci.alignment = Alignment(horizontal="right", vertical="center", wrap_text=True)

    # Thin gold divider in row 4
    ws.row_dimensions[4].height = 4
    for col in range(1, 11):
        c4 = ws.cell(row=4, column=col, value="")
        c4.fill = PatternFill(start_color="C9A84C", end_color="C9A84C", fill_type="solid")

    for col, val, bold in [
        (1, "Quote No:", True), (2, quote.get("quote_no", ""), False),
        (5, "Status:", True), (6, quote.get("status", "Draft"), False),
    ]:
        sc(ws.cell(row=5, column=col, value=val), bold=bold, size=9)

    for col, val, bold in [
        (1, "Date:", True), (2, (quote.get("created_at") or "")[:10], False),
        (5, "Valid Until:", True), (6, quote.get("validity_date") or "—", False),
    ]:
        sc(ws.cell(row=6, column=col, value=val), bold=bold, size=9)

    ws.row_dimensions[5].height = 17
    ws.row_dimensions[6].height = 17

    r = 8
    c2 = ws.cell(row=r, column=1, value="CLIENT & TRAVEL DETAILS")
    sc(c2, bold=True, size=10, col=D_HEX)
    ws.row_dimensions[r].height = 20
    r += 1

    client_rows = [
        ("Client", quote.get("client_name") or "—", "Destination", quote.get("destination") or "—"),
        ("Phone", quote.get("phone") or "—", "Travel Date", quote.get("travel_date") or "—"),
        ("Email", quote.get("email") or "—", "Return Date", quote.get("return_date") or "—"),
        ("Quote Type", quote.get("quote_type") or "—", "Pax",
         f"{quote.get('pax_adults', 1)} Adults, {quote.get('pax_children', 0)} Children"),
        ("Base Currency", quote.get("base_currency") or "INR", "", ""),
    ]
    for i, (l1, v1, l2, v2) in enumerate(client_rows):
        bg = L_HEX if i % 2 == 0 else "FFFFFF"
        for col, val, bold in [(1, l1, True), (2, v1, False), (5, l2, True), (6, v2, False)]:
            sc(ws.cell(row=r, column=col, value=val), bold=bold, size=9, bg=bg)
        ws.row_dimensions[r].height = 17
        r += 1

    r += 1
    # Client-facing headers — no pricing columns
    item_hdrs = ["#", "Category", "Service / Title", "Description", "Qty"]
    for j, h in enumerate(item_hdrs, 1):
        sc(ws.cell(row=r, column=j, value=h), bold=True, size=9, col="FFFFFF", bg=D_HEX, align="center")
    ws.row_dimensions[r].height = 22
    r += 1

    for idx, item in enumerate(quote.get("items", []), 1):
        bg = "FFFFFF" if idx % 2 != 0 else L_HEX
        vals = [
            (1, idx, "center"),
            (2, item.get("category", ""), "left"),
            (3, item.get("title", ""), "left"),
            (4, item.get("description") or "", "left"),
            (5, item.get("qty", 1), "right"),
        ]
        for col, val, align in vals:
            c3 = ws.cell(row=r, column=col, value=val)
            sc(c3, size=9, bg=bg, align=align)
        ws.row_dimensions[r].height = 17
        r += 1

    # No breakdown rows (Operating Cost, Markup, etc.) — client-facing only
    r += 1

    # Build tax note
    gst_r  = quote.get("gst_rate", 0)
    tcs_en = quote.get("tcs_enabled", False)
    tcs_r  = quote.get("tcs_rate", 0)
    tax_note = f"Incl. GST {float(gst_r):.1f}%"
    if tcs_en:
        tax_note += f" + TCS {float(tcs_r):.1f}%"

    total_label = f"TOTAL AMOUNT ({quote.get('base_currency','INR')})  —  {tax_note}"
    gc = ws.cell(row=r, column=1, value=total_label)
    sc(gc, bold=True, size=11, col="FFFFFF", bg=D_HEX, align="right")
    ws.merge_cells(f"A{r}:D{r}")
    gtc = ws.cell(row=r, column=5, value=quote.get("grand_total_base", 0))
    sc(gtc, bold=True, size=11, col="C9A84C", bg=D_HEX, align="right")
    gtc.number_format = "#,##0.00"
    ws.row_dimensions[r].height = 24

    if quote.get("notes"):
        r += 2
        sc(ws.cell(row=r, column=1, value="Notes / Terms:"), bold=True, size=9)
        r += 1
        c4 = ws.cell(row=r, column=1, value=quote["notes"])
        sc(c4, size=9, wrap=True)
        ws.merge_cells(f"A{r}:E{r}")
        ws.row_dimensions[r].height = 40

    for i, w in enumerate([4, 14, 28, 30, 8], 1):
        ws.column_dimensions[get_column_letter(i)].width = w

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# ── Quote Endpoints ────────────────────────────────────────────────────────

@api_router.post("/quotes")
async def create_quote(quote: QuoteCreate, current_user: dict = Depends(get_current_user)):
    quote_no = await generate_quote_number()
    totals = compute_quote_totals(
        items_raw=quote.items,
        markup_type=quote.markup_type,
        markup_value=quote.markup_value,
        gst_rate=quote.gst_rate,
        tcs_rate=quote.tcs_rate,
        tcs_enabled=quote.tcs_enabled,
    )
    doc = {
        "id": str(uuid.uuid4()),
        "quote_no": quote_no,
        "status": "Draft",
        "quote_type": quote.quote_type,
        "base_currency": quote.base_currency,
        "enquiry_id": quote.enquiry_id,
        "client_id": quote.client_id,
        "client_name": quote.client_name,
        "phone": quote.phone,
        "email": quote.email,
        "destination": quote.destination,
        "travel_date": quote.travel_date,
        "return_date": quote.return_date,
        "pax_adults": quote.pax_adults,
        "pax_children": quote.pax_children,
        "pax_infant": quote.pax_infant,
        "validity_date": quote.validity_date,
        "notes": quote.notes,
        "markup_type": quote.markup_type,
        "markup_value": quote.markup_value,
        "gst_rate": quote.gst_rate,
        "tcs_rate": quote.tcs_rate,
        "tcs_enabled": quote.tcs_enabled,
        "items": totals["items"],
        "operating_cost": totals["operating_cost"],
        "markup_amount": totals["markup_amount"],
        "subtotal": totals["subtotal"],
        "gst_amount": totals["gst_amount"],
        "tcs_amount": totals["tcs_amount"],
        "grand_total_base": totals["grand_total_base"],
        "itinerary_id": quote.itinerary_id,
        "created_by_staff_id": current_user["id"],
        "created_by_name": current_user["name"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.quotes.insert_one(doc)
    doc.pop("_id", None)
    return serialize_doc(doc)


@api_router.get("/quotes")
async def list_quotes(
    status: Optional[str] = None,
    q: Optional[str] = None,
    enquiry_id: Optional[str] = None,
    client_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if status:
        query["status"] = status
    if enquiry_id:
        query["enquiry_id"] = enquiry_id
    if client_id:
        query["client_id"] = client_id
    if q:
        query["$or"] = [
            {"quote_no": {"$regex": q, "$options": "i"}},
            {"client_name": {"$regex": q, "$options": "i"}},
            {"destination": {"$regex": q, "$options": "i"}},
        ]
    quotes = await db.quotes.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [serialize_doc(qt) for qt in quotes]


@api_router.get("/quotes/{quote_id}")
async def get_quote(quote_id: str, current_user: dict = Depends(get_current_user)):
    qt = await db.quotes.find_one({"id": quote_id}, {"_id": 0})
    if not qt:
        raise HTTPException(status_code=404, detail="Quote not found")
    return serialize_doc(qt)


@api_router.put("/quotes/{quote_id}")
async def update_quote(quote_id: str, quote: QuoteCreate, current_user: dict = Depends(get_current_user)):
    existing = await db.quotes.find_one({"id": quote_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Quote not found")
    totals = compute_quote_totals(
        items_raw=quote.items,
        markup_type=quote.markup_type,
        markup_value=quote.markup_value,
        gst_rate=quote.gst_rate,
        tcs_rate=quote.tcs_rate,
        tcs_enabled=quote.tcs_enabled,
    )
    update_data = {
        "quote_type": quote.quote_type,
        "base_currency": quote.base_currency,
        "enquiry_id": quote.enquiry_id,
        "client_id": quote.client_id,
        "client_name": quote.client_name,
        "phone": quote.phone,
        "email": quote.email,
        "destination": quote.destination,
        "travel_date": quote.travel_date,
        "return_date": quote.return_date,
        "pax_adults": quote.pax_adults,
        "pax_children": quote.pax_children,
        "pax_infant": quote.pax_infant,
        "validity_date": quote.validity_date,
        "notes": quote.notes,
        "markup_type": quote.markup_type,
        "markup_value": quote.markup_value,
        "gst_rate": quote.gst_rate,
        "tcs_rate": quote.tcs_rate,
        "tcs_enabled": quote.tcs_enabled,
        "items": totals["items"],
        "operating_cost": totals["operating_cost"],
        "markup_amount": totals["markup_amount"],
        "subtotal": totals["subtotal"],
        "gst_amount": totals["gst_amount"],
        "tcs_amount": totals["tcs_amount"],
        "grand_total_base": totals["grand_total_base"],
        "itinerary_id": quote.itinerary_id,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.quotes.update_one({"id": quote_id}, {"$set": update_data})
    updated = await db.quotes.find_one({"id": quote_id}, {"_id": 0})
    return serialize_doc(updated)


@api_router.delete("/quotes/{quote_id}")
async def delete_quote(quote_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.quotes.delete_one({"id": quote_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Quote not found")
    return {"message": "Deleted"}


@api_router.patch("/quotes/{quote_id}/status")
async def update_quote_status(
    quote_id: str, update: QuoteStatusUpdate, current_user: dict = Depends(get_current_user)
):
    if update.status not in QUOTE_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {QUOTE_STATUSES}")
    result = await db.quotes.update_one(
        {"id": quote_id},
        {"$set": {"status": update.status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Quote not found")
    updated = await db.quotes.find_one({"id": quote_id}, {"_id": 0})
    return serialize_doc(updated)


@api_router.get("/quotes/{quote_id}/export/pdf")
async def export_quote_pdf(quote_id: str, current_user: dict = Depends(get_current_user)):
    qt = await db.quotes.find_one({"id": quote_id}, {"_id": 0})
    if not qt:
        raise HTTPException(status_code=404, detail="Quote not found")
    quote = serialize_doc(qt)
    pdf_bytes = generate_quote_pdf(quote)
    filename = f"{quote.get('quote_no', 'quote')}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@api_router.get("/quotes/{quote_id}/export/excel")
async def export_quote_excel(quote_id: str, current_user: dict = Depends(get_current_user)):
    qt = await db.quotes.find_one({"id": quote_id}, {"_id": 0})
    if not qt:
        raise HTTPException(status_code=404, detail="Quote not found")
    quote = serialize_doc(qt)
    excel_bytes = generate_quote_excel(quote)
    filename = f"{quote.get('quote_no', 'quote')}.xlsx"
    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


# ── Root ───────────────────────────────────────────────────────────────────

@api_router.get("/")
async def root():
    return {"message": "BDV TravelOS API v2.0", "status": "online"}


# ── Seeding Data ───────────────────────────────────────────────────────────

DEFAULT_STAFF = [
    {"name": "Yash Doshi", "role": "admin", "pin": "0000", "avatar_color": "#0a1628", "initials": "YD"},
    {"name": "Karan", "role": "sales", "pin": "1111", "avatar_color": "#16a34a", "initials": "KR"},
    {"name": "Khushi", "role": "operations", "pin": "2222", "avatar_color": "#7c3aed", "initials": "KH"},
    {"name": "Priyanka", "role": "accounts", "pin": "3333", "avatar_color": "#dc2626", "initials": "PR"},
    {"name": "Prushti", "role": "sales", "pin": "4444", "avatar_color": "#ea580c", "initials": "PS"},
]

DEFAULT_SITES = [
    {"label": "Stuba", "url": "https://www.stuba.com", "category": "Hotels", "sort_order": 1},
    {"label": "Expedia TAAP India", "url": "https://taap.expedia.co.in", "category": "Hotels", "sort_order": 2},
    {"label": "MakeMyTrip Partner", "url": "https://www.makemytrip.com/travel-agent-login", "category": "Hotels", "sort_order": 3},
    {"label": "Otilla", "url": "https://www.otilla.com", "category": "Hotels", "sort_order": 4},
    {"label": "Viator", "url": "https://www.viator.com", "category": "Tours", "sort_order": 10},
    {"label": "Civitatis", "url": "https://www.civitatis.com/en", "category": "Tours", "sort_order": 11},
    {"label": "GetYourGuide", "url": "https://www.getyourguide.com", "category": "Tours", "sort_order": 12},
    {"label": "Riya Connect", "url": "https://www.riyaconnect.in", "category": "Flights", "sort_order": 20},
    {"label": "Aadesh Travels", "url": "https://www.aadeshaviation.com", "category": "Flights", "sort_order": 21},
    {"label": "VFS Global", "url": "https://www.vfsglobal.com", "category": "Visa", "sort_order": 30},
    {"label": "Passport Seva", "url": "https://passportindia.gov.in", "category": "Visa", "sort_order": 31},
    {"label": "BLS International", "url": "https://blsinternational.com", "category": "Visa", "sort_order": 32},
    {"label": "IRCTC", "url": "https://www.irctc.co.in", "category": "Other", "sort_order": 40},
    {"label": "Booking.com", "url": "https://www.booking.com", "category": "Other", "sort_order": 42},
    {"label": "Skyscanner", "url": "https://www.skyscanner.co.in", "category": "Other", "sort_order": 43},
]

SAMPLE_ENQUIRIES = [
    {"client_name": "Raj Mehta", "phone": "9876543210", "destination": "Dubai", "travel_date": "2025-08-15", "pax_adults": 2, "pax_children": 1, "service_type": "Tour", "pipeline_stage": "New", "travel_type": "Family", "source": "WhatsApp", "budget": "1,50,000"},
    {"client_name": "Priya Sharma", "phone": "9898765432", "destination": "Thailand", "travel_date": "2025-09-01", "pax_adults": 2, "pax_children": 0, "service_type": "Tour", "pipeline_stage": "Qualified", "travel_type": "Honeymoon", "source": "Walk-in", "budget": "2,00,000"},
    {"client_name": "Amit Patel", "phone": "9712345678", "destination": "Singapore", "travel_date": "2025-08-20", "pax_adults": 4, "pax_children": 2, "service_type": "Tour", "pipeline_stage": "Quoted", "travel_type": "Family", "source": "Referral", "budget": "3,50,000"},
    {"client_name": "Sneha Joshi", "phone": "9654321098", "destination": "UK", "travel_date": "2025-10-15", "pax_adults": 2, "pax_children": 0, "service_type": "Visa", "pipeline_stage": "Follow-up", "travel_type": "Honeymoon", "source": "Online", "budget": "4,00,000"},
    {"client_name": "Vijay Gupta", "phone": "9512345678", "destination": "Maldives", "travel_date": "2025-08-05", "pax_adults": 2, "pax_children": 0, "service_type": "Tour", "pipeline_stage": "Converted", "travel_type": "Honeymoon", "source": "Referral", "budget": "2,50,000"},
    {"client_name": "Anita Desai", "phone": "9432109876", "destination": "Europe", "travel_date": "2025-11-01", "pax_adults": 2, "pax_children": 1, "service_type": "Tour", "pipeline_stage": "New", "travel_type": "Family", "source": "WhatsApp", "budget": "5,00,000"},
    {"client_name": "Rahul Shah", "phone": "9321098765", "destination": "Bali", "travel_date": "2025-09-15", "pax_adults": 2, "pax_children": 0, "service_type": "Tour", "pipeline_stage": "Quoted", "travel_type": "Honeymoon", "source": "Walk-in", "budget": "1,80,000"},
    {"client_name": "Kavya Nair", "phone": "9210987654", "destination": "Japan", "travel_date": "2025-10-01", "pax_adults": 2, "pax_children": 0, "service_type": "Flight", "pipeline_stage": "Follow-up", "travel_type": "Adventure", "source": "Online", "budget": "3,00,000"},
    {"client_name": "Dev Trivedi", "phone": "9109876543", "destination": "Mauritius", "travel_date": "2025-08-25", "pax_adults": 2, "pax_children": 0, "service_type": "Tour", "pipeline_stage": "Converted", "travel_type": "Honeymoon", "source": "Referral", "budget": "2,20,000"},
    {"client_name": "Meera Kapoor", "phone": "9009876543", "destination": "USA", "travel_date": "2025-12-01", "pax_adults": 2, "pax_children": 2, "service_type": "Visa", "pipeline_stage": "Lost", "travel_type": "Family", "source": "Walk-in", "budget": "6,00,000"},
]

SAMPLE_CLIENTS = [
    {"full_name": "Raj Mehta", "phone": "9876543210", "email": "raj.mehta@email.com", "dob": "1985-03-15", "nationality": "Indian", "passport_no": "Z1234567", "passport_expiry": "2028-03-14", "seat_preference": "Window", "meal_preference": "Veg", "hotel_rating": "4 Star", "notes": "Preferred: non-smoking rooms", "address": "Mumbai"},
    {"full_name": "Priya Sharma", "phone": "9898765432", "email": "priya.sharma@email.com", "dob": "1992-07-22", "nationality": "Indian", "passport_no": "M9876543", "passport_expiry": "2027-06-30", "seat_preference": "Aisle", "meal_preference": "Non-Veg", "hotel_rating": "5 Star", "notes": "Honeymoon preferences", "address": "Pune"},
    {"full_name": "Vijay Gupta", "phone": "9512345678", "email": "vijay.gupta@email.com", "dob": "1980-11-10", "nationality": "Indian", "passport_no": "J5678901", "passport_expiry": "2026-11-09", "seat_preference": "Aisle", "meal_preference": "Jain", "hotel_rating": "4 Star", "notes": "VIP client - 5+ trips", "address": "Ahmedabad"},
]


async def seed_database():
    if await db.staff.count_documents({}) == 0:
        for s in DEFAULT_STAFF:
            doc = {
                "id": str(uuid.uuid4()), "name": s["name"], "role": s["role"],
                "pin_hash": pwd_context.hash(s["pin"]), "avatar_color": s["avatar_color"],
                "initials": s["initials"], "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.staff.insert_one(doc)
        logger.info("Seeded default staff")

    if await db.saved_sites.count_documents({}) == 0:
        for site in DEFAULT_SITES:
            doc = {"id": str(uuid.uuid4()), "added_by": "System",
                   "created_at": datetime.now(timezone.utc).isoformat(), **site}
            await db.saved_sites.insert_one(doc)
        logger.info("Seeded default sites")

    if await db.enquiries.count_documents({}) == 0:
        for e in SAMPLE_ENQUIRIES:
            doc = {
                "id": str(uuid.uuid4()), "email": "", "return_date": "", "notes": "",
                "assigned_to": "", "company": "BDVV", "status": "New", "created_by": "System",
                "client_id": None, "assigned_to_staff_id": None, "assigned_to_name": None,
                "followup_at": None, "lost_reason": None, "lost_notes": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(), **e
            }
            await db.enquiries.insert_one(doc)
        logger.info("Seeded sample enquiries")

    if await db.clients.count_documents({}) == 0:
        for c in SAMPLE_CLIENTS:
            doc = {
                "id": str(uuid.uuid4()), "created_by": "System",
                "ff_numbers": [], "document_vault": [],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(), **c
            }
            await db.clients.insert_one(doc)
        logger.info("Seeded sample clients")


OLD_TO_NEW_STAGES = {
    "New Enquiry": "New",
    "Follow Up": "Follow-up",
    "Confirmed": "Converted",
    "Invoiced": "Converted",
    "Closed": "Lost"
}


async def migrate_stages():
    for old_stage, new_stage in OLD_TO_NEW_STAGES.items():
        result = await db.enquiries.update_many(
            {"pipeline_stage": old_stage},
            {"$set": {"pipeline_stage": new_stage}}
        )
        if result.modified_count > 0:
            logger.info(f"Migrated {result.modified_count} enquiries from '{old_stage}' to '{new_stage}'")


@app.on_event("startup")
async def startup_event():
    await seed_database()
    await migrate_stages()


# ── File Upload Endpoints ───────────────────────────────────────────────────

@api_router.post("/file-upload/{module}/{record_id}")
async def upload_file(
    module: str,
    record_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    allowed_types = ["image/png", "image/jpeg", "image/webp", "image/jpg", "application/pdf"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="File type not allowed. Use PNG, JPG, WEBP or PDF.")
    file_dir = UPLOADS_DIR / module / record_id
    file_dir.mkdir(parents=True, exist_ok=True)
    file_id = str(uuid.uuid4())
    suffix = Path(file.filename or "file").suffix.lower() or ".bin"
    file_name = f"{file_id}{suffix}"
    file_path = file_dir / file_name
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    doc = {
        "id": file_id,
        "module": module,
        "record_id": record_id,
        "original_name": file.filename or file_name,
        "file_name": file_name,
        "file_url": f"/api/uploads/{module}/{record_id}/{file_name}",
        "file_type": file.content_type,
        "size": len(content),
        "note": "",
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "uploaded_by": current_user.get("name", ""),
    }
    await db.file_uploads.insert_one(doc)
    return serialize_doc({k: v for k, v in doc.items() if k != "_id"})


@api_router.get("/file-upload/{module}/{record_id}")
async def list_uploads(module: str, record_id: str, current_user: dict = Depends(get_current_user)):
    files = await db.file_uploads.find(
        {"module": module, "record_id": record_id}, {"_id": 0}
    ).sort("uploaded_at", -1).to_list(100)
    return [serialize_doc(f) for f in files]


@api_router.delete("/file-upload/{module}/{record_id}/{file_id}")
async def delete_upload(module: str, record_id: str, file_id: str, current_user: dict = Depends(get_current_user)):
    file_doc = await db.file_uploads.find_one({"id": file_id, "module": module, "record_id": record_id})
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    file_path = UPLOADS_DIR / module / record_id / file_doc["file_name"]
    if file_path.exists():
        file_path.unlink()
    await db.file_uploads.delete_one({"id": file_id})
    return {"status": "deleted"}


@api_router.patch("/file-upload/{module}/{record_id}/{file_id}/note")
async def update_file_note(module: str, record_id: str, file_id: str, body: dict, current_user: dict = Depends(get_current_user)):
    await db.file_uploads.update_one({"id": file_id}, {"$set": {"note": body.get("note", "")}})
    updated = await db.file_uploads.find_one({"id": file_id}, {"_id": 0})
    return serialize_doc(updated)


# ── Alerts Endpoints ────────────────────────────────────────────────────────

@api_router.get("/alerts/unread-count")
async def get_alert_unread_count(current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    count = await db.alerts.count_documents({
        "dismissed": False,
        "is_read": False,
        "$or": [
            {"snoozed_until": None},
            {"snoozed_until": {"$lte": now}},
        ],
    })
    return {"count": count}


@api_router.get("/alerts")
async def list_alerts(current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    alerts = await db.alerts.find(
        {
            "dismissed": False,
            "$or": [
                {"snoozed_until": None},
                {"snoozed_until": {"$lte": now}},
            ],
        },
        {"_id": 0}
    ).sort("due_at", 1).to_list(200)
    return [serialize_doc(a) for a in alerts]


@api_router.post("/alerts")
async def create_alert(alert: AlertCreate, current_user: dict = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "message": alert.message,
        "due_at": alert.due_at or datetime.now(timezone.utc).isoformat(),
        "linked_entity_type": alert.linked_entity_type,
        "linked_entity_id": alert.linked_entity_id,
        "linked_entity_name": alert.linked_entity_name,
        "type": "custom",
        "repeat": alert.repeat,
        "dismissed": False,
        "snoozed_until": None,
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.get("name", ""),
    }
    await db.alerts.insert_one(doc)
    return serialize_doc({k: v for k, v in doc.items() if k != "_id"})


@api_router.patch("/alerts/{alert_id}/read")
async def mark_alert_read(alert_id: str, current_user: dict = Depends(get_current_user)):
    await db.alerts.update_one({"id": alert_id}, {"$set": {"is_read": True}})
    return {"status": "ok"}


@api_router.patch("/alerts/{alert_id}/dismiss")
async def dismiss_alert(alert_id: str, body: dict = None, current_user: dict = Depends(get_current_user)):
    body = body or {}
    alert = await db.alerts.find_one({"id": alert_id})
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    re_alert = body.get("re_alert", False)
    if re_alert and not alert.get("dismissed"):
        # Re-alert after 1 day
        re_alert_date = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
        new_alert = {k: v for k, v in alert.items() if k not in ("_id", "id")}
        new_alert["id"] = str(uuid.uuid4())
        new_alert["dismissed"] = False
        new_alert["is_read"] = False
        new_alert["snoozed_until"] = None
        new_alert["due_at"] = re_alert_date
        new_alert["type"] = "re_alert"
        await db.alerts.insert_one(new_alert)
    await db.alerts.update_one({"id": alert_id}, {"$set": {"dismissed": True, "is_read": True}})
    return {"status": "dismissed"}


@api_router.patch("/alerts/{alert_id}/snooze")
async def snooze_alert(alert_id: str, body: AlertSnooze, current_user: dict = Depends(get_current_user)):
    await db.alerts.update_one({"id": alert_id}, {"$set": {"snoozed_until": body.snoozed_until, "is_read": True}})
    return {"status": "snoozed"}


# ── Visa Application Endpoints ────────────────────────────────────────────────

STANDARD_VISA_DOCS = [
    "Passport Copy (Front & Back)",
    "Photo (35x45mm White Background)",
    "Bank Statement (3 months)",
    "Bank Balance Certificate",
    "ITR / Form 16 (3 years)",
    "Cover Letter",
    "Confirmed Hotel Booking",
    "Confirmed Flight Tickets",
    "Travel Insurance",
    "Leave Approval / NOC",
    "Visa Application Form",
]


@api_router.post("/visa-applications")
async def create_visa_application(data: VisaApplicationCreate, current_user: dict = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "enquiry_id": data.enquiry_id,
        "client_name": data.client_name,
        "country": data.country,
        "visa_type": data.visa_type,
        "appointment_date": data.appointment_date,
        "submission_date": data.submission_date,
        "notes": data.notes or "",
        "status": data.status,
        "applicants": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.get("name", ""),
    }
    await db.visa_applications.insert_one(doc)
    return serialize_doc({k: v for k, v in doc.items() if k != "_id"})


@api_router.get("/visa-applications")
async def list_visa_applications(
    enquiry_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    q = {}
    if enquiry_id:
        q["enquiry_id"] = enquiry_id
    apps = await db.visa_applications.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [serialize_doc(a) for a in apps]


@api_router.get("/visa-applications/{app_id}")
async def get_visa_application(app_id: str, current_user: dict = Depends(get_current_user)):
    app = await db.visa_applications.find_one({"id": app_id}, {"_id": 0})
    if not app:
        raise HTTPException(status_code=404, detail="Visa application not found")
    return serialize_doc(app)


@api_router.put("/visa-applications/{app_id}")
async def update_visa_application(app_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    data.pop("_id", None)
    data.pop("id", None)
    await db.visa_applications.update_one({"id": app_id}, {"$set": data})
    updated = await db.visa_applications.find_one({"id": app_id}, {"_id": 0})
    if not updated:
        raise HTTPException(status_code=404, detail="Not found")
    return serialize_doc(updated)


@api_router.delete("/visa-applications/{app_id}")
async def delete_visa_application(app_id: str, current_user: dict = Depends(get_current_user)):
    await db.visa_applications.delete_one({"id": app_id})
    return {"status": "deleted"}


@api_router.post("/visa-applications/{app_id}/applicants")
async def add_visa_applicant(app_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    applicant_id = str(uuid.uuid4())
    checklist = [
        {"id": str(uuid.uuid4()), "doc_name": doc, "status": "pending", "file_id": None, "file_url": None, "file_name": None}
        for doc in STANDARD_VISA_DOCS
    ]
    applicant = {
        "id": applicant_id,
        "name": data.get("name", ""),
        "passport_no": data.get("passport_no", ""),
        "dob": data.get("dob", ""),
        "checklist": checklist,
        "added_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.visa_applications.update_one(
        {"id": app_id},
        {"$push": {"applicants": applicant}}
    )
    return serialize_doc(applicant)


@api_router.put("/visa-applications/{app_id}/applicants/{applicant_id}")
async def update_visa_applicant(
    app_id: str,
    applicant_id: str,
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    app = await db.visa_applications.find_one({"id": app_id})
    if not app:
        raise HTTPException(status_code=404, detail="Not found")
    applicants = app.get("applicants", [])
    applicants = [data if a["id"] == applicant_id else a for a in applicants]
    await db.visa_applications.update_one({"id": app_id}, {"$set": {"applicants": applicants}})
    return serialize_doc(data)


@api_router.delete("/visa-applications/{app_id}/applicants/{applicant_id}")
async def delete_visa_applicant(
    app_id: str,
    applicant_id: str,
    current_user: dict = Depends(get_current_user)
):
    await db.visa_applications.update_one(
        {"id": app_id},
        {"$pull": {"applicants": {"id": applicant_id}}}
    )
    return {"status": "deleted"}


@api_router.patch("/visa-applications/{app_id}/applicants/{applicant_id}/checklist/{doc_id}")
async def update_checklist_item(
    app_id: str,
    applicant_id: str,
    doc_id: str,
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    app = await db.visa_applications.find_one({"id": app_id})
    if not app:
        raise HTTPException(status_code=404, detail="Not found")
    updated_applicants = []
    for applicant in app.get("applicants", []):
        if applicant["id"] == applicant_id:
            checklist = [
                {**item, **{k: v for k, v in data.items() if k != "id"}} if item["id"] == doc_id else item
                for item in applicant.get("checklist", [])
            ]
            applicant = {**applicant, "checklist": checklist}
        updated_applicants.append(applicant)
    await db.visa_applications.update_one({"id": app_id}, {"$set": {"applicants": updated_applicants}})
    return {"status": "updated"}


# ── Transport Models ───────────────────────────────────────────────────────

class TransportBookingCreate(BaseModel):
    transport_type: str  # "flight", "train", "bus", "taxi"
    booking_ref: Optional[str] = None
    # Route
    from_location: str
    to_location: str
    dep_date: str   # ISO date string
    dep_time: Optional[str] = None
    arr_time: Optional[str] = None
    # Carrier info
    carrier_name: Optional[str] = None  # airline, train operator, bus company, taxi firm
    carrier_code: Optional[str] = None  # flight no / train no / bus no
    # Pax
    pax_adults: int = 1
    pax_children: int = 0
    pax_infants: int = 0
    # Pricing
    amount: float = 0
    currency: str = "INR"
    # Class / seat info
    travel_class: Optional[str] = None   # Economy, Business, First, Sleeper, etc.
    seat_numbers: Optional[str] = None
    # Additional
    enquiry_id: Optional[str] = None
    client_name: Optional[str] = None
    status: str = "Confirmed"   # Confirmed, Pending, Cancelled
    notes: Optional[str] = None


class TransportBookingUpdate(BaseModel):
    transport_type: Optional[str] = None
    booking_ref: Optional[str] = None
    from_location: Optional[str] = None
    to_location: Optional[str] = None
    dep_date: Optional[str] = None
    dep_time: Optional[str] = None
    arr_time: Optional[str] = None
    carrier_name: Optional[str] = None
    carrier_code: Optional[str] = None
    pax_adults: Optional[int] = None
    pax_children: Optional[int] = None
    pax_infants: Optional[int] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    travel_class: Optional[str] = None
    seat_numbers: Optional[str] = None
    enquiry_id: Optional[str] = None
    client_name: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


# ── QuickLink Models ────────────────────────────────────────────────────────

class QuickLinkCreate(BaseModel):
    label: str
    url: str
    icon: Optional[str] = None        # emoji or icon name
    category: Optional[str] = "General"   # e.g. "Flights", "Hotels", "Visa", "General"
    color: Optional[str] = None       # hex color for card accent


# ── Brand Settings Models ────────────────────────────────────────────────────

class BrandSettingsUpdate(BaseModel):
    company_name: Optional[str] = None
    tagline: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    country: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    iata_code: Optional[str] = None
    logo_base64: Optional[str] = None   # base64 encoded logo


# ── Transport Endpoints ─────────────────────────────────────────────────────

@api_router.get("/transport")
async def list_transport_bookings(
    transport_type: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if transport_type:
        query["transport_type"] = transport_type
    if status:
        query["status"] = status
    bookings = await db.transport_bookings.find(query).sort("dep_date", -1).to_list(200)
    return [serialize_doc(b) for b in bookings]


@api_router.post("/transport")
async def create_transport_booking(
    data: TransportBookingCreate,
    current_user: dict = Depends(get_current_user)
):
    booking = data.dict()
    booking["id"] = str(uuid.uuid4())
    booking["created_at"] = datetime.now(timezone.utc).isoformat()
    booking["created_by"] = current_user["id"]
    await db.transport_bookings.insert_one(booking)
    return serialize_doc(booking)


@api_router.get("/transport/{booking_id}")
async def get_transport_booking(
    booking_id: str,
    current_user: dict = Depends(get_current_user)
):
    booking = await db.transport_bookings.find_one({"id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return serialize_doc(booking)


@api_router.put("/transport/{booking_id}")
async def update_transport_booking(
    booking_id: str,
    data: TransportBookingUpdate,
    current_user: dict = Depends(get_current_user)
):
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.transport_bookings.update_one({"id": booking_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    booking = await db.transport_bookings.find_one({"id": booking_id})
    return serialize_doc(booking)


@api_router.delete("/transport/{booking_id}")
async def delete_transport_booking(
    booking_id: str,
    current_user: dict = Depends(get_current_user)
):
    result = await db.transport_bookings.delete_one({"id": booking_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    return {"status": "deleted"}


# ── QuickLinks Endpoints ────────────────────────────────────────────────────

@api_router.get("/quick-links")
async def list_quick_links(current_user: dict = Depends(get_current_user)):
    links = await db.quick_links.find({}).sort("created_at", 1).to_list(200)
    return [serialize_doc(l) for l in links]


@api_router.post("/quick-links")
async def create_quick_link(
    data: QuickLinkCreate,
    current_user: dict = Depends(get_current_user)
):
    link = data.dict()
    link["id"] = str(uuid.uuid4())
    link["created_at"] = datetime.now(timezone.utc).isoformat()
    link["created_by"] = current_user["id"]
    await db.quick_links.insert_one(link)
    return serialize_doc(link)


@api_router.delete("/quick-links/{link_id}")
async def delete_quick_link(
    link_id: str,
    current_user: dict = Depends(get_current_user)
):
    result = await db.quick_links.delete_one({"id": link_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Link not found")
    return {"status": "deleted"}


# ── Brand Settings Endpoints ────────────────────────────────────────────────

@api_router.get("/settings/brand")
async def get_brand_settings(current_user: dict = Depends(get_current_user)):
    settings = await db.brand_settings.find_one({"brand": "bdvv"})
    if not settings:
        # Return default BDVV settings
        return {
            "brand": "bdvv",
            "company_name": "Blue Diamond Voyage & Vision",
            "tagline": "Your Complete Travel Operations Platform",
            "address_line1": "",
            "address_line2": "",
            "city": "",
            "state": "",
            "pincode": "",
            "country": "India",
            "phone": "",
            "email": "",
            "website": "",
            "gstin": "",
            "pan": "",
            "iata_code": "14347782",
            "logo_base64": None
        }
    return serialize_doc(settings)


@api_router.put("/settings/brand")
async def update_brand_settings(
    data: BrandSettingsUpdate,
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["brand"] = "bdvv"
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = current_user["id"]
    await db.brand_settings.update_one(
        {"brand": "bdvv"},
        {"$set": update_data},
        upsert=True
    )
    settings = await db.brand_settings.find_one({"brand": "bdvv"})
    return serialize_doc(settings)


# ── Staff Management Endpoints ──────────────────────────────────────────────

@api_router.get("/staff")
async def list_all_staff(current_user: dict = Depends(get_current_user)):
    staff = await db.staff.find({}, {"_id": 0, "pin_hash": 0}).sort("name", 1).to_list(200)
    return [serialize_doc(s) for s in staff]


@api_router.post("/staff")
async def create_staff(
    data: StaffCreate,
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    if len(data.pin) != 4 or not data.pin.isdigit():
        raise HTTPException(status_code=400, detail="PIN must be exactly 4 digits")
    # Check duplicate name
    existing = await db.staff.find_one({"name": {"$regex": f"^{data.name.strip()}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail="A staff member with this name already exists")
    name = data.name.strip()
    new_staff = {
        "id": str(uuid.uuid4()),
        "name": name,
        "role": data.role,
        "initials": get_initials(name),
        "avatar_color": get_avatar_color(name),
        "pin_hash": pwd_context.hash(data.pin),
        "is_active": True,
        "is_protected": name.lower() in PROTECTED_ADMINS,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"],
    }
    await db.staff.insert_one(new_staff)
    result = {k: v for k, v in new_staff.items() if k not in ["_id", "pin_hash"]}
    return serialize_doc(result)


@api_router.put("/staff/{staff_id}")
async def update_staff(
    staff_id: str,
    data: StaffUpdate,
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    staff = await db.staff.find_one({"id": staff_id})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    update_data = {}
    if data.name:
        name = data.name.strip()
        update_data["name"] = name
        update_data["initials"] = get_initials(name)
        update_data["is_protected"] = name.lower() in PROTECTED_ADMINS
    if data.role:
        # Cannot downgrade a protected admin from admin role
        if staff.get("is_protected") and data.role != "admin":
            raise HTTPException(status_code=400, detail="Cannot change role of a protected admin")
        update_data["role"] = data.role
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.staff.update_one({"id": staff_id}, {"$set": update_data})
    updated = await db.staff.find_one({"id": staff_id}, {"_id": 0, "pin_hash": 0})
    return serialize_doc(updated)


@api_router.post("/staff/{staff_id}/reset-pin")
async def reset_staff_pin(
    staff_id: str,
    data: StaffPinReset,
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    if len(data.new_pin) != 4 or not data.new_pin.isdigit():
        raise HTTPException(status_code=400, detail="PIN must be exactly 4 digits")
    staff = await db.staff.find_one({"id": staff_id})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    await db.staff.update_one(
        {"id": staff_id},
        {"$set": {"pin_hash": pwd_context.hash(data.new_pin), "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"status": "PIN reset successfully"}


@api_router.delete("/staff/{staff_id}")
async def delete_staff(
    staff_id: str,
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    staff = await db.staff.find_one({"id": staff_id})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    # Cannot delete yourself
    if staff_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    # Cannot delete protected admins
    if staff.get("is_protected") or staff.get("name", "").lower() in PROTECTED_ADMINS:
        raise HTTPException(status_code=400, detail="Cannot delete a protected admin account")
    await db.staff.delete_one({"id": staff_id})
    return {"status": "deleted"}


# ── Compass AI Assistant ────────────────────────────────────────────────────

import json as _json
import asyncio as _asyncio
from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

COMPASS_SYSTEM_PROMPT = """
═══════════════════════════════════════════════════════════════
COMPASS — BDV TRAVEL PLANNING AI  |  SYSTEM INSTRUCTIONS v4.0
Blue Diamond Voyage & Vision · TravelOS
═══════════════════════════════════════════════════════════════

──────────────────────────────────────────────────────────────
PRIME DIRECTIVE — EFFICIENCY MANDATE
──────────────────────────────────────────────────────────────
Get to a bookable draft with the FEWEST possible questions.
Every question has a cost: client fatigue, agent time, lost leads.
Therefore: PARSE FIRST → INFER SECOND → DEFAULT THIRD → ASK LAST.
Never ask for anything you can extract, infer, look up, or safely assume-and-flag.

STAGE 0 — PASTE-FIRST INTAKE
─────────────────────────────
0.1 Detect the input type before doing anything else

Input looks like                             | Treat as
Forwarded WhatsApp, email, call notes,       | PASTE MODE → run Enquiry Parser (0.2)
screenshot, voice-note transcript            |
Shorthand code (e.g., BALI 5N 2A 12-17Oct)  | AGENT SHORTHAND → expand to intake card
A sentence or two ("client wants Bali Oct")  | CONVERSATIONAL → extract, then one MCQ round

0.2 Enquiry Parser (paste mode)
Extract every field the text contains — including implied ones.
Read like an experienced consultant, not a form-filler:
  "mummy papa bhi aa rahe" → multi-gen group → pace = relaxed, mobility check needed
  "25th anniversary" → occasion = celebration → romantic touches, cake/decor upsell
  "school ki chhutti me" → date window = Gujarat school vacation calendar
  "zyada mehenga nahi" → budget = Economy-Smart; quote value tier first
  Sender's city/number/language → likely departure city and communication channel
  Names → dietary probability (ask only if destination makes it critical)

Then output the Intake Card — always this exact format:

📋 INTAKE CARD — [client name / lead ref]

✅ CAPTURED (from their message)
   Destination: … | Dates: … | Pax: … | Budget: … | Occasion: …

🧠 INFERRED (correct me if wrong)
   Departure: Rajkot→BOM/AMD ✈ | Passport: Indian | Pace: relaxed | …

❓ MISSING — need only these:
   [max 4 items, as MCQs per Stage 1 rules]

The agent confirms/corrects the card in one line. Never re-ask anything in ✅ or 🧠 sections.

0.3 The Critical Six (PACKAGE MODE only)
Single-service enquiries (visa only, flight only…) skip this — use shorter per-service flows.
For packages, only six fields are ever BLOCKING. If paste/shorthand covers them, ask NOTHING and go to destination resolution:
  1. Destination (or "wants suggestions")
  2. Dates — or month + number of nights
  3. Pax composition (adults / children+ages / seniors)
  4. Departure city
  5. Budget band (or a number)
  6. Occasion / trip style

Everything else is deferred — collected at the stage where it actually matters (Progressive Profiling below).

0.4 Agent Shorthand — expand directly into intake card
Format: [DEST] [nights]N [pax] [dates] [hotel★] [band] [flags]

Pax:   2A = 2 adults · 2A2C(8,12) = +kids with ages · 2A2S = +seniors
Band:  eco / mid / lux / ultra
Flags: HM=honeymoon  FAM=family  CORP=corporate  VEG=pure veg  JAIN=jain
       VISA=needs visa  TATKAL=urgent

Example: BALI 5N 2A 12-17Oct 4* mid HM VEG

One line = full intake. Missing pieces get smart defaults, flagged in Assumption Ledger.

──────────────────────────────────────────────────────────────
STAGE 1 — MINIMAL SMART ELICITATION
──────────────────────────────────────────────────────────────
1.1 The Question Gate — before asking ANYTHING, pass all three tests:
  A. Can't get it another way? Not extractable, not inferable, not in lead history, not publicly lookup-able.
  B. Materially changes the plan? Would the answer change cost >10%, change destination shortlist, or create a feasibility/safety issue? If not — assume likely answer and flag it.
  C. Needed NOW? Guide personality, stay-vibe, experience wishlist etc. are Stage 4–5 questions. Don't ask at intake.

1.2 MCQ format rules (strict)
  • Max ONE round of max 4 questions at intake.
  • A second round is allowed ONLY if the first round's answers created a genuine fork.
  • Every question ships with 3–4 options + a starred smart default, and every option carries a consequence hint:

  Example:
  1. Hotel style for Bali? (reply "1b" or just "1" for default)
     a) Beach resort, Nusa Dua — calm, family-safe
     b) ⭐ Private pool villa, Ubud+Seminyak split — the honeymoon classic
     c) Cliff luxury, Uluwatu — dramatic, adds ₹35–50k
     d) Mix — villa 3N + beach 2N

  Options must be destination-specific and profile-specific — never generic ("a) budget b) mid c) luxury" is banned when you know it's a Bali honeymoon).
  Accept compressed replies: "1b 2a 3-" ("-" or skip = take the default).
  Silence/skip on any question = default applies, logged in the ledger.

1.3 Inference Library (apply silently, always flag in the ledger)
  Missing          | Default                                          | Basis
  Departure city   | BDV/Glocalique → Rajkot via BOM/AMD             | engagement brand + client's number/country code
  Passport         | Indian, ≥6 months validity                       | confirm only when visa is on critical path
  Budget (none)    | Mid band for that destination, quoted as RANGE   | destination's realistic median for pax type
  Pace             | Family/seniors → relaxed; couple → moderate      | pax composition
  Meal pref        | Veg-available ensured; Jain/veg confirmed only   | Gujarat client base
                   | where it's hard (Japan, Korea, interior Europe)  |
  Season fit       | Auto-check climate + festivals + surge dates     | never ask "did you know it's monsoon" — state it
  Visa need        | Computed from passport × destination × dates     | never ask the client
  Channel          | WhatsApp, matching their message language        | their own message language

1.4 Assumption Ledger (the safety net that makes minimal-asking safe)
Every inferred or defaulted value appears at the top of every draft until confirmed:

  ⚠ ASSUMED — say "fix 2" to change any line
  1. Departure BOM (RAJ has no direct)   2. Mid band ₹1.4–1.7L/couple
  3. Veg meals ensured                   4. Indian passports, valid 6m+

  An assumption confirmed by the agent/client moves silently into the profile.
  An assumption that survives to the Agent Review Gate (Stage 6) must be resolved there — the gate cannot pass with unconfirmed ⚠ items that affect price or feasibility.

1.5 Progressive Profiling (how the full 9-step profile still gets built)
  Profile dimension              | Collected at
  Intent, pax, dates, budget,    | Intake (Critical Six)
  destination                    |
  Dealbreakers, dietary,         | Intake MCQ round — one combined question
  mobility                       | options pre-filled from pax composition
  Transport & stay prefs         | Stage 4, only for services actually selected,
                                 | as MCQs between real options
  Experiences & guide style      | Stage 5, while choosing between concrete tours
  Communication prefs            | Inferred from how the enquiry arrived

──────────────────────────────────────────────────────────────
EFFICIENCY RULES (CRITICAL — always apply)
──────────────────────────────────────────────────────────────
• Re-parse, never re-ask: if it was in any earlier message, it is KNOWN.
• Returning client → preload profile from bdv-lead-manage history; open with "Same preferences as your Dubai trip — veg meals, window seats?" not a form.
• Every intake interaction ends with a next step and an ETA for the draft — the client should never wonder what happens next.
• Track it: if a booking needed >8 total questions end-to-end, note which could have been inferred, and tighten the Inference Library.

──────────────────────────────────────────────────────────────
1 · IDENTITY & OPERATOR CONTEXT
──────────────────────────────────────────────────────────────
You are Compass, the AI travel consultant embedded inside Blue Diamond Voyage's Travel Agency OS (TravelOS).
Primary consultant: Yash Doshi (yashdoshi@bluediamondvoyage.com), Director — Blue Diamond Voyage & Vision, Rajkot.
You serve three brands:
  • Blue Diamond Voyage (BDV) — Rajkot, full-service traditional agency. DEFAULT brand.
  • Glocalique — creative B2B experience curation.
  • Blue Diamond Vision — premium honeymoons & luxury travel.
Default brand is BDV unless the lead source or conversation explicitly states Glocalique or Blue Diamond Vision.

You operate in two modes:
1. Internal consultant mode — Yash (or any BDV staff) is talking to you directly: answer queries, draft documents, analyse pipelines, research destinations, suggest options, summarise emails, run calculations, build quotes and itineraries.
2. Client interaction mode — when managing a live client conversation: draft all client-facing responses, run intake sequences, produce quotes, itineraries, and follow-up messages for the consultant to review and approve before sending. Mirror the client's language and tone. Never send anything directly.

──────────────────────────────────────────
2 · FOUR LAWS (never break, ever)
──────────────────────────────────────────
1. VERIFY, NEVER INVENT. Every fare, hour, rule, visa requirement, and rate carries a source + checked date. Anything unverifiable is tagged ⚠ VERIFY with an explicit note.
2. HUMAN GATE. No quote, email, booking, or itinerary reaches a client or supplier until the consultant explicitly approves it. You draft; they send.
3. DEALBREAKERS OVER PREFERENCES; CEILING OVER EVERYTHING. A client's must-avoids and budget ceiling override any "great deal."
4. EXPLAIN EVERYTHING. Every recommendation includes "Why this fits" (traced to the client profile) + one alternative considered + verification trail.

──────────────────────────────────────────
3 · KNOWLEDGE HIERARCHY
──────────────────────────────────────────
Priority for every fact:
1. BDV Agency Destination Database (480 curated destinations across 9 continents — Asia 129, Europe 146, North America 99, Oceania 63, Africa 17, Middle East 12, South America 12, Arctic 1, Antarctica 1). When a destination is mentioned in the conversation, a structured BDV record is automatically injected into your context containing: IATA airport codes, best/shoulder/avoid months, season notes, climate & terrain tags, interests & occasions suitability, top attractions list, activities list, and official tourism site URLs. ALWAYS use this injected data as your first source for destination facts. Never ignore the injected BDV record.
2. Live official sources — for time-sensitive facts: current prices, real-time availability, current visa rules, travel advisories. Supplement the BDV database with live sources for anything dated or transactional.
3. Recent local blogs / social posts — trends and experience ideas ONLY. Never use for prices, opening hours, or visa rules.
If a live source contradicts the DB record, trust the live source and flag the DB record as potentially stale.

──────────────────────────────────────────
4 · CORE MODULES (auto-activate by trigger)
──────────────────────────────────────────
• Lead Manager — new enquiry, silent lead, pipeline review
• Earth Compass Intake — new trip conversation (5-screen elicitation, see §6)
• Service Picker — menu-driven intake for each required service (see §Step 1 & Step 2)
• Tour Designer — day-by-day plan from scratch
• Live Itinerary — hour-by-hour verified schedule
• Transport Desk — flights, trains, ferries, cruises, buses, transfers, self-drive
• Visa & Passport — eligibility, checklists, cover letters, appointments
• Quote Builder — branded client quote/proposal
• Support Desk — complaint, disruption, emergency
• Marketing — posts, WhatsApp broadcasts, newsletters
• Live Browse — source cross-referencing, transit routing, live price checks
• Destination Finder — destination shortlist based on client preferences

──────────────────────────────────────────
STEP 1 — SERVICE PICKER (run at the start of every new enquiry)
──────────────────────────────────────────
At the very beginning of any new trip or service enquiry — before asking any other question — present the following service menu and ask the client (or consultant) to select one or more:

> **Which service(s) do you need today?** *(You can pick more than one)*
>
> 1. ✈️  Flights
> 2. 🏨  Hotel / Accommodation
> 3. 🛂  Visa Application / Renewal
> 4. 📘  Passport Application / Renewal
> 5. 🗺️  Tours & Tour Guide
> 6. 👤  Tour Manager
> 7. 🛡️  Travel Insurance
> 8. 📦  Tour Package
> 9. 💼  Tour Quotation Builder
> 10. ⚖️  Compare (prices / options)
> 11. 🌍  Destination Finder

Accept the selections by number, keyword, or natural language (e.g., "flights and visa", "3 and 1", "I need a hotel and a tour").
Once selections are confirmed, run the corresponding service flow(s) in §Step 2, one service at a time in a logical dependency order (Destination → Flights → Hotels → Visa → Insurance → Tours → Transfers).

EXCEPTION: If the conversation is clearly an internal consultant query (not a client enquiry) — e.g., "draft a follow-up email", "summarise this pipeline", "what's the markup on this quote" — skip the service picker and respond directly.

──────────────────────────────────────────
STEP 2 — SERVICE-SPECIFIC QUESTION FLOWS & ACTIONS
──────────────────────────────────────────

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2A · VISA APPLICATION / RENEWAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ask (one bundle):
  — Visa type (tourist / business / student / transit / family / medical / other)?
  — Destination country and intended travel date?
  — Passport nationality and current passport validity?
  — Previous international travel history (countries visited, frequency)?
  — Any previous visa rejection or overstay for any country?
  — Place of submission preference (if VFS/BLS has multiple centres)?

Then act:
  1. Visit the official embassy visa page for the destination country + VFS Global / BLS as applicable.
  2. Produce a complete, numbered document checklist (required + optional + conditional).
  3. Flag any red-flag factors from the history (rejection, thin travel history, etc.) and advise mitigation.
  4. Offer to draft a personalised cover letter (financial, employment, travel purpose, itinerary).
  5. Share the correct direct link to book the visa submission appointment for the chosen centre.
  6. State processing time, fee (official), and current wait times if available.
  Source: Embassy visa portal → VFS Global (vfsglobal.com) → BLS International (blsinternational.com)
  ⚠ Always state checked date; visa rules change without notice.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2B · FLIGHTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ask (one bundle):
  — Trip type: one-way / round-trip / multi-city?
  — Origin and destination (city or airport code)?
  — Date(s) of departure (and return if applicable)?
  — Number of passengers (adults / children / infants)?
  — Preferred cabin class (Economy / Premium Economy / Business / First)?
  — Airline preference (or "no preference")?
  — Routing preference: nonstop preferred / one stop OK / any?
  — Flexibility on dates (±1–3 days)?

Then act:
  1. Browse the flight sources listed in §Step 3 (Flight sources).
  2. Present a comparison table: airline · flight no · route · dep/arr times · duration · stops · fare class · price · baggage allowance · cancellation rules · source URL · checked timestamp.
  3. Highlight the best value, fastest, and most flexible options.
  4. Note any fare rules, advance purchase requirements, or blackout dates.
  5. For multi-city or complex routings, provide a full routing with layover times and transit visa requirements if applicable.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2C · HOTEL / ACCOMMODATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ask (one bundle):
  — Destination / city / specific area or landmark proximity?
  — Check-in and check-out dates?
  — Number of rooms and occupancy (adults + children)?
  — Budget band per night (per room, in preferred currency)?
  — Star rating preference (3★ / 4★ / 5★ / boutique / no preference)?
  — Board basis (room-only / B&B / half-board / full-board / all-inclusive)?
  — Room type preference (standard / deluxe / suite / villa / connecting)?
  — Must-haves (e.g., pool, beach access, spa, airport proximity, pet-friendly, accessible)?
  — Any specific hotel brands preferred or avoided?

Then act:
  1. Search the hotel sources listed in §Step 3.
  2. Present a comparison table: hotel name · location · star rating · room type · board basis · price per night · total for stay · key amenities · cancellation policy · source URL · checked timestamp.
  3. Highlight top 2–3 recommendations with "Why this fits" reasoning.
  4. Flag any significant location trade-offs (e.g., distance from city centre).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2D · TOUR QUOTATION BUILDER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
First, ask what the quote covers:
  (a) Individual service quote — for ONE of:
      • Flights  • Visa fees  • Tours  • Transfers  • Hotels
      • Planning & Consulting fee (standalone advisory / itinerary-design charge, no bookings)
  (b) Combined multi-service quotation

For each service included, offer two build paths:
  PATH A — Build manually: collect all service details and costs item by item.
  PATH B — Upload / paste a B2B partner quotation: extract line items automatically and structure them.

Build steps (for both paths):
  1. Itemise each service clearly (description · quantity · unit cost · currency · subtotal).
  2. Handle multi-currency: ask for ROE (Rate of Exchange) per foreign-currency item, or use live rates.
  3. Offer markup application:
     — Per line item (fixed amount or %) OR on the total, OR a mix.
     — Show operating cost, markup, subtotal, GST (if applicable), TCS (if applicable), grand total.
  4. Present the full structured quote for consultant review before finalising.
  5. Offer to format as a client-facing BDV branded proposal.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2E · COMPARE (prices / options)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ask what to compare:
  — Flights / Hotels / Tour prices / Transfer prices (train / bus / taxi / private)?
  — Ask for any quote already received from a partner or supplier.
  — Ask for the exact route, dates, pax details, and specification to ensure like-for-like comparison.

Then act:
  1. Search the relevant source list from §Step 3 for comparable live prices.
  2. Present a side-by-side comparison table: option · price · key specs · source · difference vs received quote.
  3. Highlight the best value and flag any spec differences that explain price gaps.
  4. State clearly which option offers the best value-for-spec and why.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2F · TOURS & TOUR GUIDE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ask (one bundle):
  — Destination and specific attractions or experiences of interest?
  — Tour dates and duration (half-day / full-day / multi-day)?
  — Group size and composition (solo / couple / family with children / group)?
  — Pace preference (leisurely / moderate / fast-paced)?
  — Budget range per person?
  — Language preference for the guide?
  — Any mobility or accessibility requirements?
  — Private tour or join a group?

Then act:
  1. Search the tour sources in §Step 3 plus the official attraction/monument websites for the destination (e.g., official Eiffel Tower site for Paris, official Colosseum site for Rome).
  2. Return a list of options with: tour name · operator · duration · group type · price per person · inclusions · live availability · cancellation policy · source URL.
  3. ALWAYS verify opening hours, admission rules, and ticket prices from the official attraction website — never from a blog or aggregator.
  4. Note any advance booking requirements, seasonal closures, or cultural dress codes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2G · PASSPORT APPLICATION / RENEWAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ask:
  — Is this a fresh application or renewal?
  — Applicant type: adult / minor (under 18)?
  — Current passport status (for renewal: expiry date, damaged/lost?)?
  — Any urgency (tatkal / normal processing)?
  — Preferred PSK location?

Then act:
  1. Use the official Passport Seva Kendra (PSK) site (passportindia.gov.in) as the sole source.
  2. Provide: eligibility criteria, complete document checklist (fresh vs renewal, tatkal vs normal), step-by-step appointment booking guide, current fee schedule, expected processing time.
  3. Share the direct link to book the PSK appointment.
  4. Flag common rejection reasons (name mismatch, incomplete docs) and advise mitigation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2H · TOUR MANAGER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ask:
  — Destination(s) and tour dates?
  — Group size and nationality mix?
  — Tour type (incentive / leisure / pilgrim / educational / corporate)?
  — Languages required?
  — Scope of tour manager role (full-time escort / airport-only / in-destination only)?
  — Special requirements (medical, dietary, mobility)?
Collect requirements and route into the Tour Package / Quotation workflow.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2I · TOUR PACKAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ask:
  — Destination(s) and duration?
  — Departure city and travel dates?
  — Number of travellers (adults / children / infants)?
  — Package type (FIT / GIT / MICE / honeymoon / family / adventure / pilgrimage)?
  — Budget ceiling (total / per person)?
  — Inclusions expected (flights / hotels / transfers / meals / tours / visa / insurance)?
  — Any special requests (anniversary setup, accessibility, dietary)?
Run Earth Compass intake (§6) in parallel. Route into full journey orchestration.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2J · TRAVEL INSURANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ask:
  — Destination(s) and travel dates?
  — Traveller details (ages, number of pax)?
  — Trip cost (for cancellation cover)?
  — Any pre-existing medical conditions?
  — Cover required: single trip / annual multi-trip?
  — Schengen or other mandatory insurance requirement?
  — Specific covers needed (adventure sports, cruise, pregnancy, high-value baggage)?
Provide options with: insurer · plan · cover highlights · exclusions · premium · source.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2K · DESTINATION FINDER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Run the Earth Compass intake (§6) but focus on eliciting:
  — Travel purpose (honeymoon / family / adventure / cultural / beach / wellness / pilgrimage / MICE)?
  — Departure country / passport nationality (for visa ease scoring)?
  — Travel period and duration?
  — Budget ceiling?
  — Climate preference (warm / cold / mild / flexible)?
  — Must-avoids (crowded / politically unstable / humid / expensive)?
  — Visited-before list (to avoid repeats unless requested)?
Then shortlist 3 destination options, each with: best season · visa effort (easy/moderate/complex) · estimated budget · flight time from home city · top 3 experiences · current travel advisory status.
Cross-reference: official tourism board sites + recent blogs/social posts for current conditions.

──────────────────────────────────────────
STEP 3 — LIVE BROWSE SOURCES (anchor all operational facts here)
──────────────────────────────────────────
Always check official sources FIRST, then aggregators for comparison.
Verify timings, distances, and opening hours before finalising any recommendation.
Cross-check official sources over aggregators for admission rules and ticket prices.
Flag safety considerations and respect local cultural sentiments.

HOTELS:
  Primary: Booking.com · Expedia · MakeMyTrip · Agoda · Cleartrip
  Always cross-check pricing against the hotel's official website.

FLIGHTS:
  Aggregators: Skyscanner · Trivago · MakeMyTrip · Expedia · Cleartrip
  Official airline sites (always check): IndiGo · Air India · Emirates · Lufthansa · Air France · Swiss (SWISS) · American Airlines · Etihad Airways · Singapore Airlines · SpiceJet · Akasa Air · Delta · Qatar Airways · United Airlines

TOURS & ATTRACTIONS:
  Tour platforms: Viator · GetYourGuide · Civitatis
  Official attraction/monument websites (hours, tickets, rules — ALWAYS from official, never a blog):
    e.g. ticket.pariszoom.com (Eiffel Tower) · coopculture.it (Colosseum) · british-museum.org, etc.

TRANSFERS:
  Rideshare: Uber · Bolt · Cabify · Grab
  Private/airport: Suntransfers · AirportTaxiTransfers.com · Blacklane

VISA:
  VFS Global (vfsglobal.com) · Country-specific embassy visa pages · BLS International (blsinternational.com)
  ⚠ Always state checked date; visa rules change frequently.

PASSPORT:
  Passport Seva Kendra (passportindia.gov.in) — sole source for Indian passport guidance.

DESTINATION GUIDES & INSPIRATION:
  Official tourism board sites (e.g., visitdubai.com, indiatravel.gov.in, etc.)
  Recent destination-wise blogs and social posts — for inspiration and trends ONLY, not for official rules or prices.

ALWAYS:
  ✓ Verify opening times, distances between POIs, and entry rules before finalising.
  ✓ Respect local cultural sentiments (dress codes, photography rules, religious customs).
  ✓ Flag safety considerations and current travel advisories (check the MoFA / FCO / US State Dept advisory for the destination).
  ✓ Cross-check official sources over aggregators for hours, admission rules, and ticket prices.

──────────────────────────────────────────
5 · INTERNAL CONSULTANT TOOLS (no service picker needed)
──────────────────────────────────────────
When Yash or a BDV staff member is working in internal mode:
  — Draft emails (client-facing or supplier): acknowledgments, follow-ups, payment requests, visa requests, pre-departure briefs, welcome-home messages.
  — Summarise inbound emails in ≤3 lines (who · what · action · deadline).
  — Analyse pipeline: stage distribution, overdue follow-ups, conversion rates.
  — Build or review quotes and itineraries.
  — Run calculations: markup, GST, TCS, ROE conversions, per-pax cost splits.
  — Research destinations, suppliers, DMCs.
  — Write marketing copy: posts, WhatsApp broadcasts, newsletters.

──────────────────────────────────────────
6 · EARTH COMPASS INTAKE (5-screen elicitation for new trip enquiries)
──────────────────────────────────────────
Run conversationally — one question bundle per message, never re-ask a captured signal:
  Screen 1 — The Trip: reason for travel + destination in mind OR "suggest me" (then trigger §2K Destination Finder)
  Screen 2 — Travellers & Dates: pax count, ages (if children), rough travel dates, companions (only if tastes differ materially)
  Screen 3 — Must-avoids: dealbreakers, climate to avoid, dietary, mobility, been-before
  Screen 4 — Style & Budget: travel rhythm (slow/balanced/fast), stay feel (basic/comfortable/luxury), transport modes, total budget ceiling + currency
  Screen 5 — Contact: preferred contact channel (WhatsApp / email / phone)
Qualification (parallel, silent): score Hot/Warm/Cold on budget realism, date firmness, decision-maker contact, responsiveness. Log to OS pipeline with next-action date.
Follow-up engine: T+1d gentle value-add nudge → T+3d new angle → T+7d soft close → T+14d park & drip.

──────────────────────────────────────────
7 · WRITING ITINERARIES (Earth Compass V2 format)
──────────────────────────────────────────
Two linked artifacts:
A. Plan cards (quote stage) — one card per leg/city:
   City · nights · dates · stay · price + Why this fits + Alternative considered + Verification trail + running total vs ceiling.
B. Day-wise timeline (post-booking) — each day:
   Header: Day N · Date · City · Weather
   Chronological blocks: Departure · Flight · Transfer · Hotel Check-in · Suggested Eateries · Suggested Excursions · Must Try/Buy/Remember
   Each block: exact time (24h local) · contact (+XX format) · Google Maps link · duration · status (booked / included / suggested / optional) · confirmation ref.

──────────────────────────────────────────
8 · EMAIL ENGINE
──────────────────────────────────────────
All outbound drafts go to Review queue — consultant approves before sending.
Outbound types:
  Client: enquiry acknowledgment (≤15 min SLA), quote delivery, follow-ups, payment requests, visa requests, pre-departure brief (48h re-verification), welcome-home + review ask.
  Supplier (DMC/hotel/operator): rate & availability request, booking confirmation (names as per passport, refs, dietary/accessibility), amendment/cancellation notices, 72h reconfirmation.
Inbound: Summarise in ≤3 lines. Extract to structured data and attach to the right booking/lead.

──────────────────────────────────────────
9 · FULL JOURNEY ORCHESTRATION
──────────────────────────────────────────
Lead in → Earth Compass Intake (§6) → Service Picker (§Step 1) → Run selected service flows (§Step 2) → Live Browse (§Step 3) → CONSULTANT REVIEW → Quote (§7A) → Follow-ups → Payment → Booking in dependency order:
  passport → visa decision → flight holds → hotel holds → visa submission → issue flights → rail/ferry → tours & date-locked tickets → ground transport → insurance
Nothing non-refundable before visa decision, without signed client consent.
→ Travel Pack + timeline (§7B) → 48h pre-departure re-verification → in-trip Support Desk → post-trip: review ask, testimonial, DB write-back, remarketing.

──────────────────────────────────────────
10 · OS INTEGRATION CONTRACT
──────────────────────────────────────────
Every artifact posts to a queue: drafts.quotes · drafts.emails · drafts.itineraries · alerts.urgent
Consultant approves/edits/rejects; log approver + timestamp.
Pipeline stages: new → qualified → quoted → negotiating → booked → travelling → returned → repeat.
Never store card numbers, passwords, or full passport scans in chat. Point to the OS secure document vault.
Escalate to human immediately: medical emergency · visa refusal · service failure in-trip · angry client · legal threat · payment dispute.

──────────────────────────────────────────
11 · VOICE & TONE
──────────────────────────────────────────
• Blue Diamond Voyage: warm, precise, quietly confident — an expert relative who knows every airport in the world.
• Glocalique: creative, trend-aware, slightly playful.
• Blue Diamond Vision: elevated, romantic, discreet.
Never pushy; scarcity only when true.
English default; mirror Hindi/Gujarati if the client writes in it.
Use clear markdown formatting: headers with ##, bullet lists with -, bold with **, tables where useful. Keep responses focused, scannable, and actionable.
═══════════════════════════════════════════════════════════════
""".strip()


class AiChatRequest(BaseModel):
    session_id: Optional[str] = None
    message: str


@api_router.post("/ai/sessions")
async def create_ai_session(current_user: dict = Depends(get_current_user)):
    session_id = str(uuid.uuid4())
    session = {
        "id": session_id,
        "staff_id": current_user.get("id"),
        "staff_name": current_user.get("name", ""),
        "title": "New Conversation",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.ai_chat_sessions.insert_one(session)
    return serialize_doc({k: v for k, v in session.items() if k != "_id"})


@api_router.get("/ai/sessions")
async def list_ai_sessions(current_user: dict = Depends(get_current_user)):
    sessions = await db.ai_chat_sessions.find(
        {"staff_id": current_user.get("id")}, {"_id": 0}
    ).sort("updated_at", -1).to_list(50)
    return [serialize_doc(s) for s in sessions]


@api_router.delete("/ai/sessions/{session_id}")
async def delete_ai_session(session_id: str, current_user: dict = Depends(get_current_user)):
    await db.ai_chat_sessions.delete_one({"id": session_id, "staff_id": current_user.get("id")})
    await db.ai_chat_messages.delete_many({"session_id": session_id})
    return {"status": "deleted"}


@api_router.get("/ai/sessions/{session_id}/messages")
async def get_ai_session_messages(session_id: str, current_user: dict = Depends(get_current_user)):
    messages = await db.ai_chat_messages.find(
        {"session_id": session_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(300)
    return [serialize_doc(m) for m in messages]


@api_router.post("/ai/chat")
async def compass_chat(body: AiChatRequest, current_user: dict = Depends(get_current_user)):
    staff_id = current_user.get("id")
    session_id = body.session_id

    # Create session if none
    if not session_id:
        session_id = str(uuid.uuid4())
        title = (body.message[:60] + "…") if len(body.message) > 60 else body.message
        new_session = {
            "id": session_id,
            "staff_id": staff_id,
            "staff_name": current_user.get("name", ""),
            "title": title,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.ai_chat_sessions.insert_one(new_session)

    # Load existing conversation history
    existing = await db.ai_chat_messages.find(
        {"session_id": session_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(300)

    # ── Destination DB context injection ────────────────────────────────────
    dest_context = await _destination_context_for_message(body.message)

    # Build initial_messages for LlmChat (system + full history)
    system_msg = COMPASS_SYSTEM_PROMPT
    if dest_context:
        system_msg = COMPASS_SYSTEM_PROMPT + "\n\n" + dest_context

    initial_messages = [{"role": "system", "content": system_msg}]
    for m in existing:
        initial_messages.append({"role": m["role"], "content": m["content"]})

    # Persist user message
    user_msg_id = str(uuid.uuid4())
    await db.ai_chat_messages.insert_one({
        "id": user_msg_id,
        "session_id": session_id,
        "role": "user",
        "content": body.message,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    # Update session title if first message
    if not existing:
        title = (body.message[:60] + "…") if len(body.message) > 60 else body.message
        await db.ai_chat_sessions.update_one(
            {"id": session_id},
            {"$set": {"title": title, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        await db.ai_chat_sessions.update_one(
            {"id": session_id},
            {"$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
        )

    api_key = os.environ.get("LLM_API_KEY", "")
    ai_msg_id = str(uuid.uuid4())

    async def event_stream():
        # First event carries the session_id (important for new sessions)
        yield f"data: {_json.dumps({'type': 'session_id', 'session_id': session_id})}\n\n"

        chat = LlmChat(
            api_key=api_key,
            session_id=session_id,
            system_message=system_msg,
            initial_messages=initial_messages,
        ).with_model("anthropic", "claude-sonnet-4-6")

        full_text_parts = []
        try:
            async for event in chat.stream_message(UserMessage(text=body.message)):
                if isinstance(event, TextDelta):
                    full_text_parts.append(event.content)
                    yield f"data: {_json.dumps({'type': 'delta', 'content': event.content})}\n\n"
                elif isinstance(event, StreamDone):
                    full_text = "".join(full_text_parts)
                    save_doc = {
                        "id": ai_msg_id,
                        "session_id": session_id,
                        "role": "assistant",
                        "content": full_text,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    }
                    await _asyncio.shield(db.ai_chat_messages.insert_one(save_doc))
                    yield f"data: {_json.dumps({'type': 'done', 'message_id': ai_msg_id})}\n\n"
                    break
        except Exception as exc:
            yield f"data: {_json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── BDV Destination Database API ─────────────────────────────────────────────

# ── BDV Destination Database API ─────────────────────────────────────────────


@api_router.post("/destinations/sync-from-sheets")
async def sync_destinations_from_sheets(current_user: dict = Depends(get_current_user)):
    """
    Fetch the BDV destination reference sheet (Google Sheets CSV) and upsert
    all rows into destination_db.  Existing rich records get tourism-link
    enrichment; new destinations get a minimal record so Compass AI can cite
    official sources.
    """
    import csv, io, httpx

    SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1iBRGcMGb2jMDGpV4OnddqNGstghgrud8UvK9MfDEU54/export?format=csv"

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
            resp = await client.get(SHEET_CSV_URL)
            resp.raise_for_status()
            raw_csv = resp.text
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not fetch Google Sheet: {e}")

    reader = csv.DictReader(io.StringIO(raw_csv))
    upserted = 0
    created  = 0

    for row in reader:
        dest_name  = (row.get("Destination") or "").strip()
        country    = (row.get("Country")     or "").strip()
        continent  = (row.get("Continent")   or "").strip()
        if not dest_name:
            continue

        tourism_links = {
            "official_guide":    (row.get("Official Tourism Guide")                 or "").strip(),
            "official_url":      (row.get("Official URL")                            or "").strip(),
            "wikivoyage_url":    (row.get("Wikivoyage Guide")                        or "").strip(),
            "specific_guides":   (row.get("Destination-Specific Guides & Local Media") or "").strip(),
            "country_blogs":     (row.get("Country Local Blogs & Publications")      or "").strip(),
        }
        # Remove empty values
        tourism_links = {k: v for k, v in tourism_links.items() if v}

        # Try to find an existing record by destination name (case-insensitive)
        existing = await db.destination_db.find_one(
            {"name": {"$regex": f"^{re.escape(dest_name)}$", "$options": "i"}}
        )

        if existing:
            # Enrich existing record with official links
            await db.destination_db.update_one(
                {"_id": existing["_id"]},
                {"$set": {
                    "tourism_links": tourism_links,
                    "continent": continent or existing.get("continent", ""),
                }}
            )
            upserted += 1
        else:
            # Create a minimal record so Compass AI can cite it
            slug = re.sub(r"[^a-z0-9]+", "-", dest_name.lower()).strip("-")
            await db.destination_db.insert_one({
                "id":           str(uuid.uuid4()),
                "name":         dest_name,
                "country":      country,
                "continent":    continent,
                "slug":         slug,
                "tourism_links": tourism_links,
                "source":       "bdv_sheets_sync",
                "created_at":   datetime.now(timezone.utc).isoformat(),
            })
            created += 1

    return {
        "status": "ok",
        "upserted": upserted,
        "created": created,
        "total": upserted + created,
        "message": f"Sync complete: {upserted} records enriched, {created} new destinations added.",
    }


@api_router.get("/destinations")
async def list_destinations(
    continent: Optional[str] = None,
    search: Optional[str] = None,
    occasion: Optional[str] = None,
    interest: Optional[str] = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
):
    """Search and filter the BDV 480-destination database."""
    query: dict = {}
    if continent:
        query["continent"] = {"$regex": continent, "$options": "i"}
    if occasion:
        query["occasion"] = {"$elemMatch": {"$regex": occasion, "$options": "i"}}
    if interest:
        query["interests"] = {"$elemMatch": {"$regex": interest, "$options": "i"}}
    if search:
        query["$or"] = [
            {"name":    {"$regex": search, "$options": "i"}},
            {"country": {"$regex": search, "$options": "i"}},
            {"attractions": {"$elemMatch": {"$regex": search, "$options": "i"}}},
            {"activities":  {"$elemMatch": {"$regex": search, "$options": "i"}}},
        ]
    results = await db.destination_db.find(query, {"_id": 0}).limit(limit).to_list(limit)
    return results


@api_router.get("/destinations/{slug}")
async def get_destination(slug: str, current_user: dict = Depends(get_current_user)):
    doc = await db.destination_db.find_one(
        {"$or": [{"slug": slug}, {"name": {"$regex": f"^{slug}$", "$options": "i"}}]},
        {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Destination not found")
    return doc


async def _destination_context_for_message(message: str) -> str:
    """
    Given a user message, extract destination/country mentions and return
    a structured BDV destination data block to inject as context for Compass AI.
    Returns empty string if nothing relevant found.
    """
    # Quick keyword scan - look for any word that could be a destination name
    # We query DB for top matching destinations
    words = re.findall(r"[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*", message)
    phrases_to_try = []

    # Add multi-word phrases + individual words (longer first)
    for i in range(len(words)):
        for j in range(len(words), i, -1):
            phrase = " ".join(words[i:j])
            if len(phrase) > 2:
                phrases_to_try.append(phrase)

    # Also extract plain lowercase words
    plain_words = re.findall(r'\b[a-zA-Z]{4,}\b', message)
    phrases_to_try.extend([w.title() for w in plain_words])

    # Remove duplicates, keep order
    seen = set()
    unique_phrases = []
    for p in phrases_to_try:
        if p not in seen:
            seen.add(p)
            unique_phrases.append(p)

    if not unique_phrases:
        return ""

    # Build a search query
    dest_conditions = [
        {"name":    {"$regex": p, "$options": "i"}} for p in unique_phrases[:15]
    ] + [
        {"country": {"$regex": p, "$options": "i"}} for p in unique_phrases[:15]
    ]

    matches = await db.destination_db.find(
        {"$or": dest_conditions}, {"_id": 0}
    ).limit(6).to_list(6)

    if not matches:
        return ""

    # Build a concise context block
    lines = ["═" * 60,
             "BDV AGENCY DESTINATION DATABASE — MATCHED RECORDS",
             "Use the following verified data to enrich your response.",
             "═" * 60]

    for d in matches:
        airports_str = ", ".join(
            f"{a['code']} – {a['name']}" if isinstance(a, dict) else str(a)
            for a in d.get("airports", [])
        )
        attractions_str = ", ".join(d.get("attractions", [])[:8])
        activities_str  = ", ".join(d.get("activities", [])[:8])
        climate_str     = ", ".join(d.get("climate", []))
        terrain_str     = ", ".join(d.get("terrain", []))
        interest_str    = ", ".join(d.get("interests", []))
        occasion_str    = ", ".join(d.get("occasion", []))
        lines += [
            "",
            f"▶ {d['name']}, {d['country']} ({d.get('iso2','')}) | {d.get('continent','')} | ✆ +{d.get('dial','')}",
            f"  Airports     : {airports_str or 'N/A'}",
            f"  Best months  : {d.get('best_months','N/A')}",
            f"  Shoulder     : {d.get('shoulder_months','N/A')}",
            f"  Avoid        : {d.get('avoid_months','N/A')}",
            f"  Season note  : {d.get('season_note','N/A')}",
            f"  Climate      : {climate_str or 'N/A'}",
            f"  Terrain      : {terrain_str or 'N/A'}",
            f"  Interests    : {interest_str or 'N/A'}",
            f"  Occasions    : {occasion_str or 'N/A'}",
            f"  Attractions  : {attractions_str or 'N/A'}",
            f"  Activities   : {activities_str or 'N/A'}",
            f"  Official site: {d.get('destination_site','') or d.get('country_tourism_site','') or 'N/A'}",
        ]
        # Add tourism reference links if available from Sheets sync
        tl = d.get("tourism_links", {})
        if tl.get("official_url"):
            lines.append(f"  Tourism URL  : {tl['official_url']}")
        if tl.get("wikivoyage_url"):
            lines.append(f"  Wikivoyage   : {tl['wikivoyage_url']}")
        if tl.get("specific_guides"):
            lines.append(f"  Local guides : {tl['specific_guides'][:120]}")

    lines += ["", "═" * 60]
    return "\n".join(lines)


# ── Itinerary Smart URL Extractor ────────────────────────────────────────────

_BLOCK_SCHEMAS = {
    "DEPARTURE": "from_city, terminal, report_time, carrier, address, notes",
    "FLIGHT":    "airline, flight_no, from_airport, to_airport, dep_time, arr_time, dep_date, arr_date, pnr, flight_class (Economy/Business/First), baggage, meal_pref, terminal_dep, terminal_arr, duration, stopover",
    "TRANSFER":  "vehicle, from_location, to_location, from_address, to_address, dep_time, duration, driver_name, driver_phone, conf_no, notes",
    "FERRY":     "operator, from_terminal, to_terminal, dep_time, arr_time, duration, ticket_ref, phone, notes",
    "WALK":      "route_type (Walking/Driving/Cycling/Transit), from_location, to_location, from_address, to_address, distance, duration, route_notes",
    "HOTEL":     "hotel_name, star_rating (number 1-5 as string), city, address, phone, conf_no, check_in_date, check_in_time, check_out_date, check_out_time, nights, room_type, meal_plan (RO/BB/HB/FB/AI), inclusions, special_requests, city_tax, deposit, notes",
    "EATERIES":  "meal_type (Breakfast/Lunch/Dinner/Snack), restaurant_name, cuisine, address, phone, opening_hours, price_range, dietary_note, reservation_advice, notes",
    "EXCURSION": "name, category, location, address, phone, opening_hours, duration, ticket_included (Ticket Included/Extra Cost/Free Entry/Covered by City Card), ticket_ref, description, notes",
    "MUST_TRY":  "category (Must Try/Must Buy/Must Remember), title, description, location, address, price_range, notes",
    "INFO":      "severity (info/warning/tip), title, content, notes",
}


@api_router.post("/itinerary/extract-from-url")
async def extract_itinerary_data_from_url(
    request: FastAPIRequest,
    current_user: dict = Depends(get_current_user)
):
    body        = await request.json()
    url         = (body.get("url") or "").strip()
    block_type  = (body.get("block_type") or "").strip().upper()

    if not url:
        raise HTTPException(status_code=400, detail="URL is required")

    schema = _BLOCK_SCHEMAS.get(block_type, "name, address, phone, notes")

    # ── Step 1: Fetch page content ──────────────────────────────────────────
    page_text  = ""
    page_title = ""
    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=15.0,
            headers={
                "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            }
        ) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                html = resp.text
                # Extract <title>
                m = re.search(r'<title[^>]*>(.*?)</title>', html, re.DOTALL | re.IGNORECASE)
                if m:
                    page_title = re.sub(r'\s+', ' ', m.group(1)).strip()
                # Remove script / style / noscript / svg blocks
                html = re.sub(
                    r'<(script|style|noscript|svg)[^>]*>.*?</(script|style|noscript|svg)>',
                    '', html, flags=re.DOTALL | re.IGNORECASE
                )
                # Strip all remaining HTML tags
                text = re.sub(r'<[^>]+>', ' ', html)
                page_text = re.sub(r'\s+', ' ', text).strip()[:5000]
    except Exception:
        pass   # Proceed with URL-only context

    # ── Step 2: AI extraction ────────────────────────────────────────────────
    api_key = os.environ.get("LLM_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="AI service not configured")

    context_parts = [f"URL: {url}"]
    if page_title:
        context_parts.append(f"Page Title: {page_title}")
    if page_text:
        context_parts.append(f"Page Content (truncated to 5000 chars):\n{page_text}")
    context = "\n\n".join(context_parts)

    prompt = (
        f"You are a travel data extraction assistant. Extract structured information "
        f"for a {block_type} block in a travel itinerary.\n\n"
        f"{context}\n\n"
        f"Extract ONLY data clearly present in the content above. "
        f"Return a JSON object with these fields:\n{schema}\n\n"
        f"Rules:\n"
        f"- Include only fields you can confidently identify\n"
        f"- Omit fields that are absent or ambiguous\n"
        f"- Phone: international format (+XX ...)\n"
        f"- star_rating: return as string '3', '4', '5' etc.\n"
        f"- Values should be concise and accurate\n"
        f"- Return ONLY the JSON object, no explanation, no markdown fences\n\n"
        f"JSON:"
    )

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"extract_{str(uuid.uuid4())[:8]}",
            system_message=(
                "You are a precise travel data extractor. "
                "Always return a single valid JSON object with extracted travel fields. "
                "Never include markdown, explanation, or anything outside the JSON."
            ),
        ).with_model("anthropic", "claude-sonnet-4-6")

        result = await chat.send_message(UserMessage(text=prompt))

        json_match = re.search(r'\{.*\}', result, re.DOTALL)
        if json_match:
            extracted = _json.loads(json_match.group())
            # Drop null / empty string values
            extracted = {k: v for k, v in extracted.items() if v is not None and v != ""}
            return {
                "success":      True,
                "data":         extracted,
                "fields_found": len(extracted),
            }
        else:
            return {"success": False, "error": "No structured data could be extracted from this link."}
    except Exception as exc:
        return {"success": False, "error": f"Extraction failed: {str(exc)}"}


# ── Compass AI → Itinerary Auto-Build ──────────────────────────────────────────
# Accepts raw text (pasted content) OR a base64 image (screenshot / scan).
# Returns a fully-structured itinerary JSON ready to load into the Designer.

_ITIN_AI_SYSTEM = """
You are a travel itinerary extraction engine for Blue Diamond Voyage.
Read the input and output ONLY valid JSON (no markdown, no preamble) matching this exact structure:

{"title":"","client_name":"","destination":"","start_date":"DD Month YYYY","end_date":"DD Month YYYY","pax_adults":2,"pax_children":0,"meal_preference":null,
"days":[{"day_number":1,"date":"DD Month YYYY","day_label":"Day 1 - City",
"blocks":[{"block_type":"FLIGHT|HOTEL|TRANSFER|FERRY|EXCURSION|EATERIES|INFO|DEPARTURE","time":"HH:MM",
"data":{
  "FLIGHT":{"airline":"","flight_no":"","from_airport":"","to_airport":"","dep_time":"","arr_time":"","dep_date":"","pnr":"","baggage":"","notes":""},
  "HOTEL":{"hotel_name":"","city":"","check_in_date":"","check_out_date":"","nights":"","room_type":"","meal_plan":"","conf_no":"","phone":"","notes":""},
  "TRANSFER":{"vehicle":"","from_location":"","to_location":"","dep_time":"","conf_no":"","driver_name":"","driver_phone":"","notes":""},
  "EXCURSION":{"name":"","category":"","location":"","duration":"","ticket_included":"","ticket_ref":"","description":"","phone":"","notes":""},
  "EATERIES":{"meal_type":"","restaurant_name":"","cuisine":"","address":"","phone":"","notes":""},
  "INFO":{"severity":"info","title":"","content":"","notes":""},
  "DEPARTURE":{"from_city":"","report_time":"","terminal":"","carrier":"","notes":""}
}}]}]}

Rules: Output only the JSON. Put flights on departure day. Hotels on check-in day. Unknown fields = empty string.
""".strip()


class ItinAIRequest(BaseModel):
    text_input:      Optional[str] = None
    image_b64:       Optional[str] = None  # base64-encoded image (any common format)
    image_mime_type: Optional[str] = "image/jpeg"
    linked_quote_id: Optional[str] = None
    existing_meta:   Optional[Dict[str, Any]] = {}   # existing itinerary metadata to help AI


@api_router.post("/itinerary/ai-generate")
async def ai_generate_itinerary(
    body: ItinAIRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Use Gemini (vision if image provided) to extract a full structured itinerary
    from raw text and/or an image.  Also pulls in linked quote data if provided.
    """
    api_key = os.environ.get("LLM_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=503, detail="LLM service not configured")

    # ── 1. Gather context ──────────────────────────────────────────────────────
    context_parts: List[str] = []

    if body.existing_meta:
        meta_lines = [f"{k}: {v}" for k, v in body.existing_meta.items() if v]
        if meta_lines:
            context_parts.append("EXISTING ITINERARY METADATA:\n" + "\n".join(meta_lines))

    # Pull linked quote components if provided
    if body.linked_quote_id:
        try:
            trip = await db.trips.find_one({"id": body.linked_quote_id}, {"_id": 0})
            if trip:
                context_parts.append(
                    f"LINKED QUOTE — {trip.get('client_name', '')} — Status: {trip.get('status', '')}\n"
                    f"Destination: {trip.get('destination_summary', '')}\n"
                    f"Dates: {trip.get('start_date', '')} → {trip.get('end_date', '')}\n"
                    f"Adults: {trip.get('adults', 2)}, Children: {len(trip.get('children', []))}"
                )
                # Include components
                comps = await db.trip_components.find(
                    {"trip_id": body.linked_quote_id}, {"_id": 0}
                ).sort("sort_order", 1).to_list(200)
                if comps:
                    comp_lines = [
                        f"  - [{c.get('type','').upper()}] {c.get('title','')} "
                        f"Supplier: {c.get('supplier_name','')} Ref: {c.get('reference_no','')} "
                        f"Sell: {c.get('sell_currency','INR')} {c.get('sell_price','')}"
                        for c in comps
                    ]
                    context_parts.append("TRIP COMPONENTS:\n" + "\n".join(comp_lines))
        except Exception:
            pass

    if body.text_input:
        context_parts.append("USER INPUT:\n" + body.text_input.strip())

    full_prompt = "\n\n".join(context_parts) if context_parts else "Generate a sample 5-day itinerary."

    # ── 2. Build the LLM message ───────────────────────────────────────────────
    file_contents = None
    if body.image_b64:
        from emergentintegrations.llm.chat import FileContent
        file_contents = [FileContent(
            content_type=body.image_mime_type or "image/jpeg",
            file_content_base64=body.image_b64,
        )]

    # Use Claude (vision-capable, proven provider for this environment)
    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"itin_ai_{uuid.uuid4()}",
            system_message=_ITIN_AI_SYSTEM,
        ).with_model("anthropic", "claude-sonnet-4-5")

        from emergentintegrations.llm.chat import UserMessage as UMsg
        import asyncio as _aio
        msg = UMsg(text=full_prompt, file_contents=file_contents)
        try:
            raw = await _aio.wait_for(chat.send_message(msg), timeout=55)
        except _aio.TimeoutError:
            raise HTTPException(status_code=504, detail="AI generation timed out. Try with shorter input or fewer days.")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI service error: {exc}")

    # ── 3. Parse JSON from response ────────────────────────────────────────────
    import re as _re
    raw = raw.strip()
    # Strip markdown code fences if present
    raw = _re.sub(r"^```(?:json)?\s*", "", raw)
    raw = _re.sub(r"\s*```$", "", raw)
    data: dict = {}  # default — always initialised before use
    try:
        data = _json.loads(raw)
    except Exception:
        raise HTTPException(status_code=422, detail="AI returned non-JSON output: " + raw[:300])

    # Ensure every block has an id
    for day in data.get("days", []):
        for block in day.get("blocks", []):
            if not block.get("id"):
                block["id"] = str(uuid.uuid4())

    return {"success": True, "itinerary": data}


# ── Itinerary Designer ─────────────────────────────────────────────────────────


class ItineraryBlockCreate(BaseModel):
    id: Optional[str] = None
    block_type: str  # DEPARTURE | FLIGHT | TRANSFER | FERRY | WALK | HOTEL | EATERIES | EXCURSION | MUST_TRY | INFO
    status: str = "suggested"  # booked | included | suggested | optional
    time: Optional[str] = None  # HH:MM display time for timeline
    data: Dict[str, Any] = {}
    order: int = 0


class ItineraryDayCreate(BaseModel):
    day_number: int
    date: Optional[str] = None       # e.g. "17 June 2026"
    day_label: Optional[str] = None  # e.g. "Touchdown in Bavaria!"
    blocks: List[ItineraryBlockCreate] = []


class ItineraryCreate(BaseModel):
    title: str
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    enquiry_id: Optional[str] = None
    destination: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    pax_adults: int = 2
    pax_children: int = 0
    meal_preference: Optional[str] = None
    status: str = "draft"   # draft | final | shared
    days: List[ItineraryDayCreate] = []


@api_router.get("/itineraries")
async def list_itineraries(
    client_id: Optional[str] = None,
    enquiry_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if client_id:
        query["client_id"] = client_id
    if enquiry_id:
        query["enquiry_id"] = enquiry_id
    items = await db.itineraries.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [serialize_doc(i) for i in items]


@api_router.post("/itineraries")
async def create_itinerary(itin: ItineraryCreate, current_user: dict = Depends(get_current_user)):
    doc = itin.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_by_staff_id"] = current_user["id"]
    doc["created_by_name"] = current_user["name"]
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    for day in doc.get("days", []):
        for block in day.get("blocks", []):
            if not block.get("id"):
                block["id"] = str(uuid.uuid4())
    await db.itineraries.insert_one(doc)
    doc.pop("_id", None)
    return serialize_doc(doc)


@api_router.get("/itineraries/{itinerary_id}")
async def get_itinerary(itinerary_id: str, current_user: dict = Depends(get_current_user)):
    itin = await db.itineraries.find_one({"id": itinerary_id}, {"_id": 0})
    if not itin:
        raise HTTPException(status_code=404, detail="Itinerary not found")
    return serialize_doc(itin)


@api_router.put("/itineraries/{itinerary_id}")
async def update_itinerary(
    itinerary_id: str,
    itin: ItineraryCreate,
    current_user: dict = Depends(get_current_user)
):
    existing = await db.itineraries.find_one({"id": itinerary_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Itinerary not found")
    update_data = itin.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    for day in update_data.get("days", []):
        for block in day.get("blocks", []):
            if not block.get("id"):
                block["id"] = str(uuid.uuid4())
    await db.itineraries.update_one({"id": itinerary_id}, {"$set": update_data})
    updated = await db.itineraries.find_one({"id": itinerary_id}, {"_id": 0})
    return serialize_doc(updated)


@api_router.delete("/itineraries/{itinerary_id}")
async def delete_itinerary(itinerary_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.itineraries.delete_one({"id": itinerary_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Itinerary not found")
    return {"message": "Deleted"}



# ═══════════════════════════════════════════════════════════════════════════════
# TRIP PLANNER — Models, CRUD, Validation & Seed Data
# ═══════════════════════════════════════════════════════════════════════════════

class ChildInfo(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    dob: Optional[str] = None

class TripCreate(BaseModel):
    client_name: str
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    brand: str = "BDV"  # BDV | Glocalique | Luxury Honeymoon UK
    origin_name: str
    origin_country: Optional[str] = ""
    origin_lat: Optional[float] = None
    origin_lng: Optional[float] = None
    start_date: str  # YYYY-MM-DD
    end_date: str    # YYYY-MM-DD
    adults: int = 2
    children: List[ChildInfo] = []
    rooms: int = 1
    currency: str = "INR"  # INR | GBP | EUR | USD
    margin_pct: Optional[float] = 15.0
    budget_indication: Optional[str] = None
    notes: Optional[str] = None
    status: str = "draft"  # draft|quoted|sent|approved|booked|itinerary_generated|cancelled
    # ── New Trip-Planner fields ─────────────────────────────────────────────────
    quote_no: Optional[str] = None        # auto-generated on first save if absent
    quote_version: int = 1                # increments when a Sent quote is re-edited
    trip_title: Optional[str] = None      # e.g. "Santorini Honeymoon"
    destination_summary: Optional[str] = None  # e.g. "Athens, Santorini, Mykonos"
    linked_itinerary_id: Optional[str] = None  # set after Generate Itinerary

class TripUpdate(BaseModel):
    client_name: Optional[str] = None
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    brand: Optional[str] = None
    origin_name: Optional[str] = None
    origin_country: Optional[str] = None
    origin_lat: Optional[float] = None
    origin_lng: Optional[float] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    adults: Optional[int] = None
    children: Optional[List[ChildInfo]] = None
    rooms: Optional[int] = None
    currency: Optional[str] = None
    margin_pct: Optional[float] = None
    budget_indication: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    # ── New Trip-Planner fields ─────────────────────────────────────────────────
    quote_no: Optional[str] = None
    quote_version: Optional[int] = None
    trip_title: Optional[str] = None
    destination_summary: Optional[str] = None
    linked_itinerary_id: Optional[str] = None
    divergence_flagged: Optional[bool] = None  # True after itinerary price divergence

class StopCreate(BaseModel):
    trip_id: str
    sequence: int = 0
    place_name: str
    country: Optional[str] = ""
    lat: float
    lng: float
    nights: int = 1
    accommodation_needed: bool = True
    transport_needed: bool = True
    notes: Optional[str] = None

class StopUpdate(BaseModel):
    sequence: Optional[int] = None
    place_name: Optional[str] = None
    country: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    nights: Optional[int] = None
    accommodation_needed: Optional[bool] = None
    transport_needed: Optional[bool] = None
    notes: Optional[str] = None

class LegCreate(BaseModel):
    trip_id: str
    from_stop_id: str  # "origin" or stop id
    to_stop_id: str
    mode: Optional[str] = "flight"  # flight|train|bus|car|ferry|transfer
    operator: Optional[str] = None
    depart_datetime: Optional[str] = None
    arrive_datetime: Optional[str] = None
    from_point: Optional[str] = None
    to_point: Optional[str] = None
    cost: Optional[float] = None
    cancellation_policy: Optional[str] = ""
    notes: Optional[str] = None

class LegUpdate(BaseModel):
    mode: Optional[str] = None
    operator: Optional[str] = None
    depart_datetime: Optional[str] = None
    arrive_datetime: Optional[str] = None
    from_point: Optional[str] = None
    to_point: Optional[str] = None
    cost: Optional[float] = None
    cancellation_policy: Optional[str] = None
    notes: Optional[str] = None

class StayCreate(BaseModel):
    stop_id: str
    trip_id: str
    hotel_name: Optional[str] = ""
    stars: Optional[int] = None
    room_type: Optional[str] = None
    board: Optional[str] = None  # RO|BB|HB|FB|AI
    distance_from_centre: Optional[str] = None
    cost: Optional[float] = None
    cancellation_policy: Optional[str] = ""
    notes: Optional[str] = None

class StayUpdate(BaseModel):
    hotel_name: Optional[str] = None
    stars: Optional[int] = None
    room_type: Optional[str] = None
    board: Optional[str] = None
    distance_from_centre: Optional[str] = None
    cost: Optional[float] = None
    cancellation_policy: Optional[str] = None
    notes: Optional[str] = None

class PinCreate(BaseModel):
    pin_type: str = "hotel"  # hotel|attraction|transport|border|contact|other
    name: str
    lat: float
    lng: float
    country: Optional[str] = ""
    rating: Optional[float] = None
    notes: Optional[str] = None

class PinUpdate(BaseModel):
    pin_type: Optional[str] = None
    name: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    country: Optional[str] = None
    rating: Optional[float] = None
    notes: Optional[str] = None

# ── POI / Places models ────────────────────────────────────────────────────────
class RestaurantCreate(BaseModel):
    # stop_id and trip_id are provided via URL path — Optional here for backward-compat
    stop_id: Optional[str] = None
    trip_id: Optional[str] = None
    name: str
    cuisine: Optional[str] = None
    address: Optional[str] = None
    booking_url: Optional[str] = None
    cost: Optional[float] = None
    notes: Optional[str] = None

class AttractionCreate(BaseModel):
    # stop_id and trip_id are provided via URL path — Optional here for backward-compat
    stop_id: Optional[str] = None
    trip_id: Optional[str] = None
    name: str
    category: Optional[str] = None  # museum|park|landmark|beach|viewpoint|entertainment|other
    address: Optional[str] = None
    booking_url: Optional[str] = None
    cost: Optional[float] = None
    duration: Optional[str] = None   # e.g. "2h", "half-day"
    schedule: Optional[str] = None   # opening hours / dates
    notes: Optional[str] = None

class InfoPointCreate(BaseModel):
    # stop_id and trip_id are provided via URL path — Optional here for backward-compat
    stop_id: Optional[str] = None
    trip_id: Optional[str] = None
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    hours: Optional[str] = None
    website: Optional[str] = None
    notes: Optional[str] = None

class MeetingPointCreate(BaseModel):
    # stop_id and trip_id are provided via URL path — Optional here for backward-compat
    stop_id: Optional[str] = None
    trip_id: Optional[str] = None
    name: str
    address: Optional[str] = None
    time: Optional[str] = None
    meeting_url: Optional[str] = None   # Google Maps or any URL
    notes: Optional[str] = None

class POIUpdate(BaseModel):
    name: Optional[str] = None
    cuisine: Optional[str] = None
    category: Optional[str] = None
    address: Optional[str] = None
    booking_url: Optional[str] = None
    meeting_url: Optional[str] = None
    cost: Optional[float] = None
    duration: Optional[str] = None
    schedule: Optional[str] = None
    hours: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    notes: Optional[str] = None

def _compute_stop_dates(start_date: str, stops: list) -> list:
    from datetime import date as datecls, timedelta
    try:
        current = datecls.fromisoformat(start_date)
    except Exception:
        return stops
    for stop in sorted(stops, key=lambda s: s.get("sequence", 0)):
        stop["arrive_date"]  = current.isoformat()
        stop["depart_date"]  = (current + timedelta(days=max(1, stop.get("nights", 1)))).isoformat()
        current += timedelta(days=max(1, stop.get("nights", 1)))
    return stops

def _trip_total_nights(start: str, end: str) -> int:
    from datetime import date as datecls
    try:
        return (datecls.fromisoformat(end) - datecls.fromisoformat(start)).days
    except Exception:
        return 0

# ── Trips ──────────────────────────────────────────────────────────────────────

@api_router.get("/trips")
async def list_trips(
    brand: Optional[str] = None,
    status: Optional[str] = None,
    month: Optional[str] = None,
    q: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    filt: Dict[str, Any] = {}
    if brand:   filt["brand"]  = brand
    if status:  filt["status"] = status
    if month:
        filt["start_date"] = {"$regex": f"^{month}"}
    if q:
        filt["$or"] = [
            {"client_name":  {"$regex": q, "$options": "i"}},
            {"origin_name":  {"$regex": q, "$options": "i"}},
        ]
    cursor = db.trips.find(filt).sort("created_at", -1)
    trips = []
    async for t in cursor:
        t.pop("_id", None)
        trips.append(t)
    return trips

@api_router.post("/trips")
async def create_trip(body: TripCreate, current_user: dict = Depends(get_current_user)):
    trip_id = str(uuid.uuid4())
    total_nights = _trip_total_nights(body.start_date, body.end_date)
    doc = {
        "id": trip_id,
        **body.model_dump(),
        "total_nights": total_nights,
        "children": [c.model_dump() for c in body.children],
        "created_by": current_user.get("name", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.trips.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.get("/trips/{trip_id}/full")
async def get_trip_full(trip_id: str, current_user: dict = Depends(get_current_user)):
    trip = await db.trips.find_one({"id": trip_id})
    if not trip: raise HTTPException(404, "Trip not found")
    trip.pop("_id", None)

    stops_cursor = db.trip_stops.find({"trip_id": trip_id}).sort("sequence", 1)
    stops = []
    async for s in stops_cursor:
        s.pop("_id", None)
        # Attach stays
        stays = []
        async for st in db.trip_stays.find({"stop_id": s["id"]}):
            st.pop("_id", None)
            stays.append(st)
        s["stays"] = stays
        # Attach restaurants
        restaurants = []
        async for r in db.trip_restaurants.find({"stop_id": s["id"]}).sort("created_at", 1):
            r.pop("_id", None)
            restaurants.append(r)
        s["restaurants"] = restaurants
        # Attach attractions
        attractions = []
        async for a in db.trip_attractions.find({"stop_id": s["id"]}).sort("created_at", 1):
            a.pop("_id", None)
            attractions.append(a)
        s["attractions"] = attractions
        # Attach tourist info points
        info_points = []
        async for ip in db.trip_info_points.find({"stop_id": s["id"]}).sort("created_at", 1):
            ip.pop("_id", None)
            info_points.append(ip)
        s["info_points"] = info_points
        # Attach meeting points
        meeting_points = []
        async for mp in db.trip_meeting_points.find({"stop_id": s["id"]}).sort("created_at", 1):
            mp.pop("_id", None)
            meeting_points.append(mp)
        s["meeting_points"] = meeting_points
        stops.append(s)

    # Compute arrive/depart dates
    stops = _compute_stop_dates(trip["start_date"], stops)

    legs = []
    async for lg in db.trip_legs.find({"trip_id": trip_id}).sort("created_at", 1):
        lg.pop("_id", None)
        legs.append(lg)

    # Attach trip-level sources
    sources = []
    async for src in db.sources.find({"trip_id": trip_id}).sort("captured_at", -1):
        src.pop("_id", None)
        sources.append(src)

    trip["stops"]   = stops
    trip["legs"]    = legs
    trip["sources"] = sources
    return trip

@api_router.put("/trips/{trip_id}")
async def update_trip(trip_id: str, body: TripUpdate, current_user: dict = Depends(get_current_user)):
    update: Dict[str, Any] = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if "start_date" in update or "end_date" in update:
        trip = await db.trips.find_one({"id": trip_id})
        if trip:
            start = update.get("start_date", trip.get("start_date", ""))
            end   = update.get("end_date",   trip.get("end_date",   ""))
            update["total_nights"] = _trip_total_nights(start, end)
    if "children" in update:
        update["children"] = [c if isinstance(c, dict) else c.model_dump() for c in update["children"]]
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.trips.find_one_and_update(
        {"id": trip_id}, {"$set": update}, return_document=True
    )
    if not result: raise HTTPException(404, "Trip not found")
    result.pop("_id", None)
    return result

@api_router.delete("/trips/{trip_id}")
async def delete_trip(trip_id: str, current_user: dict = Depends(get_current_user)):
    await db.trips.delete_one({"id": trip_id})
    await db.trip_stops.delete_many({"trip_id": trip_id})
    await db.trip_legs.delete_many({"trip_id": trip_id})
    await db.trip_stays.delete_many({"trip_id": trip_id})
    await db.trip_restaurants.delete_many({"trip_id": trip_id})
    await db.trip_attractions.delete_many({"trip_id": trip_id})
    await db.trip_info_points.delete_many({"trip_id": trip_id})
    await db.trip_meeting_points.delete_many({"trip_id": trip_id})
    return {"message": "Trip deleted"}


@api_router.post("/trips/{trip_id}/clone")
async def clone_trip(trip_id: str, current_user: dict = Depends(get_current_user)):
    """
    Deep-clone an entire trip:
      trip → stops → legs → stays → restaurants → attractions → info_points → meeting_points
    All entities receive fresh UUIDs. Internal references (stop IDs in legs/stays/places)
    are remapped to the new stop IDs. The cloned trip is set to Draft status.
    """
    # ── 1. Load source trip ──────────────────────────────────────────────────────
    src_trip = await db.trips.find_one({"id": trip_id})
    if not src_trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    src_trip.pop("_id", None)

    now = datetime.now(timezone.utc).isoformat()
    new_trip_id = str(uuid.uuid4())

    # ── 2. Clone trip doc ────────────────────────────────────────────────────────
    new_trip = {k: v for k, v in src_trip.items() if k not in ("_id",)}
    new_trip["id"] = new_trip_id
    new_trip["client_name"] = f"{src_trip.get('client_name', 'Trip')} (Copy)"
    new_trip["status"] = "Draft"
    new_trip["created_by"] = current_user.get("name", "")
    new_trip["created_at"] = now
    new_trip["updated_at"] = now

    await db.trips.insert_one(new_trip)

    # ── 3. Clone stops, build old_stop_id → new_stop_id mapping ─────────────────
    stop_id_map: dict = {}  # {old_stop_id: new_stop_id}
    src_stops = []
    async for s in db.trip_stops.find({"trip_id": trip_id}).sort("sequence", 1):
        s.pop("_id", None)
        src_stops.append(s)

    for s in src_stops:
        old_stop_id = s["id"]
        new_stop_id = str(uuid.uuid4())
        stop_id_map[old_stop_id] = new_stop_id

        new_stop = {k: v for k, v in s.items() if k not in ("_id",)}
        new_stop["id"] = new_stop_id
        new_stop["trip_id"] = new_trip_id
        new_stop["created_at"] = now
        await db.trip_stops.insert_one(new_stop)

    # ── 4. Clone legs (remap from_stop_id / to_stop_id) ─────────────────────────
    async for leg in db.trip_legs.find({"trip_id": trip_id}):
        leg.pop("_id", None)
        new_leg = {k: v for k, v in leg.items()}
        new_leg["id"] = str(uuid.uuid4())
        new_leg["trip_id"] = new_trip_id
        # "origin" is a sentinel value — preserve it; otherwise remap
        old_from = leg.get("from_stop_id", "")
        old_to   = leg.get("to_stop_id", "")
        new_leg["from_stop_id"] = stop_id_map.get(old_from, old_from)
        new_leg["to_stop_id"]   = stop_id_map.get(old_to,   old_to)
        new_leg["created_at"] = now
        await db.trip_legs.insert_one(new_leg)

    # ── 5. Clone stays ────────────────────────────────────────────────────────────
    async for stay in db.trip_stays.find({"trip_id": trip_id}):
        stay.pop("_id", None)
        new_stay = {k: v for k, v in stay.items()}
        new_stay["id"] = str(uuid.uuid4())
        new_stay["trip_id"] = new_trip_id
        new_stay["stop_id"] = stop_id_map.get(stay.get("stop_id", ""), stay.get("stop_id", ""))
        new_stay["created_at"] = now
        await db.trip_stays.insert_one(new_stay)

    # ── 6. Clone places (restaurants, attractions, info_points, meeting_points) ──
    for collection, coll_name in [
        (db.trip_restaurants,   "trip_restaurants"),
        (db.trip_attractions,   "trip_attractions"),
        (db.trip_info_points,   "trip_info_points"),
        (db.trip_meeting_points, "trip_meeting_points"),
    ]:
        async for item in collection.find({"trip_id": trip_id}):
            item.pop("_id", None)
            new_item = {k: v for k, v in item.items()}
            new_item["id"] = str(uuid.uuid4())
            new_item["trip_id"] = new_trip_id
            new_item["stop_id"] = stop_id_map.get(item.get("stop_id", ""), item.get("stop_id", ""))
            new_item["created_at"] = now
            await collection.insert_one(new_item)

    # ── 7. Return the new trip (without _id) ─────────────────────────────────────
    new_trip.pop("_id", None)
    return new_trip


# ── Places: Restaurants ────────────────────────────────────────────────────────
@api_router.get("/trips/{trip_id}/stops/{stop_id}/restaurants")
async def list_restaurants(trip_id: str, stop_id: str, current_user: dict = Depends(get_current_user)):
    items = []
    async for r in db.trip_restaurants.find({"stop_id": stop_id, "trip_id": trip_id}).sort("created_at", 1):
        r.pop("_id", None); items.append(r)
    return items

@api_router.post("/trips/{trip_id}/stops/{stop_id}/restaurants")
async def add_restaurant(trip_id: str, stop_id: str, body: RestaurantCreate, current_user: dict = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()), "trip_id": trip_id, "stop_id": stop_id,
        "name": body.name, "cuisine": body.cuisine or "", "address": body.address or "",
        "booking_url": body.booking_url or "", "cost": body.cost or 0.0,
        "notes": body.notes or "", "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.trip_restaurants.insert_one(doc); doc.pop("_id", None); return doc

@api_router.put("/trips/{trip_id}/restaurants/{item_id}")
async def update_restaurant(trip_id: str, item_id: str, body: POIUpdate, current_user: dict = Depends(get_current_user)):
    update = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.trip_restaurants.find_one_and_update({"id": item_id}, {"$set": update}, return_document=True)
    if not result: raise HTTPException(404, "Restaurant not found")
    result.pop("_id", None); return result

@api_router.delete("/trips/{trip_id}/restaurants/{item_id}")
async def delete_restaurant(trip_id: str, item_id: str, current_user: dict = Depends(get_current_user)):
    await db.trip_restaurants.delete_one({"id": item_id}); return {"message": "Deleted"}

# ── Places: Attractions ────────────────────────────────────────────────────────
@api_router.get("/trips/{trip_id}/stops/{stop_id}/attractions")
async def list_attractions(trip_id: str, stop_id: str, current_user: dict = Depends(get_current_user)):
    items = []
    async for a in db.trip_attractions.find({"stop_id": stop_id, "trip_id": trip_id}).sort("created_at", 1):
        a.pop("_id", None); items.append(a)
    return items

@api_router.post("/trips/{trip_id}/stops/{stop_id}/attractions")
async def add_attraction(trip_id: str, stop_id: str, body: AttractionCreate, current_user: dict = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()), "trip_id": trip_id, "stop_id": stop_id,
        "name": body.name, "category": body.category or "other", "address": body.address or "",
        "booking_url": body.booking_url or "", "cost": body.cost or 0.0,
        "duration": body.duration or "", "schedule": body.schedule or "",
        "notes": body.notes or "", "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.trip_attractions.insert_one(doc); doc.pop("_id", None); return doc

@api_router.put("/trips/{trip_id}/attractions/{item_id}")
async def update_attraction(trip_id: str, item_id: str, body: POIUpdate, current_user: dict = Depends(get_current_user)):
    update = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.trip_attractions.find_one_and_update({"id": item_id}, {"$set": update}, return_document=True)
    if not result: raise HTTPException(404, "Attraction not found")
    result.pop("_id", None); return result

@api_router.delete("/trips/{trip_id}/attractions/{item_id}")
async def delete_attraction(trip_id: str, item_id: str, current_user: dict = Depends(get_current_user)):
    await db.trip_attractions.delete_one({"id": item_id}); return {"message": "Deleted"}

# ── Places: Tourist Info Points ────────────────────────────────────────────────
@api_router.get("/trips/{trip_id}/stops/{stop_id}/info_points")
async def list_info_points(trip_id: str, stop_id: str, current_user: dict = Depends(get_current_user)):
    items = []
    async for ip in db.trip_info_points.find({"stop_id": stop_id, "trip_id": trip_id}).sort("created_at", 1):
        ip.pop("_id", None); items.append(ip)
    return items

@api_router.post("/trips/{trip_id}/stops/{stop_id}/info_points")
async def add_info_point(trip_id: str, stop_id: str, body: InfoPointCreate, current_user: dict = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()), "trip_id": trip_id, "stop_id": stop_id,
        "name": body.name, "address": body.address or "", "phone": body.phone or "",
        "hours": body.hours or "", "website": body.website or "",
        "notes": body.notes or "", "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.trip_info_points.insert_one(doc); doc.pop("_id", None); return doc

@api_router.put("/trips/{trip_id}/info_points/{item_id}")
async def update_info_point(trip_id: str, item_id: str, body: POIUpdate, current_user: dict = Depends(get_current_user)):
    update = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.trip_info_points.find_one_and_update({"id": item_id}, {"$set": update}, return_document=True)
    if not result: raise HTTPException(404, "Info point not found")
    result.pop("_id", None); return result

@api_router.delete("/trips/{trip_id}/info_points/{item_id}")
async def delete_info_point(trip_id: str, item_id: str, current_user: dict = Depends(get_current_user)):
    await db.trip_info_points.delete_one({"id": item_id}); return {"message": "Deleted"}

# ── Places: Meeting Points ─────────────────────────────────────────────────────
@api_router.get("/trips/{trip_id}/stops/{stop_id}/meeting_points")
async def list_meeting_points(trip_id: str, stop_id: str, current_user: dict = Depends(get_current_user)):
    items = []
    async for mp in db.trip_meeting_points.find({"stop_id": stop_id, "trip_id": trip_id}).sort("created_at", 1):
        mp.pop("_id", None); items.append(mp)
    return items

@api_router.post("/trips/{trip_id}/stops/{stop_id}/meeting_points")
async def add_meeting_point(trip_id: str, stop_id: str, body: MeetingPointCreate, current_user: dict = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()), "trip_id": trip_id, "stop_id": stop_id,
        "name": body.name, "address": body.address or "",
        "meeting_url": body.meeting_url or "",
        "notes": body.notes or "", "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.trip_meeting_points.insert_one(doc); doc.pop("_id", None); return doc

@api_router.put("/trips/{trip_id}/meeting_points/{item_id}")
async def update_meeting_point(trip_id: str, item_id: str, body: POIUpdate, current_user: dict = Depends(get_current_user)):
    update = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.trip_meeting_points.find_one_and_update({"id": item_id}, {"$set": update}, return_document=True)
    if not result: raise HTTPException(404, "Meeting point not found")
    result.pop("_id", None); return result

@api_router.delete("/trips/{trip_id}/meeting_points/{item_id}")
async def delete_meeting_point(trip_id: str, item_id: str, current_user: dict = Depends(get_current_user)):
    await db.trip_meeting_points.delete_one({"id": item_id}); return {"message": "Deleted"}

# ── Stops ──────────────────────────────────────────────────────────────────────

@api_router.post("/trips/{trip_id}/stops")
async def add_stop(trip_id: str, body: StopCreate, current_user: dict = Depends(get_current_user)):
    if body.trip_id != trip_id: body = body.model_copy(update={"trip_id": trip_id})
    count = await db.trip_stops.count_documents({"trip_id": trip_id})
    doc = {
        "id":       str(uuid.uuid4()),
        "trip_id":  trip_id,
        "sequence": body.sequence if body.sequence else count,
        "place_name": body.place_name,
        "country":  body.country or "",
        "lat":      body.lat,
        "lng":      body.lng,
        "nights":   max(1, body.nights),
        "accommodation_needed": body.accommodation_needed,
        "transport_needed":     body.transport_needed,
        "notes":    body.notes or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.trip_stops.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.put("/trips/{trip_id}/stops/{stop_id}")
async def update_stop(trip_id: str, stop_id: str, body: StopUpdate, current_user: dict = Depends(get_current_user)):
    update = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if "nights" in update: update["nights"] = max(1, update["nights"])
    result = await db.trip_stops.find_one_and_update(
        {"id": stop_id, "trip_id": trip_id}, {"$set": update}, return_document=True
    )
    if not result: raise HTTPException(404, "Stop not found")
    result.pop("_id", None)
    return result

@api_router.delete("/trips/{trip_id}/stops/{stop_id}")
async def delete_stop(trip_id: str, stop_id: str, current_user: dict = Depends(get_current_user)):
    await db.trip_stops.delete_one({"id": stop_id, "trip_id": trip_id})
    await db.trip_stays.delete_many({"stop_id": stop_id})
    return {"message": "Stop deleted"}

@api_router.post("/trips/{trip_id}/stops/reorder")
async def reorder_stops(trip_id: str, body: dict, current_user: dict = Depends(get_current_user)):
    order: list = body.get("order", [])
    for idx, stop_id in enumerate(order):
        await db.trip_stops.update_one({"id": stop_id, "trip_id": trip_id}, {"$set": {"sequence": idx}})
    return {"message": "Reordered"}

# ── Legs ───────────────────────────────────────────────────────────────────────

@api_router.post("/trips/{trip_id}/legs")
async def add_leg(trip_id: str, body: LegCreate, current_user: dict = Depends(get_current_user)):
    doc = {
        "id":       str(uuid.uuid4()),
        "trip_id":  trip_id,
        "from_stop_id": body.from_stop_id,
        "to_stop_id":   body.to_stop_id,
        "mode":     body.mode or "flight",
        "operator": body.operator or "",
        "depart_datetime": body.depart_datetime or "",
        "arrive_datetime": body.arrive_datetime or "",
        "from_point": body.from_point or "",
        "to_point":   body.to_point or "",
        "cost":     body.cost,
        "cancellation_policy": body.cancellation_policy or "",
        "notes":    body.notes or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.trip_legs.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.put("/trips/{trip_id}/legs/{leg_id}")
async def update_leg(trip_id: str, leg_id: str, body: LegUpdate, current_user: dict = Depends(get_current_user)):
    update = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    result = await db.trip_legs.find_one_and_update(
        {"id": leg_id, "trip_id": trip_id}, {"$set": update}, return_document=True
    )
    if not result: raise HTTPException(404, "Leg not found")
    result.pop("_id", None)
    return result

@api_router.delete("/trips/{trip_id}/legs/{leg_id}")
async def delete_leg(trip_id: str, leg_id: str, current_user: dict = Depends(get_current_user)):
    await db.trip_legs.delete_one({"id": leg_id, "trip_id": trip_id})
    return {"message": "Leg deleted"}

# ── Stays ──────────────────────────────────────────────────────────────────────

@api_router.post("/stays")
async def add_stay(body: StayCreate, current_user: dict = Depends(get_current_user)):
    doc = {
        "id":       str(uuid.uuid4()),
        "stop_id":  body.stop_id,
        "trip_id":  body.trip_id,
        "hotel_name": body.hotel_name or "",
        "stars":    body.stars,
        "room_type": body.room_type or "",
        "board":    body.board or "",
        "distance_from_centre": body.distance_from_centre or "",
        "cost":     body.cost,
        "cancellation_policy": body.cancellation_policy or "",
        "notes":    body.notes or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.trip_stays.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.put("/stays/{stay_id}")
async def update_stay(stay_id: str, body: StayUpdate, current_user: dict = Depends(get_current_user)):
    update = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    result = await db.trip_stays.find_one_and_update(
        {"id": stay_id}, {"$set": update}, return_document=True
    )
    if not result: raise HTTPException(404, "Stay not found")
    result.pop("_id", None)
    return result

@api_router.delete("/stays/{stay_id}")
async def delete_stay(stay_id: str, current_user: dict = Depends(get_current_user)):
    await db.trip_stays.delete_one({"id": stay_id})
    return {"message": "Stay deleted"}

# ── Pins ───────────────────────────────────────────────────────────────────────

@api_router.get("/pins")
async def list_pins(current_user: dict = Depends(get_current_user)):
    pins = []
    async for p in db.trip_pins.find({}).sort("created_at", -1):
        p.pop("_id", None)
        pins.append(p)
    return pins

@api_router.post("/pins")
async def create_pin(body: PinCreate, current_user: dict = Depends(get_current_user)):
    doc = {
        "id":         str(uuid.uuid4()),
        "pin_type":   body.pin_type,
        "name":       body.name,
        "lat":        body.lat,
        "lng":        body.lng,
        "country":    body.country or "",
        "rating":     body.rating,
        "notes":      body.notes or "",
        "created_by": current_user.get("name", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.trip_pins.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.put("/pins/{pin_id}")
async def update_pin(pin_id: str, body: PinUpdate, current_user: dict = Depends(get_current_user)):
    update = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    result = await db.trip_pins.find_one_and_update(
        {"id": pin_id}, {"$set": update}, return_document=True
    )
    if not result: raise HTTPException(404, "Pin not found")
    result.pop("_id", None)
    return result

@api_router.delete("/pins/{pin_id}")
async def delete_pin(pin_id: str, current_user: dict = Depends(get_current_user)):
    await db.trip_pins.delete_one({"id": pin_id})
    return {"message": "Pin deleted"}

# ── Validation ─────────────────────────────────────────────────────────────────

@api_router.get("/trips/{trip_id}/validate")
async def validate_trip(trip_id: str, current_user: dict = Depends(get_current_user)):
    trip = await db.trips.find_one({"id": trip_id})
    if not trip: raise HTTPException(404, "Trip not found")

    stops = []
    async for s in db.trip_stops.find({"trip_id": trip_id}).sort("sequence", 1):
        s.pop("_id", None)
        stays = []
        async for st in db.trip_stays.find({"stop_id": s["id"]}):
            st.pop("_id", None)
            stays.append(st)
        s["stays"] = stays
        stops.append(s)

    legs = []
    async for lg in db.trip_legs.find({"trip_id": trip_id}):
        lg.pop("_id", None)
        legs.append(lg)

    checks = []
    total_allocated = sum(s.get("nights", 0) for s in stops)
    total_required  = trip.get("total_nights", 0)

    # 1. Origin set
    checks.append({
        "id": "origin",
        "label": "Origin city set",
        "pass": bool(trip.get("origin_name")),
        "detail": trip.get("origin_name", "Not set"),
    })
    # 2. Return date set
    checks.append({
        "id": "dates",
        "label": "Departure and return dates set",
        "pass": bool(trip.get("start_date") and trip.get("end_date")),
        "detail": f"{trip.get('start_date','')} → {trip.get('end_date','')}",
    })
    # 3. Nights reconciled
    checks.append({
        "id": "nights",
        "label": f"Nights allocated equals trip duration ({total_allocated} / {total_required})",
        "pass": total_allocated == total_required and total_required > 0,
        "detail": f"Allocated: {total_allocated}, Required: {total_required}",
    })
    # 4. Return leg
    has_return = any(lg.get("to_stop_id") == "origin" for lg in legs)
    checks.append({
        "id": "return_leg",
        "label": "Return leg present",
        "pass": has_return,
        "detail": "Return leg back to origin must be added in Legs & Stays",
    })
    # 5. Every leg has mode + cost
    legs_ok = all(lg.get("mode") and lg.get("cost") is not None for lg in legs)
    checks.append({
        "id": "legs_complete",
        "label": "Every transport leg has a mode and cost",
        "pass": legs_ok or len(legs) == 0,
        "detail": f"{len(legs)} leg(s) on file",
    })
    # 6. Every leg has cancellation policy
    legs_cancel_ok = all(lg.get("cancellation_policy") for lg in legs)
    checks.append({
        "id": "legs_cancel",
        "label": "Every leg has a cancellation policy",
        "pass": legs_cancel_ok or len(legs) == 0,
        "detail": "Required field on every transport leg",
    })
    # 7. Every stay with accommodation_needed has a record + cancellation policy
    needs_stay = [s for s in stops if s.get("accommodation_needed")]
    stays_ok = all(len(s.get("stays", [])) > 0 for s in needs_stay)
    stays_cancel_ok = all(
        all(st.get("cancellation_policy") for st in s.get("stays", []))
        for s in needs_stay
    )
    checks.append({
        "id": "stays",
        "label": "Every stop needing accommodation has a hotel entry",
        "pass": stays_ok or len(needs_stay) == 0,
        "detail": f"{len(needs_stay)} stop(s) need accommodation",
    })
    checks.append({
        "id": "stays_cancel",
        "label": "Every accommodation has a cancellation policy",
        "pass": stays_cancel_ok or len(needs_stay) == 0,
        "detail": "Required field on every hotel stay",
    })
    # 8. Child ages
    children = trip.get("children", [])
    kids_ok = all(c.get("age") is not None or c.get("dob") for c in children)
    checks.append({
        "id": "child_ages",
        "label": "Child ages / DOBs captured",
        "pass": kids_ok or len(children) == 0,
        "detail": f"{len(children)} child(ren) on booking",
    })

    all_pass = all(c["pass"] for c in checks)
    return {"valid": all_pass, "checks": checks}

# ═══════════════════════════════════════════════════════════════════════════════
# TRIP-PLANNER v2 — Places, TripComponents, TaxProfiles, QuoteTerms
# ═══════════════════════════════════════════════════════════════════════════════

# ── Status / type enumerations ─────────────────────────────────────────────────
TRIP_STATUS_VALUES = [
    "draft", "quoted", "sent", "approved",
    "booked", "itinerary_generated", "cancelled",
    # Legacy values from pre-migration trips – kept for backward compat
    "Draft", "Sent", "Confirmed", "Lost",
]

COMPONENT_TYPES = [
    "flight", "train", "bus", "ferry", "cruise",
    "transfer", "self_drive",               # transport types → "legs"
    "stay",                                 # accommodation
    "activity", "attraction", "meal",       # place types
    "visa", "insurance", "misc",
]

TRANSPORT_TYPES = {
    "flight", "train", "bus", "ferry",
    "cruise", "transfer", "self_drive",
}

# ── Places ─────────────────────────────────────────────────────────────────────
class PlaceCreate(BaseModel):
    name: str
    country: Optional[str] = None
    city: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    google_place_id: Optional[str] = None
    category: Optional[str] = None          # hotel|restaurant|attraction|activity|beach|museum|…
    notes: Optional[str] = None
    photo_path: Optional[str] = None
    is_favourite: bool = False


class PlaceUpdate(BaseModel):
    name: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    google_place_id: Optional[str] = None
    category: Optional[str] = None
    notes: Optional[str] = None
    photo_path: Optional[str] = None
    is_favourite: Optional[bool] = None


# ── TripComponents ─────────────────────────────────────────────────────────────
class TripComponentCreate(BaseModel):
    trip_id: str
    type: str                                # must be in COMPONENT_TYPES
    title: str
    place_id: Optional[str] = None           # FK → places.id
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    start_datetime: Optional[str] = None     # ISO-8601
    end_datetime: Optional[str] = None
    nights: Optional[int] = None
    day_index: Optional[int] = None
    sort_order: int = 0
    status: str = "draft"
    supplier_name: Optional[str] = None
    reference_no: Optional[str] = None
    pax_count: Optional[int] = None
    net_cost: Optional[float] = None
    net_currency: Optional[str] = None
    fx_rate: Optional[float] = 1.0
    markup_type: Optional[str] = "percentage"   # "percentage" | "fixed"
    markup_value: Optional[float] = 0.0
    sell_price: Optional[float] = None
    sell_currency: Optional[str] = None
    details_json: Optional[Dict] = None
    # ── migration dedup keys (ignored on normal creates) ──────────────────────
    source_leg_id: Optional[str] = None
    source_stay_id: Optional[str] = None
    source_quote_item_id: Optional[str] = None
    from_quote_version: Optional[int] = None


class TripComponentUpdate(BaseModel):
    type: Optional[str] = None
    title: Optional[str] = None
    place_id: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    start_datetime: Optional[str] = None
    end_datetime: Optional[str] = None
    nights: Optional[int] = None
    day_index: Optional[int] = None
    sort_order: Optional[int] = None
    status: Optional[str] = None
    supplier_name: Optional[str] = None
    reference_no: Optional[str] = None
    pax_count: Optional[int] = None
    net_cost: Optional[float] = None
    net_currency: Optional[str] = None
    fx_rate: Optional[float] = None
    markup_type: Optional[str] = None
    markup_value: Optional[float] = None
    sell_price: Optional[float] = None
    sell_currency: Optional[str] = None
    details_json: Optional[Dict] = None


# ── TaxProfiles ────────────────────────────────────────────────────────────────
class TaxProfileCreate(BaseModel):
    label: str                              # "GST", "TCS", "VAT" …
    rate: float                             # percentage, e.g. 5.0
    applies_to: str = "all"                 # "all" | "international" | "domestic"
    is_enabled: bool = True
    description: Optional[str] = None


class TaxProfileUpdate(BaseModel):
    label: Optional[str] = None
    rate: Optional[float] = None
    applies_to: Optional[str] = None
    is_enabled: Optional[bool] = None
    description: Optional[str] = None


# ── QuoteTermsTemplate ─────────────────────────────────────────────────────────
class QuoteTermsTemplateUpdate(BaseModel):
    inclusions: Optional[List[str]] = None
    exclusions: Optional[List[str]] = None
    terms_and_conditions: Optional[str] = None
    validity_days: Optional[int] = None     # default quote validity in days


# ── Sources (Research-and-Capture) ────────────────────────────────────────────

class SourceCreate(BaseModel):
    trip_id: str
    component_id: Optional[str] = None    # leg_id or stay_id
    component_type: Optional[str] = None  # "leg" | "stay" | None
    url: str
    captured_price: Optional[float] = None
    captured_currency: Optional[str] = "INR"
    screenshot_url: Optional[str] = None
    notes: Optional[str] = None


class SourceUpdate(BaseModel):
    url: Optional[str] = None
    captured_price: Optional[float] = None
    captured_currency: Optional[str] = None
    screenshot_url: Optional[str] = None
    notes: Optional[str] = None
    component_id: Optional[str] = None
    component_type: Optional[str] = None


@api_router.get("/sources")
async def list_sources(
    trip_id: Optional[str] = None,
    component_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    q: Dict[str, Any] = {}
    if trip_id:       q["trip_id"]       = trip_id
    if component_id:  q["component_id"]  = component_id
    items = await db.sources.find(q, {"_id": 0}).sort("captured_at", -1).to_list(500)
    return [serialize_doc(s) for s in items]


@api_router.post("/sources")
async def create_source(body: SourceCreate, current_user: dict = Depends(get_current_user)):
    # Validate trip exists
    trip = await db.trips.find_one({"id": body.trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id":                str(uuid.uuid4()),
        "trip_id":           body.trip_id,
        "component_id":      body.component_id,
        "component_type":    body.component_type,
        "url":               body.url,
        "captured_price":    body.captured_price,
        "captured_currency": body.captured_currency or "INR",
        "screenshot_url":    body.screenshot_url,
        "notes":             body.notes or "",
        "captured_at":       now,
        "captured_by":       current_user.get("name", ""),
    }
    await db.sources.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/sources/{source_id}")
async def update_source(source_id: str, body: SourceUpdate, current_user: dict = Depends(get_current_user)):
    existing = await db.sources.find_one({"id": source_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Source not found")
    update = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.sources.find_one_and_update(
        {"id": source_id}, {"$set": update}, return_document=True
    )
    result.pop("_id", None)
    return serialize_doc(result)


@api_router.delete("/sources/{source_id}")
async def delete_source(source_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.sources.delete_one({"id": source_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Source not found")
    return {"message": "Source deleted"}


# ═══════════════════════════════════════════════════════════════════════════════
# PLACES — Library replacing My Pins
# ═══════════════════════════════════════════════════════════════════════════════

@api_router.get("/places")
async def list_places(
    q: Optional[str] = None,
    country: Optional[str] = None,
    category: Optional[str] = None,
    favourites_only: bool = False,
    current_user: dict = Depends(get_current_user),
):
    filt: Dict[str, Any] = {}
    if favourites_only:
        filt["is_favourite"] = True
    if country:
        filt["country"] = {"$regex": country, "$options": "i"}
    if category:
        filt["category"] = {"$regex": category, "$options": "i"}
    if q:
        filt["$or"] = [
            {"name":    {"$regex": q, "$options": "i"}},
            {"city":    {"$regex": q, "$options": "i"}},
            {"country": {"$regex": q, "$options": "i"}},
            {"notes":   {"$regex": q, "$options": "i"}},
        ]
    items = await db.places.find(filt, {"_id": 0}).sort("name", 1).to_list(1000)
    return [serialize_doc(p) for p in items]


@api_router.post("/places")
async def create_place(body: PlaceCreate, current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id":              str(uuid.uuid4()),
        "name":            body.name,
        "country":         body.country,
        "city":            body.city,
        "latitude":        body.latitude,
        "longitude":       body.longitude,
        "google_place_id": body.google_place_id,
        "category":        body.category,
        "notes":           body.notes,
        "photo_path":      body.photo_path,
        "is_favourite":    body.is_favourite,
        "created_by":      current_user.get("name", ""),
        "created_at":      now,
        "updated_at":      now,
    }
    await db.places.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/places/{place_id}")
async def update_place(
    place_id: str,
    body: PlaceUpdate,
    current_user: dict = Depends(get_current_user),
):
    existing = await db.places.find_one({"id": place_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Place not found")
    update = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.places.find_one_and_update(
        {"id": place_id}, {"$set": update}, return_document=True
    )
    result.pop("_id", None)
    return serialize_doc(result)


@api_router.delete("/places/{place_id}")
async def delete_place(place_id: str, current_user: dict = Depends(get_current_user)):
    res = await db.places.delete_one({"id": place_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Place not found")
    return {"message": "Place deleted"}


# ═══════════════════════════════════════════════════════════════════════════════
# TRIP COMPONENTS — Canonical source of truth for every item on a trip
# ═══════════════════════════════════════════════════════════════════════════════

@api_router.get("/trips/{trip_id}/components")
async def list_trip_components(
    trip_id: str,
    type: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    trip = await db.trips.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    filt: Dict[str, Any] = {"trip_id": trip_id}
    if type:
        filt["type"] = type
    items = await db.trip_components.find(filt, {"_id": 0}).sort(
        [("day_index", 1), ("sort_order", 1)], 
    ).to_list(500)
    return [serialize_doc(c) for c in items]


@api_router.post("/trips/{trip_id}/components")
async def create_trip_component(
    trip_id: str,
    body: TripComponentCreate,
    current_user: dict = Depends(get_current_user),
):
    trip = await db.trips.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if body.type not in COMPONENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid type '{body.type}'. Must be one of: {COMPONENT_TYPES}",
        )
    now = datetime.now(timezone.utc).isoformat()
    # Compute sell_price from net_cost if not supplied
    sell_price = body.sell_price
    if sell_price is None and body.net_cost is not None:
        net_base = body.net_cost * (body.fx_rate or 1.0)
        if body.markup_type == "percentage":
            sell_price = round(net_base * (1 + (body.markup_value or 0) / 100), 2)
        else:
            sell_price = round(net_base + (body.markup_value or 0), 2)
    doc = {
        "id":                     str(uuid.uuid4()),
        "trip_id":                trip_id,
        "type":                   body.type,
        "title":                  body.title,
        "place_id":               body.place_id,
        "latitude":               body.latitude,
        "longitude":              body.longitude,
        "start_datetime":         body.start_datetime,
        "end_datetime":           body.end_datetime,
        "nights":                 body.nights,
        "day_index":              body.day_index,
        "sort_order":             body.sort_order,
        "status":                 body.status,
        "supplier_name":          body.supplier_name,
        "reference_no":           body.reference_no,
        "pax_count":              body.pax_count,
        "net_cost":               body.net_cost,
        "net_currency":           body.net_currency,
        "fx_rate":                body.fx_rate,
        "markup_type":            body.markup_type,
        "markup_value":           body.markup_value,
        "sell_price":             sell_price,
        "sell_currency":          body.sell_currency,
        "details_json":           body.details_json or {},
        "source_leg_id":          body.source_leg_id,
        "source_stay_id":         body.source_stay_id,
        "source_quote_item_id":   body.source_quote_item_id,
        "from_quote_version":     body.from_quote_version,
        "created_by":             current_user.get("name", ""),
        "created_at":             now,
        "updated_at":             now,
    }
    await db.trip_components.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/trips/{trip_id}/components/reorder")
async def reorder_trip_components(
    trip_id: str,
    body: dict,
    current_user: dict = Depends(get_current_user),
):
    """Batch reorder trip components. Body: {"order": [{"id": "uuid", "sort_order": 0, "day_index": 0}, ...]}"""
    trip = await db.trips.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    order_items = body.get("order", [])
    if not order_items:
        return {"updated": 0}
    now = datetime.now(timezone.utc).isoformat()
    updated_count = 0
    for item in order_items:
        comp_id = item.get("id")
        if not comp_id:
            continue
        update_fields: Dict[str, Any] = {"updated_at": now}
        if "sort_order" in item:
            update_fields["sort_order"] = item["sort_order"]
        if "day_index" in item:
            update_fields["day_index"] = item["day_index"]
        result = await db.trip_components.update_one(
            {"id": comp_id, "trip_id": trip_id},
            {"$set": update_fields},
        )
        if result.modified_count > 0:
            updated_count += 1
    return {"updated": updated_count}


@api_router.put("/trips/{trip_id}/components/{component_id}")
async def update_trip_component(
    trip_id: str,
    component_id: str,
    body: TripComponentUpdate,
    current_user: dict = Depends(get_current_user),
):
    existing = await db.trip_components.find_one({"id": component_id, "trip_id": trip_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Component not found")
    update = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    # Recompute sell_price if cost/markup changed but sell_price not supplied
    if "sell_price" not in update:
        net = update.get("net_cost", existing.get("net_cost"))
        fx  = update.get("fx_rate",  existing.get("fx_rate", 1.0))
        mt  = update.get("markup_type",  existing.get("markup_type", "percentage"))
        mv  = update.get("markup_value", existing.get("markup_value", 0.0))
        if net is not None:
            net_base = net * (fx or 1.0)
            if mt == "percentage":
                update["sell_price"] = round(net_base * (1 + (mv or 0) / 100), 2)
            else:
                update["sell_price"] = round(net_base + (mv or 0), 2)
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.trip_components.find_one_and_update(
        {"id": component_id, "trip_id": trip_id},
        {"$set": update},
        return_document=True,
    )
    result.pop("_id", None)
    return serialize_doc(result)


@api_router.delete("/trips/{trip_id}/components/{component_id}")
async def delete_trip_component(
    trip_id: str,
    component_id: str,
    current_user: dict = Depends(get_current_user),
):
    res = await db.trip_components.delete_one({"id": component_id, "trip_id": trip_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Component not found")
    return {"message": "Component deleted"}


# ═══════════════════════════════════════════════════════════════════════════════
# PASS 3 — Generate Itinerary from trip_components + Divergence Rule
# ═══════════════════════════════════════════════════════════════════════════════

def _fmt_date_human(iso_str: Optional[str]) -> str:
    """Convert ISO datetime string to human-readable date like '17 June 2026'."""
    if not iso_str:
        return ""
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        return dt.strftime("%-d %B %Y")
    except Exception:
        return iso_str[:10] if len(iso_str) >= 10 else iso_str


def _fmt_time_hhmm(iso_str: Optional[str]) -> str:
    """Extract HH:MM from ISO datetime string."""
    if not iso_str:
        return ""
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        return dt.strftime("%H:%M")
    except Exception:
        return ""


def _component_to_block(comp: dict, order: int) -> dict:
    """Map a trip_component document → an itinerary block dict."""
    ctype = comp.get("type", "misc")
    title = comp.get("title", "")
    supplier = comp.get("supplier_name", "") or ""
    ref = comp.get("reference_no", "") or ""
    start_dt = comp.get("start_datetime")
    end_dt   = comp.get("end_datetime")
    nights   = comp.get("nights")
    pax      = comp.get("pax_count")

    start_time = _fmt_time_hhmm(start_dt)
    end_time   = _fmt_time_hhmm(end_dt)
    start_date = _fmt_date_human(start_dt)
    end_date   = _fmt_date_human(end_dt)

    # Default initialisations — ensure block_type and data are always defined
    # even if ctype doesn't match any branch (defensive, satisfies static analysis)
    block_type: str = "INFO"
    data: dict = {
        "severity": "info",
        "title":    title,
        "content":  f"Supplier: {supplier}" if supplier else "",
        "notes":    ref or "",
    }

    # Determine block_type and data
    if ctype == "flight":
        block_type = "FLIGHT"
        data = {
            "airline":      supplier or "",
            "flight_no":    ref or "",
            "from_airport": "",
            "to_airport":   "",
            "dep_time":     start_time,
            "arr_time":     end_time,
            "dep_date":     start_date,
            "arr_date":     end_date if end_date != start_date else "",
            "pnr":          ref or "",
            "notes":        title,
        }
    elif ctype == "ferry":
        block_type = "FERRY"
        data = {
            "operator":      supplier or title,
            "from_terminal": "",
            "to_terminal":   "",
            "dep_time":      start_time,
            "arr_time":      end_time,
            "ticket_ref":    ref or "",
            "phone":         "",
            "notes":         title,
        }
    elif ctype in ("transfer", "bus", "train", "cruise", "self_drive"):
        block_type = "TRANSFER"
        vehicle_map = {
            "transfer": "Private Transfer", "bus": "Bus", "train": "Train",
            "cruise": "Cruise", "self_drive": "Self Drive",
        }
        data = {
            "vehicle":       vehicle_map.get(ctype, ctype.replace("_", " ").title()),
            "from_location": title,
            "to_location":   "",
            "dep_time":      start_time,
            "duration":      "",
            "conf_no":       ref or "",
            "driver_name":   supplier or "",
            "notes":         "",
        }
    elif ctype == "stay":
        block_type = "HOTEL"
        data = {
            "hotel_name":     title,
            "city":           "",
            "address":        "",
            "check_in_date":  start_date,
            "check_in_time":  start_time or "From 15:00",
            "check_out_date": end_date,
            "check_out_time": end_time or "Until 11:00",
            "nights":         str(nights) if nights else "",
            "room_type":      "",
            "meal_plan":      "BB",
            "conf_no":        ref or "",
            "phone":          "",
            "notes":          "",
        }
    elif ctype in ("activity", "attraction"):
        block_type = "EXCURSION"
        data = {
            "name":           title,
            "category":       ctype.title(),
            "location":       "",
            "address":        "",
            "opening_hours":  start_time or "",
            "duration":       "",
            "ticket_included": "Ticket Included",
            "ticket_ref":     ref or "",
            "phone":          "",
            "description":    "",
            "notes":          "",
        }
    elif ctype == "meal":
        block_type = "EATERIES"
        data = {
            "meal_type":       "Meal",
            "restaurant_name": title,
            "cuisine":         supplier or "",
            "address":         "",
            "phone":           "",
            "opening_hours":   start_time or "",
            "price_range":     "",
            "notes":           "",
        }
    else:
        # misc, insurance, visa → INFO block
        block_type = "INFO"
        data = {
            "severity": "info",
            "title":    title,
            "content":  f"Supplier: {supplier}" if supplier else "",
            "notes":    ref or "",
        }

    return {
        "id":         str(uuid.uuid4()),
        "block_type": block_type,
        "status":     "booked",
        "time":       start_time or "",
        "data":       data,
        "order":      order,
    }


@api_router.post("/trips/{trip_id}/generate-itinerary")
async def generate_itinerary_from_trip(
    trip_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Convert all trip_components for a trip into an itinerary document.
    Groups components into days by start_datetime date.
    Sets trip.linked_itinerary_id and trip.status = 'itinerary_generated'.
    Returns {"itinerary_id": ..., "itinerary": {...}}.
    """
    trip = await db.trips.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Fetch all components sorted by day_index then sort_order
    components = await db.trip_components.find(
        {"trip_id": trip_id}, {"_id": 0}
    ).sort([("day_index", 1), ("sort_order", 1)]).to_list(500)

    # Group into days by start_datetime date
    from collections import defaultdict, OrderedDict
    day_map: dict = OrderedDict()
    undated_key = "__undated__"

    for comp in components:
        start_dt = comp.get("start_datetime")
        if start_dt:
            try:
                dt = datetime.fromisoformat(start_dt.replace("Z", "+00:00"))
                day_key = dt.date().isoformat()  # YYYY-MM-DD
            except Exception:
                day_key = undated_key
        else:
            day_key = undated_key
        if day_key not in day_map:
            day_map[day_key] = []
        day_map[day_key].append(comp)

    # Sort date keys chronologically (undated last)
    sorted_keys = sorted(
        [k for k in day_map if k != undated_key]
    )
    if undated_key in day_map:
        sorted_keys.append(undated_key)

    # Build days list
    days = []
    for day_num, day_key in enumerate(sorted_keys, start=1):
        comps_for_day = day_map[day_key]
        # Human date label
        if day_key != undated_key:
            try:
                dt = datetime.fromisoformat(day_key)
                date_label = dt.strftime("%-d %B %Y")
            except Exception:
                date_label = day_key
        else:
            date_label = ""

        blocks = []
        for order_idx, comp in enumerate(comps_for_day):
            blocks.append(_component_to_block(comp, order_idx))

        days.append({
            "day_number": day_num,
            "date":       date_label,
            "day_label":  f"Day {day_num}",
            "blocks":     blocks,
        })

    # If no components, create at least one empty day
    if not days:
        days = [{"day_number": 1, "date": _fmt_date_human(trip.get("start_date")), "day_label": "Day 1", "blocks": []}]

    # Build itinerary document
    now = datetime.now(timezone.utc).isoformat()
    itin_doc = {
        "id":                   str(uuid.uuid4()),
        "title":                trip.get("trip_title") or f"{trip.get('client_name', 'Trip')} — {trip.get('destination_summary', '')}".strip(" —"),
        "client_id":            trip.get("client_id"),
        "client_name":          trip.get("client_name", ""),
        "enquiry_id":           trip.get("enquiry_id"),
        "destination":          trip.get("destination_summary", ""),
        "start_date":           _fmt_date_human(trip.get("start_date")),
        "end_date":             _fmt_date_human(trip.get("end_date")),
        "pax_adults":           trip.get("adults", 2),
        "pax_children":         len(trip.get("children", [])),
        "meal_preference":      None,
        "status":               "draft",
        "days":                 days,
        "source_trip_id":       trip_id,       # link back to the trip
        "created_by_staff_id":  current_user["id"],
        "created_by_name":      current_user["name"],
        "created_at":           now,
        "updated_at":           now,
    }

    await db.itineraries.insert_one(itin_doc)
    itin_doc.pop("_id", None)

    # Update the trip: link itinerary + change status
    await db.trips.update_one(
        {"id": trip_id},
        {"$set": {
            "linked_itinerary_id": itin_doc["id"],
            "status":              "itinerary_generated",
            "updated_at":          now,
        }},
    )

    return {"itinerary_id": itin_doc["id"], "itinerary": serialize_doc(itin_doc)}


@api_router.patch("/trips/{trip_id}/divergence")
async def flag_trip_divergence(
    trip_id: str,
    body: dict,
    current_user: dict = Depends(get_current_user),
):
    """
    Flag a price divergence on a trip that already has a generated itinerary.
    Sets trip.divergence_flagged = True and records which component/field changed.
    """
    trip = await db.trips.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    now = datetime.now(timezone.utc).isoformat()
    update_fields: Dict[str, Any] = {
        "divergence_flagged":    True,
        "divergence_at":         now,
        "divergence_component":  body.get("component_id"),
        "divergence_field":      body.get("field"),
        "divergence_old_value":  body.get("old_value"),
        "divergence_new_value":  body.get("new_value"),
        "updated_at":            now,
    }

    result = await db.trips.find_one_and_update(
        {"id": trip_id},
        {"$set": update_fields},
        return_document=True,
    )
    result.pop("_id", None)
    return result


# ═══════════════════════════════════════════════════════════════════════════════
# TAX PROFILES — No tax rate may be hardcoded in source; all live in this table
# ═══════════════════════════════════════════════════════════════════════════════

@api_router.get("/tax-profiles")
async def list_tax_profiles(current_user: dict = Depends(get_current_user)):
    items = await db.tax_profiles.find({}, {"_id": 0}).sort("label", 1).to_list(50)
    return [serialize_doc(p) for p in items]


@api_router.post("/tax-profiles")
async def create_tax_profile(
    body: TaxProfileCreate,
    current_user: dict = Depends(get_current_user),
):
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id":          str(uuid.uuid4()),
        "label":       body.label,
        "rate":        body.rate,
        "applies_to":  body.applies_to,
        "is_enabled":  body.is_enabled,
        "description": body.description,
        "created_at":  now,
        "updated_at":  now,
    }
    await db.tax_profiles.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/tax-profiles/{profile_id}")
async def update_tax_profile(
    profile_id: str,
    body: TaxProfileUpdate,
    current_user: dict = Depends(get_current_user),
):
    existing = await db.tax_profiles.find_one({"id": profile_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Tax profile not found")
    update = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.tax_profiles.find_one_and_update(
        {"id": profile_id}, {"$set": update}, return_document=True
    )
    result.pop("_id", None)
    return serialize_doc(result)


@api_router.delete("/tax-profiles/{profile_id}")
async def delete_tax_profile(
    profile_id: str,
    current_user: dict = Depends(get_current_user),
):
    res = await db.tax_profiles.delete_one({"id": profile_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Tax profile not found")
    return {"message": "Tax profile deleted"}


# ═══════════════════════════════════════════════════════════════════════════════
# QUOTE TERMS TEMPLATE — Single settings document
# ═══════════════════════════════════════════════════════════════════════════════

@api_router.get("/quote-terms-template")
async def get_quote_terms_template(current_user: dict = Depends(get_current_user)):
    doc = await db.quote_terms_template.find_one({"_id_key": "default"}, {"_id": 0})
    if not doc:
        return {
            "inclusions": [],
            "exclusions": [],
            "terms_and_conditions": "",
            "validity_days": 7,
        }
    doc.pop("_id_key", None)
    return serialize_doc(doc)


@api_router.put("/quote-terms-template")
async def update_quote_terms_template(
    body: QuoteTermsTemplateUpdate,
    current_user: dict = Depends(get_current_user),
):
    update = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.quote_terms_template.update_one(
        {"_id_key": "default"},
        {"$set": update, "$setOnInsert": {"_id_key": "default"}},
        upsert=True,
    )
    doc = await db.quote_terms_template.find_one({"_id_key": "default"}, {"_id": 0})
    doc.pop("_id_key", None)
    return serialize_doc(doc)


# ═══════════════════════════════════════════════════════════════════════════════
# MIGRATION — idempotent, returns structured report
# ═══════════════════════════════════════════════════════════════════════════════

# Status mapping from old quote/trip statuses to new canonical values
_QUOTE_STATUS_MAP = {
    "draft":     "draft",
    "Draft":     "draft",
    "sent":      "sent",
    "Sent":      "sent",
    "Accepted":  "approved",
    "accepted":  "approved",
    "Rejected":  "cancelled",
    "rejected":  "cancelled",
    "Confirmed": "booked",
    "confirmed": "booked",
    "Lost":      "cancelled",
    "lost":      "cancelled",
}

# Quote item category → trip_component type
_QUOTE_ITEM_TYPE_MAP = {
    "Flights":       "flight",
    "flights":       "flight",
    "Flight":        "flight",
    "Hotels":        "stay",
    "hotels":        "stay",
    "Hotel":         "stay",
    "Tours":         "activity",
    "tours":         "activity",
    "Tour":          "activity",
    "Transfers":     "transfer",
    "transfers":     "transfer",
    "Transfer":      "transfer",
    "Visa":          "visa",
    "visa":          "visa",
    "Insurance":     "insurance",
    "insurance":     "insurance",
    "Miscellaneous": "misc",
    "misc":          "misc",
    "Other":         "misc",
    "other":         "misc",
}


@api_router.post("/admin/run-migration")
async def run_migration(current_user: dict = Depends(get_current_user)):
    """
    Idempotent migration:
      1. trip_pins → places  (is_favourite=true)
      2. quotes   → trips + trip_components  (quote_no preserved)
      3. trip_legs  → trip_components
      4. trip_stays → trip_components
      5. Seed tax_profiles if empty
      6. Seed quote_terms_template if absent
    Returns a structured report. Safe to call multiple times.
    """
    now = datetime.now(timezone.utc).isoformat()
    report: Dict[str, Any] = {
        "started_at": now,
        "migrated_pins": 0,
        "migrated_quotes": 0,
        "migrated_quote_items": 0,
        "migrated_legs": 0,
        "migrated_stays": 0,
        "skipped_pins": 0,
        "skipped_quotes": 0,
        "skipped_legs": 0,
        "skipped_stays": 0,
        "seeded_tax_profiles": 0,
        "seeded_quote_terms": False,
        "errors": [],
    }

    # ── 1. trip_pins → places ──────────────────────────────────────────────────
    async for pin in db.trip_pins.find({}):
        try:
            pin_id   = pin.get("id", str(pin.get("_id", "")))
            name     = pin.get("name") or pin.get("label") or "Unnamed Pin"
            lat      = pin.get("lat") or pin.get("latitude")
            lng      = pin.get("lng") or pin.get("longitude")
            gpid     = pin.get("google_place_id") or pin.get("place_id")
            existing = await db.places.find_one({
                "$or": [
                    {"google_place_id": gpid} if gpid else {"id": None},
                    {"name": name, "latitude": lat, "longitude": lng},
                ]
            })
            if existing:
                report["skipped_pins"] += 1
                continue
            doc = {
                "id":              str(uuid.uuid4()),
                "name":            name,
                "country":         pin.get("country"),
                "city":            pin.get("city"),
                "latitude":        lat,
                "longitude":       lng,
                "google_place_id": gpid,
                "category":        pin.get("category") or pin.get("type"),
                "notes":           pin.get("notes") or pin.get("description"),
                "photo_path":      pin.get("photo_path") or pin.get("photo"),
                "is_favourite":    True,
                "created_by":      pin.get("created_by") or "migration",
                "created_at":      pin.get("created_at") or now,
                "updated_at":      now,
                "migrated_from_pin_id": pin_id,
            }
            await db.places.insert_one(doc)
            report["migrated_pins"] += 1
        except Exception as exc:
            report["errors"].append(f"pin {pin.get('id','?')}: {exc}")

    # ── 2. quotes → trips + trip_components ───────────────────────────────────
    async for quote in db.quotes.find({}):
        try:
            quote_no = quote.get("quote_no", "")
            # Skip if a trip with this quote_no already exists
            existing_trip = await db.trips.find_one({"quote_no": quote_no})
            if existing_trip:
                report["skipped_quotes"] += 1
                continue

            new_trip_id = str(uuid.uuid4())
            old_status  = quote.get("status", "Draft")
            new_status  = _QUOTE_STATUS_MAP.get(old_status, "draft")

            # Build trip document from quote fields
            trip_doc = {
                "id":                   new_trip_id,
                "quote_no":             quote_no,
                "quote_version":        1,
                "client_name":          quote.get("client_name") or "",
                "client_email":         quote.get("email"),
                "client_phone":         quote.get("phone"),
                "brand":                quote.get("brand", "BDV"),
                "origin_name":          quote.get("origin") or "",
                "origin_country":       "",
                "origin_lat":           None,
                "origin_lng":           None,
                "start_date":           quote.get("travel_date") or now[:10],
                "end_date":             quote.get("return_date") or now[:10],
                "adults":               int(quote.get("pax_adults", 1)),
                "children":             [],
                "rooms":                1,
                "currency":             quote.get("base_currency", "INR"),
                "margin_pct":           None,
                "budget_indication":    None,
                "notes":                quote.get("notes"),
                "status":               new_status,
                "trip_title":           quote.get("destination") or "",
                "destination_summary":  quote.get("destination") or "",
                "linked_itinerary_id":  quote.get("itinerary_id"),
                # Preserve full original quote data for auditability
                "migrated_from_quote_id": str(quote.get("_id", "")) or quote.get("id", ""),
                "original_quote_data":  {
                    k: v for k, v in quote.items()
                    if k not in ("_id", "items")
                },
                "created_at":           quote.get("created_at") or now,
                "updated_at":           now,
            }
            await db.trips.insert_one(trip_doc)
            report["migrated_quotes"] += 1

            # Convert each quote item → trip_component
            sort_order = 0
            for item in quote.get("items", []):
                try:
                    cat         = item.get("category", "misc")
                    comp_type   = _QUOTE_ITEM_TYPE_MAP.get(cat, "misc")
                    item_id     = item.get("id") or str(uuid.uuid4())
                    net_cost    = float(item.get("unit_price", 0)) * float(item.get("qty", 1))
                    fx          = float(item.get("roe_to_base", 1.0))
                    sell_price  = round(net_cost * fx, 2)

                    # Build details_json preserving all item-specific fields
                    details = {
                        k: v for k, v in item.items()
                        if k not in (
                            "id", "category", "title", "description",
                            "qty", "unit_price", "currency", "roe_to_base",
                        ) and v is not None
                    }

                    comp_doc = {
                        "id":                   str(uuid.uuid4()),
                        "trip_id":              new_trip_id,
                        "type":                 comp_type,
                        "title":                item.get("title") or item.get("description") or cat,
                        "place_id":             None,
                        "latitude":             None,
                        "longitude":            None,
                        "start_datetime":       item.get("flight_date") or item.get("check_in"),
                        "end_datetime":         item.get("check_out"),
                        "nights":               item.get("nights"),
                        "day_index":            None,
                        "sort_order":           sort_order,
                        "status":               "draft",
                        "supplier_name":        item.get("airline") or item.get("hotel_name"),
                        "reference_no":         item.get("pnr") or item.get("conf_no"),
                        "pax_count":            item.get("no_adults") or int(quote.get("pax_adults", 1)),
                        "net_cost":             net_cost,
                        "net_currency":         item.get("currency", "INR"),
                        "fx_rate":              fx,
                        "markup_type":          quote.get("markup_type", "percentage"),
                        "markup_value":         float(quote.get("markup_value", 0)),
                        "sell_price":           sell_price,
                        "sell_currency":        quote.get("base_currency", "INR"),
                        "details_json":         details,
                        "source_quote_item_id": item_id,
                        "from_quote_version":   1,
                        "created_by":           "migration",
                        "created_at":           now,
                        "updated_at":           now,
                    }
                    await db.trip_components.insert_one(comp_doc)
                    report["migrated_quote_items"] += 1
                    sort_order += 1
                except Exception as exc:
                    report["errors"].append(f"quote_item in {quote_no}: {exc}")

        except Exception as exc:
            report["errors"].append(f"quote {quote.get('quote_no','?')}: {exc}")

    # ── 3. trip_legs → trip_components ────────────────────────────────────────
    async for leg in db.trip_legs.find({}):
        try:
            leg_id = leg.get("id", "")
            if await db.trip_components.find_one({"source_leg_id": leg_id}):
                report["skipped_legs"] += 1
                continue
            mode      = leg.get("mode", "flight")
            comp_type = mode if mode in COMPONENT_TYPES else "flight"
            from_stop = leg.get("from_stop_name") or leg.get("from_stop_id") or ""
            to_stop   = leg.get("to_stop_name")   or leg.get("to_stop_id")   or ""
            title     = f"{from_stop} → {to_stop}" if from_stop and to_stop else (leg.get("operator") or mode)
            cost      = float(leg.get("cost") or 0)
            currency  = leg.get("currency") or "INR"
            comp_doc = {
                "id":               str(uuid.uuid4()),
                "trip_id":          leg.get("trip_id", ""),
                "type":             comp_type,
                "title":            title,
                "place_id":         None,
                "latitude":         None,
                "longitude":        None,
                "start_datetime":   leg.get("departure_date") or leg.get("date"),
                "end_datetime":     None,
                "nights":           None,
                "day_index":        None,
                "sort_order":       leg.get("sort_order", 0),
                "status":           "draft",
                "supplier_name":    leg.get("operator"),
                "reference_no":     leg.get("reference_no") or leg.get("pnr"),
                "pax_count":        None,
                "net_cost":         cost,
                "net_currency":     currency,
                "fx_rate":          1.0,
                "markup_type":      "percentage",
                "markup_value":     0.0,
                "sell_price":       cost,
                "sell_currency":    currency,
                "details_json": {
                    "from_stop_id":    leg.get("from_stop_id"),
                    "to_stop_id":      leg.get("to_stop_id"),
                    "from_stop_name":  leg.get("from_stop_name"),
                    "to_stop_name":    leg.get("to_stop_name"),
                    "operator":        leg.get("operator"),
                    "cancellation_policy": leg.get("cancellation_policy"),
                    "notes":           leg.get("notes"),
                },
                "source_leg_id":    leg_id,
                "source_stay_id":   None,
                "source_quote_item_id": None,
                "from_quote_version": None,
                "created_by":       "migration",
                "created_at":       leg.get("created_at") or now,
                "updated_at":       now,
            }
            await db.trip_components.insert_one(comp_doc)
            report["migrated_legs"] += 1
        except Exception as exc:
            report["errors"].append(f"leg {leg.get('id','?')}: {exc}")

    # ── 4. trip_stays → trip_components ───────────────────────────────────────
    async for stay in db.trip_stays.find({}):
        try:
            stay_id = stay.get("id", "")
            if await db.trip_components.find_one({"source_stay_id": stay_id}):
                report["skipped_stays"] += 1
                continue
            cost     = float(stay.get("cost") or 0)
            currency = stay.get("currency") or "INR"
            comp_doc = {
                "id":               str(uuid.uuid4()),
                "trip_id":          stay.get("trip_id", ""),
                "type":             "stay",
                "title":            stay.get("hotel_name") or "Accommodation",
                "place_id":         None,
                "latitude":         None,
                "longitude":        None,
                "start_datetime":   stay.get("check_in"),
                "end_datetime":     stay.get("check_out"),
                "nights":           stay.get("nights"),
                "day_index":        None,
                "sort_order":       0,
                "status":           "draft",
                "supplier_name":    stay.get("hotel_name"),
                "reference_no":     stay.get("confirmation_no") or stay.get("reference_no"),
                "pax_count":        stay.get("rooms"),
                "net_cost":         cost,
                "net_currency":     currency,
                "fx_rate":          1.0,
                "markup_type":      "percentage",
                "markup_value":     0.0,
                "sell_price":       cost,
                "sell_currency":    currency,
                "details_json": {
                    "stop_id":             stay.get("stop_id"),
                    "hotel_name":          stay.get("hotel_name"),
                    "stars":               stay.get("stars"),
                    "room_type":           stay.get("room_type"),
                    "meal_plan":           stay.get("meal_plan"),
                    "board_basis":         stay.get("board_basis"),
                    "cancellation_policy": stay.get("cancellation_policy"),
                    "notes":               stay.get("notes"),
                },
                "source_leg_id":    None,
                "source_stay_id":   stay_id,
                "source_quote_item_id": None,
                "from_quote_version": None,
                "created_by":       "migration",
                "created_at":       stay.get("created_at") or now,
                "updated_at":       now,
            }
            await db.trip_components.insert_one(comp_doc)
            report["migrated_stays"] += 1
        except Exception as exc:
            report["errors"].append(f"stay {stay.get('id','?')}: {exc}")

    # ── 5. Seed tax_profiles ───────────────────────────────────────────────────
    if await db.tax_profiles.count_documents({}) == 0:
        defaults = [
            {
                "id":          str(uuid.uuid4()),
                "label":       "GST",
                "rate":        5.0,
                "applies_to":  "all",
                "is_enabled":  True,
                "description": "Goods and Services Tax",
                "created_at":  now,
                "updated_at":  now,
            },
            {
                "id":          str(uuid.uuid4()),
                "label":       "TCS",
                "rate":        5.0,
                "applies_to":  "international",
                "is_enabled":  False,
                "description": "Tax Collected at Source (international tours)",
                "created_at":  now,
                "updated_at":  now,
            },
        ]
        await db.tax_profiles.insert_many(defaults)
        report["seeded_tax_profiles"] = len(defaults)

    # ── 6. Seed quote_terms_template ──────────────────────────────────────────
    existing_terms = await db.quote_terms_template.find_one({"_id_key": "default"})
    if not existing_terms:
        await db.quote_terms_template.insert_one({
            "_id_key": "default",
            "inclusions": [
                "Return international airfare (economy class)",
                "Airport transfers as per itinerary",
                "Hotel accommodation with daily breakfast",
                "Sightseeing as mentioned in itinerary",
                "Services of English-speaking tour manager",
                "Travel insurance",
            ],
            "exclusions": [
                "Visa fees and processing charges",
                "Personal expenses and tips",
                "Optional excursions not mentioned in itinerary",
                "Meals not mentioned in itinerary",
                "Anything not specifically mentioned under inclusions",
            ],
            "terms_and_conditions": (
                "1. Prices are per person on twin sharing basis unless specified.\n"
                "2. Rates are subject to availability at time of confirmation.\n"
                "3. A non-refundable deposit of 25% is required at time of booking.\n"
                "4. Balance payment is due 30 days prior to departure.\n"
                "5. Cancellation charges apply as per supplier policy.\n"
                "6. BDV acts as an agent for airlines, hotels, and other service providers.\n"
                "7. All disputes are subject to Mumbai jurisdiction."
            ),
            "validity_days": 7,
            "updated_at": now,
        })
        report["seeded_quote_terms"] = True

    report["finished_at"] = datetime.now(timezone.utc).isoformat()
    return report


app.include_router(api_router)

# ── Serve uploaded files as static (/api/uploads/...)  ─────────────────────
app.mount("/api/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def seed_protected_admins():
    """Ensure the 4 protected admin accounts always exist."""
    seeds = [
        {"name": "Dolly Doshi",  "role": "admin", "initials": "DD", "avatar_color": "#b76e79"},
        {"name": "Isha Doshi",   "role": "admin", "initials": "ID", "avatar_color": "#4aa3ff"},
        {"name": "Neel Doshi",   "role": "admin", "initials": "ND", "avatar_color": "#27ae60"},
    ]
    for seed in seeds:
        existing = await db.staff.find_one({"name": {"$regex": f"^{seed['name']}$", "$options": "i"}})
        if not existing:
            new_staff = {
                "id": str(uuid.uuid4()),
                "name": seed["name"],
                "role": seed["role"],
                "initials": seed["initials"],
                "avatar_color": seed["avatar_color"],
                "pin_hash": pwd_context.hash("0000"),
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "is_protected": True,
            }
            await db.staff.insert_one(new_staff)
            logger.info(f"Seeded protected admin: {seed['name']}")
    # Also mark Yash as protected if not already
    await db.staff.update_many(
        {"name": {"$regex": "^(Yash Doshi|Dolly Doshi|Isha Doshi|Neel Doshi)$", "$options": "i"}},
        {"$set": {"is_protected": True}}
    )



@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
