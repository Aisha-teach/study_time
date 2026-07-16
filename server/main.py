"""
server/main.py

Дополнено логикой мониторинга температуры/шума/освещения из Telegram-канала.
Существующие app, CORS и /api/ping оставлены без изменений.
"""

import re
import sqlite3
from datetime import datetime, date, time as dtime
from typing import Optional

from fastapi import FastAPI, Request, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

origins = [
    "http://localhost:5173",              # Vite dev server
    "https://your-app.vercel.app",         # production frontend
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/ping")
def ping():
    return {"message": "pong"}


# ---------------------------------------------------------------------------
# База данных (SQLite)
# ---------------------------------------------------------------------------

DB_PATH = "temperature.db"  # на Railway с Volume поменяешь на "/data/temperature.db"


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            location TEXT NOT NULL,          -- 'atrium' или 'outside'
            temperature REAL,
            brightness TEXT,                 -- только для atrium
            noise_db REAL,                   -- только для atrium
            created_at TEXT NOT NULL         -- ISO 8601, UTC
        )
    """)
    conn.commit()
    conn.close()


def save_reading(location: str, temperature: float,
                  brightness: Optional[str] = None,
                  noise_db: Optional[float] = None,
                  created_at: Optional[str] = None):
    conn = get_conn()
    conn.execute(
        """INSERT INTO readings (location, temperature, brightness, noise_db, created_at)
           VALUES (?, ?, ?, ?, ?)""",
        (location, temperature, brightness, noise_db,
         created_at or datetime.utcnow().isoformat())
    )
    conn.commit()
    conn.close()


@app.on_event("startup")
async def on_startup():
    init_db()


# ---------------------------------------------------------------------------
# Парсинг сообщений из Telegram
# ---------------------------------------------------------------------------
# "🌆 Outside NU: 🌡 31.4°C"
# "🏫 Atrium: 🌡 30.19ºC  💡 Very bright  🔉 Mild noise"

NOISE_LEVEL_MAP = {
    "quiet": 35,        # < 40 dB -> Тихо
    "mild noise": 45,   # 40-55 dB -> Оптимально
    "noisy": 65,         # > 55 dB -> Громко
}


def parse_message(text: str) -> Optional[dict]:
    temp_match = re.search(r'🌡\s*([-+]?\d+\.?\d*)', text)
    if not temp_match:
        return None
    temperature = float(temp_match.group(1))

    if "outside" in text.lower():
        return {"location": "outside", "temperature": temperature}

    if "atrium" in text.lower():
        result = {"location": "atrium", "temperature": temperature}

        brightness_match = re.search(r'💡\s*([A-Za-z]+(?:\s[A-Za-z]+)?)', text)
        if brightness_match:
            result["brightness"] = brightness_match.group(1).strip()

        noise_match = re.search(r'🔉\s*([A-Za-z]+(?:\s[A-Za-z]+)?)', text)
        if noise_match:
            noise_label = noise_match.group(1).strip().lower()
            result["noise_db"] = NOISE_LEVEL_MAP.get(noise_label)

        return result

    return None


# ---------------------------------------------------------------------------
# Статусы (лейблы для фронта)
# ---------------------------------------------------------------------------

def temp_status(location: str, temp: Optional[float]) -> dict:
    if temp is None:
        return {"label": "Нет данных", "comment": ""}
    if location == "atrium":
        if temp < 18:
            return {"label": "Холодно", "comment": ""}
        elif temp <= 24:
            return {"label": "Комфортно", "comment": "Оптимальная температура"}
        else:
            return {"label": "Жарко", "comment": ""}
    else:
        if temp < 10:
            return {"label": "Холодно", "comment": ""}
        elif temp <= 24:
            return {"label": "Комфортно", "comment": ""}
        else:
            return {"label": "Жарко", "comment": "Рекомендуется пить больше воды"}


def noise_status(noise_db: Optional[float]) -> dict:
    if noise_db is None:
        return {"label": "Нет данных", "comment": ""}
    if noise_db < 40:
        return {"label": "Тихо", "comment": "Комфортный уровень шума"}
    elif noise_db <= 55:
        return {"label": "Оптимально", "comment": "Комфортный уровень шума"}
    else:
        return {"label": "Громко", "comment": "Некомфортный уровень шума"}


def light_status(brightness: Optional[str]) -> dict:
    if not brightness:
        return {"label": "Нет данных", "comment": ""}
    label_map = {
        "dark": "Темно",
        "dim": "Приглушённый свет",
        "normal brightness": "Нормальное освещение",
        "bright": "Хорошее освещение",
        "very bright": "Хорошее освещение",
    }
    key = brightness.lower()
    label = label_map.get(key, brightness)
    comment = "Оптимальный уровень" if key in ("normal brightness", "bright", "very bright") else ""
    return {"label": label, "comment": comment}


def build_response(row: Optional[sqlite3.Row], location: str) -> dict:
    if row is None:
        return {
            "location": location,
            "temperature": None,
            "temp_status": temp_status(location, None),
            "brightness": None,
            "light_status": light_status(None) if location == "atrium" else None,
            "noise_db": None,
            "noise_status": noise_status(None) if location == "atrium" else None,
            "updated_at": None,
        }

    data = {
        "location": location,
        "temperature": row["temperature"],
        "temp_status": temp_status(location, row["temperature"]),
        "updated_at": row["created_at"],
    }

    if location == "atrium":
        data["brightness"] = row["brightness"]
        data["light_status"] = light_status(row["brightness"])
        data["noise_db"] = row["noise_db"]
        data["noise_status"] = noise_status(row["noise_db"])
    else:
        data["brightness"] = None
        data["light_status"] = None
        data["noise_db"] = None
        data["noise_status"] = None

    return data


# ---------------------------------------------------------------------------
# Webhook — сюда стучится Telegram
# ---------------------------------------------------------------------------

@app.post("/telegram-webhook")
async def telegram_webhook(request: Request):
    data = await request.json()
    post = data.get("channel_post") or data.get("message")
    if not post:
        return {"ok": True}

    text = post.get("text", "")
    parsed = parse_message(text)
    if parsed:
        created_at = datetime.utcfromtimestamp(post["date"]).isoformat()
        save_reading(
            location=parsed["location"],
            temperature=parsed["temperature"],
            brightness=parsed.get("brightness"),
            noise_db=parsed.get("noise_db"),
            created_at=created_at,
        )

    return {"ok": True}


# ---------------------------------------------------------------------------
# REST API для фронта
# ---------------------------------------------------------------------------

@app.get("/api/latest")
async def get_latest(location: str = Query(..., pattern="^(atrium|outside)$")):
    conn = get_conn()
    row = conn.execute(
        "SELECT * FROM readings WHERE location = ? ORDER BY created_at DESC LIMIT 1",
        (location,)
    ).fetchone()
    conn.close()
    return build_response(row, location)


@app.get("/api/reading")
async def get_reading_at(
    location: str = Query(..., pattern="^(atrium|outside)$"),
    date_: date = Query(..., alias="date"),
    time_: dtime = Query(..., alias="time"),
):
    target = datetime.combine(date_, time_).isoformat()
    conn = get_conn()
    row = conn.execute(
        """SELECT * FROM readings
           WHERE location = ? AND created_at <= ?
           ORDER BY created_at DESC LIMIT 1""",
        (location, target)
    ).fetchone()
    conn.close()
    return build_response(row, location)


@app.get("/api/history")
async def get_history(
    location: str = Query(..., pattern="^(atrium|outside)$"),
    date_: date = Query(..., alias="date"),
):
    start = datetime.combine(date_, dtime.min).isoformat()
    end = datetime.combine(date_, dtime.max).isoformat()
    conn = get_conn()
    rows = conn.execute(
        """SELECT * FROM readings
           WHERE location = ? AND created_at BETWEEN ? AND ?
           ORDER BY created_at ASC""",
        (location, start, end)
    ).fetchall()
    conn.close()
    return [build_response(row, location) for row in rows]