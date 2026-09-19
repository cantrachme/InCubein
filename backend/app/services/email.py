import os
import base64
import re
import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from email.mime.application import MIMEApplication
from typing import Optional, List

from ..core import config
from ..core.database import get_db_connection
from ..schemas.email import MouSendRequest, ContactSendRequest


def _format_email_text(body_text: str) -> str:
    """Convert template Markdown-like markers into clean plain-text email."""
    lines = []
    for raw_line in body_text.replace("\r\n", "\n").split("\n"):
        line = raw_line.strip()
        if not line or re.fullmatch(r"[-_=]{3,}", line):
            if lines and lines[-1] != "":
                lines.append("")
            continue
        line = re.sub(r"^\s*[*-]\s+", "• ", line)
        line = re.sub(r"\*\*(.*?)\*\*", r"\1", line)
        line = re.sub(r"(?<!\w)__(.*?)__(?!\w)", r"\1", line)
        lines.append(line)
    return "\n".join(lines).strip()


def get_smtp_config(account: Optional[str] = None) -> dict:
    if account and account.strip() not in ("", "default"):
        suffix = account.strip()
        smtp_host = os.environ.get(f"SMTP_HOST{suffix}")
        smtp_port = os.environ.get(f"SMTP_PORT{suffix}", "587")
        smtp_user = os.environ.get(f"SMTP_USER{suffix}")
        smtp_pass = os.environ.get(f"SMTP_PASS{suffix}")
        sender_email = os.environ.get(f"SENDER_EMAIL{suffix}") or smtp_user
    else:
        smtp_host = os.environ.get("SMTP_HOST")
        smtp_port = os.environ.get("SMTP_PORT", "587")
        smtp_user = os.environ.get("SMTP_USER")
        smtp_pass = os.environ.get("SMTP_PASS")
        sender_email = os.environ.get("SENDER_EMAIL") or smtp_user

    if smtp_user:
        smtp_user = smtp_user.strip().strip('"').strip("'")
    if smtp_pass:
        smtp_pass = smtp_pass.strip().strip('"').strip("'")
    if sender_email:
        sender_email = sender_email.strip().strip('"').strip("'")

    is_smtp_ready = bool(smtp_host and smtp_user and smtp_pass and "your_email" not in (smtp_user or ""))

    return {
        "smtp_host": smtp_host,
        "smtp_port": smtp_port,
        "smtp_user": smtp_user,
        "smtp_pass": smtp_pass,
        "sender_email": sender_email or "no-reply@incubein.com",
        "is_smtp_ready": is_smtp_ready,
    }


def _is_smtp_ready(cfg: dict) -> bool:
    return (
        cfg.get("smtp_host") and cfg.get("smtp_user") and cfg.get("smtp_pass")
        and "your_email" not in (cfg.get("smtp_user") or "")
        and "your_app_password" not in (cfg.get("smtp_pass") or "")
    )


def send_smtp_message(smtp_cfg: dict, from_addr: str, recipients, msg):
    host = smtp_cfg["smtp_host"]
    port = int(smtp_cfg["smtp_port"])
    user = smtp_cfg["smtp_user"]
    pwd = smtp_cfg["smtp_pass"]

    if port == 465:
        server = smtplib.SMTP_SSL(host, port, timeout=10)
    else:
        server = smtplib.SMTP(host, port, timeout=10)
        server.starttls()
    server.login(user, pwd)
    server.sendmail(from_addr, recipients, msg.as_string())
    server.quit()


def send_plain_email(smtp_cfg: dict, from_addr: str, recipient_email: str, subject: str, body_text: str, from_display: str = None, cc: str = None, bcc: str = None, attachments: List[dict] = None) -> bool:
    """Builds a plain-text email (optional CC/BCC/attachments) and sends it via SMTP. Returns True on real send."""
    if not smtp_cfg.get("is_smtp_ready"):
        raise RuntimeError("SMTP is not configured. Configure SMTP_HOST, SMTP_USER, and SMTP_PASS before sending email.")
    try:
        msg = MIMEMultipart("mixed")
        msg["Subject"] = subject
        msg["From"] = f"{from_display} <{from_addr}>" if from_display else from_addr
        msg["To"] = recipient_email
        if cc:
            msg["Cc"] = cc
        if bcc:
            msg["Bcc"] = bcc
        msg_alt = MIMEMultipart("alternative")
        msg_alt.attach(MIMEText(_format_email_text(body_text), "plain"))
        msg.attach(msg_alt)
        _attach_files(msg, attachments or [])

        recipients = [recipient_email]
        if cc:
            recipients += [c.strip() for c in cc.split(",") if c.strip()]
        if bcc:
            recipients += [c.strip() for c in bcc.split(",") if c.strip()]
        send_smtp_message(smtp_cfg, from_addr, recipients, msg)
        return True
    except Exception as e:
        print(f"Error sending email via SMTP to {recipient_email}: {e}")
        return False


