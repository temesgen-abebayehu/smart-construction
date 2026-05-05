import enum

class ProjectStatus(str, enum.Enum):
    PLANNING = "planning"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ON_HOLD = "on_hold"

class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"

class LogStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    CONSULTANT_APPROVED = "consultant_approved"
    PM_APPROVED = "pm_approved"
    REJECTED = "rejected"

class ProjectRole(str, enum.Enum):
    OWNER = "owner"
    PROJECT_MANAGER = "project_manager"
    OFFICE_ENGINEER = "office_engineer"
    CONSULTANT = "consultant"
    SITE_ENGINEER = "site_engineer"
