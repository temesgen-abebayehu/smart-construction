from fastapi import APIRouter

from app.api.endpoints import auth, users, clients, suppliers, projects, budget, tasks, prediction, weather, reports, oauth
from app.api.endpoints.daily_logs import project_logs_router, logs_router
from app.api.endpoints.system import messages_router, audit_router, settings_router, admin_router, announcements_router

api_router = APIRouter()

api_router.include_router(auth.router,            prefix="/auth",         tags=["Authentication"])
api_router.include_router(oauth.router,           prefix="/auth",         tags=["Authentication"])
api_router.include_router(users.router,           prefix="/users",        tags=["Users"])
api_router.include_router(clients.router,         prefix="/clients",      tags=["Clients"])
api_router.include_router(suppliers.router,       prefix="/suppliers",    tags=["Suppliers"])
api_router.include_router(projects.router,        prefix="/projects",     tags=["Projects & Members"])
api_router.include_router(budget.router,          prefix="/projects",     tags=["Budget & Budget Items"])
api_router.include_router(tasks.router,           prefix="/projects",     tags=["Tasks"])

# Daily logs — two routers:
#   project_logs_router: /projects/{project_id}/daily-logs  (create & list)
#   logs_router:         /daily-logs/{log_id}/...           (get, workflow, sub-entities)
api_router.include_router(project_logs_router,    prefix="/projects",     tags=["Daily Logs"])
api_router.include_router(logs_router,            prefix="",              tags=["Daily Logs"])

api_router.include_router(prediction.router,      prefix="/projects",     tags=["ML Risk Prediction"])
api_router.include_router(reports.router,         prefix="/projects",     tags=["Reports"])
api_router.include_router(weather.router,         prefix="/projects",     tags=["Weather"])
api_router.include_router(messages_router,        prefix="/messages",     tags=["Messages"])
api_router.include_router(audit_router,           prefix="/audit-logs",   tags=["Audit Logs"])
api_router.include_router(settings_router,        prefix="/settings",     tags=["System Settings"])
api_router.include_router(admin_router,           prefix="/admin",        tags=["Admin"])
api_router.include_router(announcements_router,   prefix="/announcements", tags=["Announcements"])
