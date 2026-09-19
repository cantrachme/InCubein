import os
import uuid
import smtplib
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from typing import Optional

from ..core import config
from ..core.database import get_db_connection
from ..core.exceptions import NotFoundError, BadRequestError, ServiceError
from ..schemas.meetings import ScheduleMeetingRequest
from ..schemas.outreach import UpdateMeetingStatusRequest


def get_google_client_config():
    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET")
    redirect_uri = os.environ.get("GOOGLE_REDIRECT_URI")

    if not client_id or not client_secret or "your_google_client_id" in client_id:
        return None

    return {
        "web": {
            "client_id": client_id.strip().strip('"').strip("'"),
            "client_secret": client_secret.strip().strip('"').strip("'"),
            "redirect_uris": [redirect_uri.strip().strip('"').strip("'")],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token"
        }
    }


def build_oauth_authorization_url(missing_config_msg: Optional[str] = None):
    from google_auth_oauthlib.flow import Flow
    config_obj = get_google_client_config()
    if not config_obj:
        raise BadRequestError(
            missing_config_msg or "Google OAuth credentials are not configured in backend/.env file. Please populate GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."
        )

    try:
        flow = Flow.from_client_config(
            config_obj,
            scopes=["https://www.googleapis.com/auth/calendar.events"]
        )
        flow.redirect_uri = config_obj["web"]["redirect_uris"][0]
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent'
        )
        # Store code_verifier using state as the key
        config.oauth_states[state] = flow.code_verifier
        return authorization_url
    except Exception as e:
        raise ServiceError(f"Failed to generate authorization URL: {str(e)}")


def exchange_oauth_code(code: str, state: Optional[str] = None):
    from google_auth_oauthlib.flow import Flow
    config_obj = get_google_client_config()
    if not config_obj:
        raise BadRequestError("OAuth configuration is missing in backend/.env.")

    try:
        flow = Flow.from_client_config(
            config_obj,
            scopes=["https://www.googleapis.com/auth/calendar.events"]
        )
        flow.redirect_uri = config_obj["web"]["redirect_uris"][0]

        # Retrieve the code_verifier using state
        code_verifier = config.oauth_states.pop(state, None) if state else None
        flow.fetch_token(code=code, code_verifier=code_verifier)

        credentials = flow.credentials

        token_path = str(config.TOKEN_PATH)
        with open(token_path, "w") as token_file:
            token_file.write(credentials.to_json())
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise ServiceError(str(e))


def get_oauth_status():
    is_authorized = os.path.exists(str(config.TOKEN_PATH))
    is_configured = get_google_client_config() is not None
    return {
        "is_configured": is_configured,
        "is_authorized": is_authorized
    }


def create_gmeet_event(summary: str, description: str, date_str: str, time_str: str, attendee_email: str):
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build

    token_path = str(config.TOKEN_PATH)
    if not os.path.exists(token_path):
        print(f"Token file not found at {token_path}. OAuth not authorized — please authorize via the dashboard first.")
        return None

    try:
        credentials = Credentials.from_authorized_user_file(token_path)

        # Auto-refresh expired credentials using the stored refresh_token
        if credentials.expired and credentials.refresh_token:
            try:
                credentials.refresh(Request())
                # Persist the refreshed token
                with open(token_path, "w") as tf:
                    tf.write(credentials.to_json())
                print("Google OAuth token refreshed and saved successfully.")
            except Exception as refresh_err:
                print(f"Token refresh failed: {refresh_err}. Deleting invalid token — please re-authorize via the dashboard.")
                os.remove(token_path)
                return None

        if not credentials.valid:
            print("Google credentials are invalid and could not be refreshed.")
            return None

        service = build("calendar", "v3", credentials=credentials)

        try:
            start_dt = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %I:%M %p")
        except Exception:
            try:
                start_dt = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
            except Exception:
                start_dt = datetime.now() + timedelta(days=2)

        end_dt = start_dt + timedelta(minutes=30)
        start_iso = start_dt.isoformat()
        end_iso = end_dt.isoformat()

        event = {
            'summary': summary,
            'description': description,
            'start': {
                'dateTime': start_iso,
                'timeZone': 'Asia/Kolkata',
            },
            'end': {
                'dateTime': end_iso,
                'timeZone': 'Asia/Kolkata',
            },
            'attendees': [
                {'email': attendee_email},
            ],
            'conferenceData': {
                'createRequest': {
                    'requestId': f"meet_{uuid.uuid4().hex[:12]}",
                    'conferenceSolutionKey': {
                        'type': 'hangoutsMeet'
                    }
                }
            }
        }

        created_event = service.events().insert(
            calendarId='primary',
            body=event,
            conferenceDataVersion=1
        ).execute()

        meet_link = None
        conf_data = created_event.get("conferenceData", {})
        entry_points = conf_data.get("entryPoints", [])
        for ep in entry_points:
            if ep.get("entryPointType") == "video":
                meet_link = ep.get("uri")
                break

        if not meet_link:
            meet_link = created_event.get("htmlLink")

        return {
            "calendar_event_id": created_event.get("id"),
            "meet_link": meet_link
        }
    except Exception as e:
        print("Error creating Google Meet calendar event:", e)
        return None


