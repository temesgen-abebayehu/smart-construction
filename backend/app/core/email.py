import smtplib
from email.message import EmailMessage
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

def send_invitation_email(to_email: str, project_name: str, token: str, user_exists: bool = False):
    if not settings.SMTP_HOST or not settings.SMTP_PORT or not settings.SMTP_EMAIL:
        logger.warning(f"SMTP not configured. Skipping email to {to_email}. Token: {token}")
        return

    try:
        msg = EmailMessage()
        msg['From'] = settings.SMTP_EMAIL
        msg['To'] = to_email

        if user_exists:
            msg['Subject'] = f"You've been added to project: {project_name}"
            msg.set_content(f"""You've been added to the project: {project_name}.

Log in to access the project in your dashboard:
http://localhost:3000/login?email={to_email}
""")
        else:
            msg['Subject'] = f"You've been invited to join: {project_name}"
            msg.set_content(f"""You've been invited to join the project: {project_name}.

Sign up with this email address to get started:
http://localhost:3000/signup?email={to_email}

Once you create your account, you'll be automatically added to the project.
""")
        
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            if settings.SMTP_PASSWORD:
                server.login(settings.SMTP_EMAIL, settings.SMTP_PASSWORD)
            server.send_message(msg)
            
        logger.info(f"Successfully sent invitation email to {to_email}")
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
