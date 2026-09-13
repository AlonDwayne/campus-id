import secrets
from datetime import datetime, timedelta, timezone

from flask import request

from .config import Config


def create_session(cur, user_id):
    token = secrets.token_urlsafe(48)
    expires = datetime.now(timezone.utc) + timedelta(hours=Config.SESSION_HOURS)
    cur.execute("""
        INSERT INTO sessions (token, user_id, expires_at)
        VALUES (%s, %s, %s)
    """, (token, user_id, expires))
    return token


def current_user(cur):
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    token = header[7:].strip()
    if not token:
        return None

    cur.execute("""
        SELECT u.id, u.student_number, u.full_name, u.email, u.campus,
               u.is_verified, u.popia_consent, u.created_at,
               u.stays_on_campus, u.pathway, u.verification_status, u.is_admin
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token = %s AND s.expires_at > NOW()
    """, (token,))
    return cur.fetchone()