def _attach_files(msg, attachments: List[dict]):
    """Attaches files to a MIME message. Each item is {'filename': str, 'path': str}."""
    for att in attachments or []:
        try:
            path = att.get("path") or ""
            filename = att.get("filename") or os.path.basename(path)
            if not path or not os.path.exists(path):
                continue
            with open(path, "rb") as f:
                part = MIMEApplication(f.read(), Name=filename)
            part.add_header("Content-Disposition", "attachment", filename=filename)
            msg.attach(part)
        except Exception as e:
            print(f"Error attaching file {att}: {e}")


def send_outreach_single(smtp_cfg: dict, from_addr: str, recipient_email: str, subject: str, body_text: str, cc: str = None, bcc: str = None, attachments: List[dict] = None) -> bool:
    """Builds an outreach email (optional CC/BCC/attachments) and sends it via SMTP. Returns True on real send."""
    if not smtp_cfg.get("is_smtp_ready"):
        raise RuntimeError("SMTP is not configured. Configure SMTP_HOST, SMTP_USER, and SMTP_PASS before sending email.")
    try:
        msg = MIMEMultipart("mixed")
        msg["Subject"] = subject
        msg["From"] = from_addr
        msg["To"] = recipient_email
        if cc:
            msg["Cc"] = cc
        if bcc:
            msg["Bcc"] = bcc
        msg_alt = MIMEMultipart("alternative")
        msg_alt.attach(MIMEText(_format_email_text(body_text), "plain"))
        msg.attach(msg_alt)
        _attach_files(msg, attachments or [])

        recipients = [recipient_email]
        if cc:
            recipients += [c.strip() for c in cc.split(",") if c.strip()]
        if bcc:
            recipients += [c.strip() for c in bcc.split(",") if c.strip()]
        send_smtp_message(smtp_cfg, from_addr, recipients, msg)
        return True
    except Exception as e:
        print(f"Error sending outreach email via SMTP: {e}")
        return False


def resolve_sender_email() -> str:
    sender_email = os.environ.get("SENDER_EMAIL") or os.environ.get("SMTP_USER")

    # Try fetching Nagpur university incubator email from the database if not in env
    if not sender_email or "your_email" in sender_email:
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT email FROM incubators WHERE name LIKE '%Nagpur%' OR name LIKE '%IMN%' LIMIT 1")
            row = cursor.fetchone()
            if row and row["email"]:
                sender_email = row["email"]
            conn.close()
        except Exception:
            pass

    if not sender_email:
        sender_email = "no-reply@incubein.com"
    return sender_email


def _get_smtp_cfg_for_sender() -> dict:
    smtp_host = os.environ.get("SMTP_HOST")
    smtp_port = os.environ.get("SMTP_PORT", "587")
    smtp_user = os.environ.get("SMTP_USER")
    smtp_pass = os.environ.get("SMTP_PASS")
    sender_email = resolve_sender_email()
    return {
        "smtp_host": smtp_host,
        "smtp_port": smtp_port,
        "smtp_user": smtp_user,
        "smtp_pass": smtp_pass,
        "sender_email": sender_email,
        "is_smtp_ready": _is_smtp_ready({
            "smtp_host": smtp_host,
            "smtp_port": smtp_port,
            "smtp_user": smtp_user,
            "smtp_pass": smtp_pass,
        }),
    }


