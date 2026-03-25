import uuid
from typing import Optional
from datetime import datetime, timezone
import enum

from sqlalchemy import Column, String, Boolean, DateTime, UUID as SQL_UUID
from sqlalchemy.orm import declarative_base

Base = declarative_base()

def utcnow():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"

    id = Column(SQL_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone_number = Column(String(50), nullable=True)
    hashed_password = Column(String(255), nullable=False)
    is_admin = Column(Boolean(), default=False, nullable=False)
    is_active = Column(Boolean(), default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
