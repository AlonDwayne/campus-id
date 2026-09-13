import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    DATABASE_URL = os.getenv("DATABASE_URL")
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://127.0.0.1:5000")

    SMTP_HOST = os.getenv("SMTP_HOST")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME = os.getenv("SMTP_USERNAME")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
    SMTP_FROM = os.getenv("SMTP_FROM") or os.getenv("SMTP_USERNAME")

    TOKEN_HOURS = 24
    SESSION_HOURS = 12

    VERIFYNOW_API = os.getenv("VERIFYNOW_API", "https://www.verifynow.co.za/api/external")
    VERIFYNOW_API_KEY = os.getenv("VERIFYNOW_API_KEY")
    VERIFYNOW_MODE = os.getenv("VERIFYNOW_MODE", "sandbox")
    VERIFYNOW_AUTO_APPROVE_MIN = int(os.getenv("VERIFYNOW_AUTO_APPROVE_MIN", "80"))
    VERIFYNOW_MANUAL_REVIEW_MIN = int(os.getenv("VERIFYNOW_MANUAL_REVIEW_MIN", "40"))

    ELIGIBLE_SHEET_CSV_URL = os.getenv("ELIGIBLE_SHEET_CSV_URL")
    ELIGIBLE_SHEET_CACHE_SECONDS = int(os.getenv("ELIGIBLE_SHEET_CACHE_SECONDS", "300"))
    ELIGIBLE_SHEET_ENABLED = os.getenv("ELIGIBLE_SHEET_ENABLED", "true").lower() == "true"