def send_mou_email(req: MouSendRequest) -> dict:
    # 1. Parse signature data URL
    sig_base64 = req.signature_data
    if "," in sig_base64:
        sig_base64 = sig_base64.split(",")[1]

    try:
        sig_bytes = base64.b64decode(sig_base64)
    except Exception as e:
        raise ValueError(f"Invalid Base64 signature image data: {str(e)}")

    smtp_cfg = _get_smtp_cfg_for_sender()
    sender_email = smtp_cfg["sender_email"]

    # Generate HTML content
    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #dddddd; border-radius: 8px;">
        <div style="text-align: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 15px; margin-bottom: 20px;">
          <h2 style="color: #1e3a8a; margin: 0; text-transform: uppercase;">Startup Ecosystem Portal</h2>
          <span style="font-size: 0.85rem; color: #666666;">Government Innovation Intelligence Platform</span>
        </div>

        <p>Dear Stakeholder,</p>
        <p>A new Memorandum of Understanding (MoU) has been digitally signed and executed on the Ecosystem Platform. Below is the full text of the agreement for your records.</p>

        <div style="background-color: #f9f9f9; padding: 25px; border-left: 4px solid #1e3a8a; margin: 20px 0; font-family: Georgia, serif; white-space: pre-wrap; font-size: 0.95rem;">
          <h3 style="text-align: center; color: #1e293b; margin-top: 0; text-transform: uppercase;">{req.mou_title}</h3>
          {req.mou_text}
        </div>

        <div style="margin-top: 30px; border-top: 1px dashed #cccccc; padding-top: 20px; display: table; width: 100%;">
          <div style="display: table-cell; width: 50%; text-align: center; padding: 10px;">
            <div style="font-size: 0.75rem; color: #b45309; border: 1px dashed #b45309; padding: 2px; margin-bottom: 5px; display: inline-block;">PARTY A STAMPED</div>
            <div style="width: 80%; height: 1px; background-color: #bbbbbb; margin: 40px auto 5px auto;"></div>
            <strong style="font-size: 0.85rem;">{req.incubator_name} Representative</strong><br/>
            <span style="font-size: 0.75rem; color: #888888;">Authorized Signatory</span>
          </div>
          <div style="display: table-cell; width: 50%; text-align: center; padding: 10px; vertical-align: bottom;">
            <div style="margin-bottom: 5px;">
              <img src="cid:signature_image" alt="Digital Signature" style="max-height: 50px; max-width: 150px; object-fit: contain;" />
            </div>
            <div style="width: 80%; height: 1px; background-color: #bbbbbb; margin: 5px auto 5px auto;"></div>
            <strong style="font-size: 0.85rem;">{req.party_b_name} Representative</strong><br/>
            <span style="font-size: 0.75rem; color: #888888;">Authorized Signatory</span>
          </div>
        </div>

        <div style="margin-top: 40px; font-size: 0.75rem; color: #999999; text-align: center; border-top: 1px solid #eeeeee; padding-top: 15px;">
          This is an automated ecosystem agreement transmission from the India Startup Ecosystem Intelligence Platform.<br/>
          Location: Ministry of Science & Technology Initiatives, Govt of India.
        </div>
      </body>
    </html>
    """

    is_smtp_ready = smtp_cfg["is_smtp_ready"]

    if is_smtp_ready:
        try:
            msg = MIMEMultipart("related")
            msg["Subject"] = f"Digitally Executed MOU: {req.mou_title}"
            msg["From"] = sender_email
            msg["To"] = req.recipient_email

            msgAlternative = MIMEMultipart("alternative")
            msg.attach(msgAlternative)

            msgText = MIMEText(html_content, "html")
            msgAlternative.attach(msgText)

            msgImage = MIMEImage(sig_bytes, name="signature.png")
            msgImage.add_header("Content-ID", "<signature_image>")
            msgImage.add_header("Content-Disposition", "inline", filename="signature.png")
            msg.attach(msgImage)

            send_smtp_message(smtp_cfg, sender_email, [req.recipient_email], msg)

            return {"status": "success", "message": f"MOU email successfully dispatched to {req.recipient_email}."}
        except Exception as smtp_err:
            raise RuntimeError(f"SMTP Server error: {str(smtp_err)}")
    raise RuntimeError("SMTP is not configured. Configure SMTP_HOST, SMTP_USER, and SMTP_PASS before sending email.")


def send_contact_email(req: ContactSendRequest) -> dict:
    smtp_cfg = _get_smtp_cfg_for_sender()
    sender_email = smtp_cfg["sender_email"]

    datetime_section = ""
    if req.meeting_date or req.meeting_time:
        date_str = req.meeting_date or "N/A"
        time_str = req.meeting_time or "N/A"
        datetime_section = f"""
        <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 15px; margin: 20px 0; color: #92400e;">
          <h4 style="margin: 0 0 8px 0; text-transform: uppercase; font-size: 0.85rem; letter-spacing: 0.5px;">Proposed Meeting Details</h4>
          <strong>Date:</strong> {date_str}<br/>
          <strong>Time:</strong> {time_str}
        </div>
        """

    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #dddddd; border-radius: 8px;">
        <div style="text-align: center; border-bottom: 2px solid #0891b2; padding-bottom: 15px; margin-bottom: 20px;">
          <h2 style="color: #0891b2; margin: 0; text-transform: uppercase;">Startup Ecosystem Portal</h2>
          <span style="font-size: 0.85rem; color: #666666;">Government Innovation Intelligence Platform</span>
        </div>

        <p>Dear {req.incubator_name} Team,</p>
        <p>You have received a new contact inquiry and meeting request via the India Startup Ecosystem Portal.</p>

        {datetime_section}

        <div style="background-color: #f9f9f9; padding: 20px; border-left: 4px solid #0891b2; margin: 20px 0; white-space: pre-wrap; font-size: 0.95rem;">
          {req.message}
        </div>

        <p style="font-size: 0.85rem; color: #555555;">Please respond directly to the sender or follow up via your ecosystem dashboard.</p>

        <div style="margin-top: 40px; font-size: 0.75rem; color: #999999; text-align: center; border-top: 1px solid #eeeeee; padding-top: 15px;">
          This is an automated ecosystem message transmission from the India Startup Ecosystem Intelligence Platform.<br/>
          Location: Ministry of Science & Technology Initiatives, Govt of India.
        </div>
      </body>
    </html>
    """

    is_smtp_ready = smtp_cfg["is_smtp_ready"]

    if is_smtp_ready:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = req.subject
            msg["From"] = sender_email
            msg["To"] = req.recipient_email

            msgText = MIMEText(html_content, "html")
            msg.attach(msgText)

            send_smtp_message(smtp_cfg, sender_email, [req.recipient_email], msg)

            return {"status": "success", "message": f"Contact email successfully sent to {req.incubator_name} at {req.recipient_email}."}
        except Exception as smtp_err:
            raise RuntimeError(f"SMTP Server error: {str(smtp_err)}")
    raise RuntimeError("SMTP is not configured. Configure SMTP_HOST, SMTP_USER, and SMTP_PASS before sending email.")
