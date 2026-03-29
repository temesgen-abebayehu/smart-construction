import smtplib
from email.message import EmailMessage
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

def send_invitation_email(to_email: str, project_name: str, token: str):
    if not settings.SMTP_HOST or not settings.SMTP_PORT or not settings.SMTP_EMAIL:
        logger.warning(f"SMTP not configured. Skipping email to {to_email}. Token: {token}")
        return
        
    try:
        msg = EmailMessage()
        msg['Subject'] = f"Invitation to join project: {project_name}"
        msg['From'] = settings.SMTP_EMAIL
        msg['To'] = to_email
        
        # Build URL for invitation depending on frontend setup.
        # Placeholder endpoint format for local dev
        invite_link = f"http://localhost:3000/invite?token={token}"
        
        msg.set_content(f"""
        You've been invited to join the project: {project_name}.
        
        Please use the following link to accept your invitation:
        {invite_link}
        
        If you don't have an account, please sign up using this email before accepting the invitation.
        """)
        
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            if settings.SMTP_PASSWORD:
                server.login(settings.SMTP_EMAIL, settings.SMTP_PASSWORD)
            server.send_message(msg)
            
        logger.info(f"Successfully sent invitation email to {to_email}")
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
