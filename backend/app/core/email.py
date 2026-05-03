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
        msg['Subject'] = f"You've been invited to join: {project_name}"
        msg['From'] = settings.SMTP_EMAIL
        msg['To'] = to_email

        signup_link = f"http://localhost:3000/signup?email={to_email}"
        login_link = f"http://localhost:3000/login?email={to_email}"

        msg.set_content(f"""You've been invited to join the project: {project_name}.

If you already have an account, simply log in and the project will appear in your dashboard:
{login_link}

If you're new, sign up with this email address and you'll be automatically added to the project:
{signup_link}

No extra steps needed — just sign up or log in and you're in.
""")
        
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            if settings.SMTP_PASSWORD:
                server.login(settings.SMTP_EMAIL, settings.SMTP_PASSWORD)
            server.send_message(msg)
            
        logger.info(f"Successfully sent invitation email to {to_email}")
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
