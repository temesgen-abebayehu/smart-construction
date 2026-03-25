from fastapi import APIRouter

from app.api.endpoints import auth, users, clients, contractors, suppliers, projects, budget, tasks, daily_logs
from app.api.endpoints.system import messages_router, audit_router, settings_router

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(clients.router, prefix="/clients", tags=["Clients"])
api_router.include_router(contractors.router, prefix="/contractors", tags=["Contractors"])
api_router.include_router(suppliers.router, prefix="/suppliers", tags=["Suppliers"])
api_router.include_router(projects.router, prefix="/projects", tags=["Projects & Members"])
api_router.include_router(budget.router, prefix="/projects", tags=["Budget & Payments"])
api_router.include_router(tasks.router, prefix="/projects", tags=["Tasks"])
api_router.include_router(daily_logs.router, prefix="", tags=["Daily Logs & Sub-Entities"])
api_router.include_router(messages_router, prefix="/messages", tags=["Messages"])
api_router.include_router(audit_router, prefix="/audit-logs", tags=["Audit Logs"])
api_router.include_router(settings_router, prefix="/settings", tags=["System Settings"])
