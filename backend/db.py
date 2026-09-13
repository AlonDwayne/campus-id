import psycopg2
from psycopg2.extras import RealDictCursor

from .config import Config


def get_db():
    if not Config.DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not configured.")
    return psycopg2.connect(Config.DATABASE_URL)


def init_db():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS eligible_students (
                    student_number VARCHAR(30) PRIMARY KEY,
                    full_name VARCHAR(150) NOT NULL,
                    campus VARCHAR(30) NOT NULL
                        CHECK (campus IN ('Kwadlangenzwa', 'Richards Bay'))
                );

                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    student_number VARCHAR(30) UNIQUE NOT NULL
                        REFERENCES eligible_students(student_number),
                    full_name VARCHAR(150) NOT NULL,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    campus VARCHAR(30) NOT NULL
                        CHECK (campus IN ('Kwadlangenzwa', 'Richards Bay')),
                    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
                    verification_token TEXT,
                    verification_expires TIMESTAMPTZ,
                    reset_token TEXT,
                    reset_expires TIMESTAMPTZ,
                    popia_consent BOOLEAN NOT NULL DEFAULT FALSE,
                    popia_consent_at TIMESTAMPTZ,
                    popia_consent_version VARCHAR(20),
                    stays_on_campus BOOLEAN NOT NULL DEFAULT FALSE,
                    pathway SMALLINT DEFAULT NULL,
                    verification_status VARCHAR(30) NOT NULL DEFAULT 'unverified',
                    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
                    suspended BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS sessions (
                    token TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    expires_at TIMESTAMPTZ NOT NULL
                );

                CREATE TABLE IF NOT EXISTS documents (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    doc_type VARCHAR(30) NOT NULL
                        CHECK (doc_type IN ('id', 'registration', 'residence')),
                    filename VARCHAR(255) NOT NULL,
                    mime_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
                    size_bytes INTEGER NOT NULL,
                    content BYTEA NOT NULL,
                    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    UNIQUE (user_id, doc_type)
                );

                CREATE TABLE IF NOT EXISTS verifications (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    provider VARCHAR(30) NOT NULL DEFAULT 'verifynow',
                    provider_txn_id VARCHAR(100),
                    status VARCHAR(30) NOT NULL,
                    confidence INTEGER,
                    warnings JSONB,
                    raw_response JSONB,
                    reviewed_by INTEGER REFERENCES users(id),
                    reviewed_at TIMESTAMPTZ,
                    admin_decision VARCHAR(20),
                    admin_notes TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );

                CREATE INDEX IF NOT EXISTS idx_verifications_status
                    ON verifications (status, created_at DESC);

                CREATE TABLE IF NOT EXISTS admin_audit_log (
                    id SERIAL PRIMARY KEY,
                    admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    admin_student_number VARCHAR(30),
                    action VARCHAR(40) NOT NULL,
                    target_user_id INTEGER,
                    target_student_number VARCHAR(30),
                    target_full_name VARCHAR(150),
                    reason TEXT,
                    metadata JSONB,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );

                CREATE INDEX IF NOT EXISTS idx_admin_audit_created
                    ON admin_audit_log (created_at DESC);
            """)

            cur.execute("""
                ALTER TABLE users
                    ADD COLUMN IF NOT EXISTS popia_consent BOOLEAN NOT NULL DEFAULT FALSE,
                    ADD COLUMN IF NOT EXISTS popia_consent_at TIMESTAMPTZ,
                    ADD COLUMN IF NOT EXISTS popia_consent_version VARCHAR(20),
                    ADD COLUMN IF NOT EXISTS stays_on_campus BOOLEAN NOT NULL DEFAULT FALSE,
                    ADD COLUMN IF NOT EXISTS pathway SMALLINT DEFAULT NULL,
                    ADD COLUMN IF NOT EXISTS verification_status VARCHAR(30) NOT NULL DEFAULT 'unverified',
                    ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE,
                    ADD COLUMN IF NOT EXISTS suspended BOOLEAN NOT NULL DEFAULT FALSE;
            """)

            students = [
                ("202600001", "Student One",   "Kwadlangenzwa"),
                ("202600002", "Student Two",   "Kwadlangenzwa"),
                ("202600003", "Student Three", "Kwadlangenzwa"),
                ("202600004", "Student Four",  "Kwadlangenzwa"),
                ("202600005", "Student Five",  "Kwadlangenzwa"),
                ("202600006", "Student Six",   "Richards Bay"),
                ("202600007", "Student Seven", "Richards Bay"),
                ("202600008", "Student Eight", "Richards Bay"),
                ("202600009", "Student Nine",  "Richards Bay"),
                ("202600010", "Student Ten",   "Richards Bay"),
            ]
            cur.executemany("""
                INSERT INTO eligible_students (student_number, full_name, campus)
                VALUES (%s, %s, %s)
                ON CONFLICT (student_number) DO NOTHING
            """, students)
        conn.commit()


__all__ = ["get_db", "init_db", "RealDictCursor"]