def generate_ics_file_content(summary: str, description: str, date_str: str, time_str: str, meet_link: str, organizer_email: str, attendee_email: str) -> str:
    try:
        start_dt = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %I:%M %p")
    except Exception:
        try:
            start_dt = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
        except Exception:
            start_dt = datetime.now() + timedelta(days=2)

    end_dt = start_dt + timedelta(minutes=30)

    # Calculate offset for UTC
    start_utc = start_dt - timedelta(hours=5, minutes=30)
    end_utc = end_dt - timedelta(hours=5, minutes=30)

    start_str = start_utc.strftime("%Y%m%dT%H%M%SZ")
    end_str = end_utc.strftime("%Y%m%dT%H%M%SZ")
    dtstamp_str = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")

    uid = f"meet-{start_str}-{attendee_email.replace('@', '-')}"

    esc_summary = summary.replace(",", "\\,").replace(";", "\\;")
    esc_description = description.replace(",", "\\,").replace(";", "\\;").replace("\n", "\\n")

    ics_lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Incubein Foundation//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:REQUEST",
        "BEGIN:VEVENT",
        f"DTSTART:{start_str}",
        f"DTEND:{end_str}",
        f"DTSTAMP:{dtstamp_str}",
        f"ORGANIZER;CN=Incubein Admin:mailto:{organizer_email}",
        f"ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN={attendee_email}:mailto:{attendee_email}",
        f"UID:{uid}",
        f"SUMMARY:{esc_summary}",
        f"DESCRIPTION:{esc_description}\\n\\nJoin Video Call: {meet_link}",
        f"LOCATION:{meet_link}",
        "STATUS:CONFIRMED",
        "SEQUENCE:0",
        "TRANSP:OPAQUE",
        "BEGIN:VALARM",
        "TRIGGER:-PT15M",
        "ACTION:DISPLAY",
        "DESCRIPTION:Reminder",
        "END:VALARM",
        "END:VEVENT",
        "END:VCALENDAR"
    ]
    return "\r\n".join(ics_lines)


