"""
Email delivery for Campus_ID.

Three delivery modes, tried in this order:

1. Resend HTTP API (recommended for Render's free tier, which blocks
   outbound SMTP on ports 25, 465, and 587).
2. SMTP on port 2525 (Render allows this port even on the free tier,
   but most consumer mail providers do not listen on it).
3. Console printing, used in dev when no credentials are configured.

Set RESEND_API_KEY to enable Resend. Otherwise, set the SMTP_* variables.
"""

import os
import smtplib
from email.message import EmailMessage

import requests

from .config import Config


# ============================================================
# Delivery
# ============================================================

def _resend_configured():
    return bool(os.getenv("RESEND_API_KEY"))


def _smtp_configured():
    return all([
        Config.SMTP_HOST,
        Config.SMTP_USERNAME,
        Config.SMTP_PASSWORD,
        Config.SMTP_FROM,
    ])


def _send_via_resend(to_email, subject, body):
    resp = requests.post(
        "https://api.resend.com/emails",
        headers={
            "Authorization": f"Bearer {os.getenv('RESEND_API_KEY')}",
            "Content-Type": "application/json",
        },
        json={
            "from": Config.SMTP_FROM or "onboarding@resend.dev",
            "to": [to_email],
            "subject": subject,
            "text": body,
        },
        timeout=15,
    )
    if not resp.ok:
        raise RuntimeError(f"Resend error {resp.status_code}: {resp.text}")
    return resp.json()


def _send_via_smtp(to_email, subject, body):
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = Config.SMTP_FROM
    message["To"] = to_email
    message.set_content(body)

    with smtplib.SMTP(Config.SMTP_HOST, Config.SMTP_PORT, timeout=20) as server:
        server.starttls()
        server.login(Config.SMTP_USERNAME, Config.SMTP_PASSWORD)
        server.send_message(message)


def _print_to_console(to_email, subject, body):
    print(
        f"\n--- EMAIL (dev mode) ---\n"
        f"To: {to_email}\n"
        f"Subject: {subject}\n\n"
        f"{body}\n"
        f"--- END EMAIL ---\n"
    )


def send_email(to_email, subject, body):
    """Send an email using the first available delivery method."""
    if _resend_configured():
        return _send_via_resend(to_email, subject, body)

    if _smtp_configured():
        return _send_via_smtp(to_email, subject, body)

    return _print_to_console(to_email, subject, body)


def smtp_status():
    """Returns a dict describing the current email configuration."""
    return {
        "resend_configured": _resend_configured(),
        "smtp_configured": _smtp_configured(),
        "smtp_host": Config.SMTP_HOST or None,
        "smtp_port": Config.SMTP_PORT,
        "smtp_username_set": bool(Config.SMTP_USERNAME),
        "smtp_from": Config.SMTP_FROM or None,
        "frontend_url": Config.FRONTEND_URL,
        "active_mode": (
            "resend" if _resend_configured()
            else "smtp" if _smtp_configured()
            else "console"
        ),
    }


# ============================================================
# Templates
# ============================================================

def send_verification_email(email, full_name, link):
    body = f"""Hello {full_name},

Thank you for creating your student account.

Please verify your email address by opening this link:

{link}

This verification link expires in 24 hours.

If you did not create this account, you can ignore this email.
"""
    send_email(email, "Verify your student account", body)


def send_password_reset_email(email, full_name, link):
    body = f"""Hello {full_name},

A password reset was requested for your student account.

Use the following link to create a new password:

{link}

This link expires in 1 hour.

If you did not request this, you can ignore this email.
"""
    send_email(email, "Reset your student account password", body)


def send_booking_confirmation_email(
    email, full_name, service_label, campus,
    date_str, time_slot, queue_no, ref_code, pathway,
):
    if pathway == 1:
        what_to_bring = """What to bring on the day:
  - A valid ID (SA ID, smart ID card, or passport)
  - Your student number
  - This reference code"""
        extra = ("Your card has already been printed and is waiting for "
                 "collection. Please arrive within your booked hour.")
    else:
        what_to_bring = """What to bring on the day:
  - Your physical SA ID (smart ID card or passport)
  - Your student number
  - This reference code"""
        extra = ("Staff will verify your ID in person and take your photo "
                 "on the spot before producing your card. Please arrive at "
                 "least 10 minutes before your session starts.")

    body = f"""Hello {full_name},

Your student card booking is confirmed.

------------------------------------------
Service     : {service_label}
Campus      : {campus}
Date        : {date_str}
Time slot   : {time_slot}
Queue no.   : {queue_no}
Reference   : {ref_code}
------------------------------------------

{what_to_bring}

{extra}

If you miss your slot, you may need to rebook for another day.

If you did not make this booking, please ignore this email.

Regards,
University of Zululand — Card Services
"""
    send_email(email, "Your student card booking is confirmed", body)


def send_verification_pending_email(email, full_name):
    body = f"""Hello {full_name},

Thank you — we have received your identity verification.

Because our automated check could not confirm your identity with full
confidence, your case has been passed to a member of the Card Services
team for manual review. You do not need to do anything right now.

We aim to complete manual reviews within 1 business day, and you will
receive an email as soon as a decision is made.

If you have any questions, contact the Information Officer at
information.officer@unizulu.ac.za.

Regards,
University of Zululand — Card Services
"""
    send_email(email, "Your identity check is under review", body)


def send_verification_decision_email(email, full_name, approved, notes=""):
    if approved:
        subject = "Your identity is verified"
        body = f"""Hello {full_name},

Good news — your identity has been verified by our Card Services team.

You can now continue with your card booking in the UniZulu Card Services
app.

Regards,
University of Zululand — Card Services
"""
    else:
        subject = "We could not verify your identity"
        reason = f"\nReason: {notes}\n" if notes else ""
        body = f"""Hello {full_name},

Unfortunately our Card Services team could not verify your identity from
the documents and selfie you submitted.{reason}

You may re-submit your verification, or contact the Information Officer
at information.officer@unizulu.ac.za if you believe this is in error.

Regards,
University of Zululand — Card Services
"""
    send_email(email, subject, body)
