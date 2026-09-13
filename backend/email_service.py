import smtplib
from email.message import EmailMessage

from .config import Config


def _smtp_configured():
    return all([
        Config.SMTP_HOST,
        Config.SMTP_USERNAME,
        Config.SMTP_PASSWORD,
        Config.SMTP_FROM,
    ])


def send_email(to_email, subject, body):
    if not _smtp_configured():
        print(
            f"\n--- EMAIL (dev mode) ---\n"
            f"To: {to_email}\n"
            f"Subject: {subject}\n\n"
            f"{body}\n"
            f"--- END EMAIL ---\n"
        )
        return

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = Config.SMTP_FROM
    message["To"] = to_email
    message.set_content(body)

    with smtplib.SMTP(Config.SMTP_HOST, Config.SMTP_PORT, timeout=15) as server:
        server.starttls()
        server.login(Config.SMTP_USERNAME, Config.SMTP_PASSWORD)
        server.send_message(message)


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