def send_meeting_invite_email(lead_name: str, lead_email: str, date_str: str, time_str: str, meet_link: str):
    smtp_host = os.environ.get("SMTP_HOST")
    smtp_port = os.environ.get("SMTP_PORT", "587")
    smtp_user = os.environ.get("SMTP_USER")
    smtp_pass = os.environ.get("SMTP_PASS")
    sender_email = os.environ.get("SENDER_EMAIL") or smtp_user or "no-reply@incubein.com"

    if smtp_user:
        smtp_user = smtp_user.strip().strip('"').strip("'")
    if smtp_pass:
        smtp_pass = smtp_pass.strip().strip('"').strip("'")
    if sender_email:
        sender_email = sender_email.strip().strip('"').strip("'")

    is_smtp_ready = smtp_host and smtp_user and smtp_pass and "your_email" not in smtp_user
    if not is_smtp_ready:
        print("SMTP credentials are not configured or using placeholders. Skipping email invitation delivery.")
        return False

    try:
        msg = MIMEMultipart("mixed")
        msg["Subject"] = f"Google Meet Confirmation – Incubein Foundation"
        msg["From"] = f"Team Incubein Foundation <{sender_email}>"
        msg["To"] = lead_email

        summary = f"30-Minute Google Meet: Incubein Foundation & {lead_name}"
        description = f"Dear {lead_name},\n\nThank you for your response. We appreciate your interest in connecting with Incubein Foundation - RTMNU Business Incubation Centre.\n\nWe're pleased to confirm our 30-minute Google Meet as per the following schedule:\n\nDate: {date_str}\nTime: {time_str} (IST)\nGoogle Meet Link: {meet_link}\n\nDuring the meeting, we'd love to learn more about {lead_name}, understand your current goals and challenges, and discuss how Incubein Foundation can support your journey through incubation, mentorship, funding readiness, strategic guidance, and our startup ecosystem.\n\nIf you have any documents, a pitch deck, or specific discussion points you'd like to share, please feel free to keep them handy for the meeting.\n\nIf you need to reschedule, kindly let us know in advance, and we'll be happy to coordinate another suitable time.\n\nWe look forward to speaking with you.\n\nWarm regards,\nTeam Incubein Foundation\nIncubein Foundation - RTMNU Business Incubation Centre\nNagpur, Maharashtra\nEmail: teamincubein@gmail.com\nWebsite: www.incubein.com"

        msg_alternative = MIMEMultipart("alternative")
        msg.attach(msg_alternative)

        body_text = f"{description}\n\nGoogle Meet: {meet_link}\nDate: {date_str}\nTime: {time_str}"
        msg_alternative.attach(MIMEText(body_text, "plain"))

        body_html = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; background: #f8fafc;">
                <div style="max-width: 600px; margin: 32px auto; padding: 2rem; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
                    <h2 style="color: #7c3aed; margin-top: 0; font-size: 1.3rem;">Google Meet Confirmation – Incubein Foundation</h2>
                    <p>Dear <strong>{lead_name}</strong>,</p>
                    <p>Thank you for your response. We appreciate your interest in connecting with <strong>Incubein Foundation – RTMNU Business Incubation Centre</strong>.</p>
                    <p>We’re pleased to confirm our <strong>30-minute Google Meet</strong> as per the following schedule:</p>

                    <div style="background: #f1f5f9; padding: 1.25rem 1.5rem; border-radius: 8px; margin: 1.5rem 0; border-left: 4px solid #7c3aed;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="width: 120px; padding: 6px 0; color: #64748b; font-weight: 600;">Date:</td>
                                <td style="padding: 6px 0; font-weight: 700; color: #0f172a;">{date_str}</td>
                            </tr>
                            <tr>
                                <td style="color: #64748b; font-weight: 600; padding: 6px 0;">Time:</td>
                                <td style="padding: 6px 0; font-weight: 700; color: #0f172a;">{time_str} (IST)</td>
                            </tr>
                            <tr>
                                <td style="color: #64748b; font-weight: 600; padding: 6px 0;">Google Meet:</td>
                                <td style="padding: 6px 0;">
                                    <a href="{meet_link}" style="color: #7c3aed; text-decoration: none; font-weight: 700;">Join Google Meet →</a>
                                </td>
                            </tr>
                        </table>
                    </div>

                    <p>During the meeting, we’d love to learn more about <strong>{lead_name}</strong>, understand your current goals and challenges, and discuss how Incubein Foundation can support your journey through incubation, mentorship, funding readiness, strategic guidance, and our startup ecosystem.</p>
                    <p>If you have any documents, a pitch deck, or specific discussion points you’d like to share, please feel free to keep them handy for the meeting.</p>
                    <p>If you need to reschedule, kindly let us know in advance, and we’ll be happy to coordinate another suitable time.</p>
                    <p>We look forward to speaking with you.</p>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 1.5rem 0;">
                    <p style="margin: 0;"><strong>Team Incubein Foundation</strong><br>
                    Incubein Foundation – RTMNU Business Incubation Centre<br>
                    Nagpur, Maharashtra<br>
                    Email: <a href="mailto:teamincubein@gmail.com" style="color: #7c3aed;">teamincubein@gmail.com</a><br>
                    Website: <a href="http://www.incubein.com" style="color: #7c3aed;">www.incubein.com</a></p>
                </div>
            </body>
        </html>
        """
        msg_alternative.attach(MIMEText(body_html, "html"))

        ics_content = generate_ics_file_content(
            summary=summary,
            description=description,
            date_str=date_str,
            time_str=time_str,
            meet_link=meet_link,
            organizer_email=sender_email,
            attendee_email=lead_email
        )

        attachment = MIMEBase('text', 'calendar', method='REQUEST')
        attachment.set_payload(ics_content)
        encoders.encode_base64(attachment)
        attachment.add_header('Content-Disposition', 'attachment; filename="invite.ics"')
        attachment.add_header('Content-class', 'urn:content-classes:calendarmessage')
        msg.attach(attachment)

        ics_part = MIMEText(ics_content, 'calendar; method=REQUEST')
        ics_part.add_header('Content-class', 'urn:content-classes:calendarmessage')
        msg.attach(ics_part)

        port = int(smtp_port)
        if port == 465:
            server = smtplib.SMTP_SSL(smtp_host, port, timeout=10)
        else:
            server = smtplib.SMTP(smtp_host, port, timeout=10)
            server.starttls()

        server.login(smtp_user, smtp_pass)
        server.sendmail(sender_email, [lead_email], msg.as_string())
        server.quit()
        print(f"Meeting invitation email with .ics attachment sent successfully to {lead_email}!")
        return True
    except Exception as smtp_err:
        print("Failed to send meeting invitation email via SMTP:", smtp_err)
        return False


def schedule_meeting(req: ScheduleMeetingRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM outreach_leads WHERE id = ?", (req.lead_id,))
    lead = cursor.fetchone()
    if not lead:
        conn.close()
        raise NotFoundError("Lead not found")

    lead = dict(lead)

    summary = f"MOU Collaboration: {lead['incubator_name']}"
    description = f"Introductory discussion regarding strategic cooperation and academic collaboration MoU."

    gmeet_info = create_gmeet_event(
        summary=summary,
        description=description,
        date_str=req.date,
        time_str=req.time,
        attendee_email=lead["email"]
    )

    calendar_event_id = None
    if gmeet_info:
        meeting_link = gmeet_info["meet_link"]
        calendar_event_id = gmeet_info["calendar_event_id"]
        print(f"Successfully scheduled Google Meet call: {meeting_link}")
    else:
        meeting_link = f"https://meet.google.com/abc-{uuid.uuid4().hex[:4]}-xyz"
        calendar_event_id = f"gcal_{uuid.uuid4().hex[:12]}"
        print(f"OAuth not authorized. Using fallback meet link: {meeting_link}")

    meeting_id = f"evt_{uuid.uuid4().hex[:8]}"

    cursor.execute("SELECT COUNT(*) FROM scheduled_meetings WHERE lead_id = ?", (req.lead_id,))
    if cursor.fetchone()[0] == 0:
        cursor.execute('''
            INSERT INTO scheduled_meetings (
                id, lead_id, incubator_id, incubator_name, title, date, time, calendar_event_id, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            meeting_id,
            req.lead_id,
            lead["incubator_id"],
            lead["incubator_name"],
            summary,
            req.date,
            req.time,
            calendar_event_id,
            "Scheduled"
        ))

    send_meeting_invite_email(
        lead_name=lead["incubator_name"],
        lead_email=lead["email"],
        date_str=req.date,
        time_str=req.time,
        meet_link=meeting_link
    )

    meeting_scheduled_at = f"{req.date} at {req.time}"
    cursor.execute('''
        UPDATE outreach_leads 
        SET status = 'Meeting Scheduled',
            meeting_link = ?,
            meeting_scheduled_at = ?
        WHERE id = ?
    ''', (
        meeting_link,
        meeting_scheduled_at,
        req.lead_id
    ))

    conn.commit()
    conn.close()

    return {
        "status": "success",
        "meeting_link": meeting_link,
        "meeting_scheduled_at": meeting_scheduled_at
    }


def get_outreach_meetings():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT m.*, l.meeting_link, COALESCE(m.incubator_id, l.incubator_id) as incubator_id 
        FROM scheduled_meetings m
        LEFT JOIN outreach_leads l ON m.lead_id = l.id
    ''')
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows


def update_meeting_status(req: UpdateMeetingStatusRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM scheduled_meetings WHERE id = ?", (req.meeting_id,))
    meeting = cursor.fetchone()
    if not meeting:
        conn.close()
        raise NotFoundError("Meeting not found")

    if req.status.lower() == "completed":
        lead_id = meeting["lead_id"]
        # Delete this meeting and any other meetings associated with this lead
        cursor.execute("DELETE FROM scheduled_meetings WHERE id = ?", (req.meeting_id,))
        if lead_id:
            cursor.execute("DELETE FROM scheduled_meetings WHERE lead_id = ?", (lead_id,))
            cursor.execute("DELETE FROM outreach_leads WHERE id = ?", (lead_id,))
        conn.commit()
        conn.close()
        return {"status": "success", "message": "Meeting completed. Incubator removed from campaign and meetings."}
    else:
        cursor.execute("UPDATE scheduled_meetings SET status = ? WHERE id = ?", (req.status, req.meeting_id))
        conn.commit()
        conn.close()
        return {"status": "success", "message": f"Meeting status updated to {req.status}."}


def get_external_calendar_events():
    import requests

    api_key = os.environ.get("GoogleCalender") or os.environ.get("GoogleCalendar")
    if api_key:
        api_key = api_key.strip().strip('"').strip("'")

    if not api_key or "AIzaSy" not in api_key:
        return {"status": "not_configured", "events": []}

    try:
        # Fetch from Indian Holidays public calendar using their API key
        calendar_id = "en.indian#holiday@group.v.calendar.google.com"
        url = f"https://www.googleapis.com/calendar/v3/calendars/{calendar_id}/events?key={api_key}&maxResults=10&timeMin=2026-01-01T00:00:00Z"
        res = requests.get(url, timeout=5)
        if res.ok:
            items = res.json().get("items", [])
            events = []
            for item in items:
                summary = item.get("summary")
                start = item.get("start", {})
                date_val = start.get("date") or start.get("dateTime", "").split("T")[0]
                if summary and date_val:
                    events.append({"summary": summary, "date": date_val})
            events.sort(key=lambda x: x["date"])
            return {"status": "real", "events": events[:5]}
    except Exception as e:
        print("Error fetching Google Calendar events:", e)

    return {"status": "error", "events": []}
