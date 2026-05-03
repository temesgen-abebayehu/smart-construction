# Smart Construction Management System

A full-stack construction project management platform for tracking projects, tasks, teams, daily logs, budgets, and AI-powered risk predictions. Built as a monorepo with a FastAPI backend, Next.js web frontend, and Flutter mobile app.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend API | Python 3.11, FastAPI, Uvicorn |
| Database | PostgreSQL (async via asyncpg) |
| ORM | SQLAlchemy 2.0 (async) |
| Migrations | Alembic |
| Authentication | JWT (access + refresh tokens), bcrypt |
| Frontend | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS 4, Radix UI, Lucide Icons |
| Charts | Recharts |
| Mobile | Flutter (Dart 3.10+) |
| ML/AI | scikit-learn, pandas, numpy |
| Email | SMTP (Gmail / any provider) |
| Containerization | Docker, Docker Compose |

## Project Structure

```text
smart-construction/
├── backend/                    # FastAPI REST API
│   ├── app/
│   │   ├── main.py             # Application entry point
│   │   ├── api/
│   │   │   ├── routes.py       # Route registration
│   │   │   ├── endpoints/      # API endpoint handlers
│   │   │   └── dependencies.py # Auth & role dependencies
│   │   ├── models/             # SQLAlchemy ORM models
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   ├── services/           # Business logic layer
│   │   ├── repositories/       # Data access layer
│   │   ├── core/               # Config, security, email
│   │   └── database/           # DB session management
│   ├── ml/                     # ML prediction models
│   ├── migrations/             # Alembic database migrations
│   ├── requirements.txt
│   ├── Dockerfile
│   └── docker-compose.yml
├── web/                        # Next.js frontend
│   ├── app/                    # App Router pages
│   ├── components/             # Reusable UI components
│   ├── lib/                    # API client, auth, types
│   └── package.json
├── mobile/                     # Flutter mobile app (in progress)
│   └── construction_mobile_app/
├── .env.example
├── docker-compose.yml
├── CONTRIBUTING.md
└── .github/workflows/
```

## Features

### Project Management
- Create and manage construction projects with budget, timeline, and location
- Role-based access control (Project Manager, Office Engineer, Consultant, Site Engineer)
- Project progress auto-calculated from task completion
- Client management with find-or-create flow

### Task Management
- Create, assign, and track tasks within projects
- Assignee selection from project team members (Jira-style dropdown)
- Status tracking (Pending, In Progress, Completed)
- Progress percentage with automatic project rollup
- Task dependencies

### Team Collaboration
- Invite members by email with role assignment
- Smart invitation flow: existing users are added directly, new users get a signup link
- Auto-accept invitations on registration or login
- Role-based permissions for team management

### Daily Logging
- Structured daily construction reports
- Multi-step approval workflow: Submit > Review > Consultant Approve > PM Approve
- Track shifts, labor hours, materials used, and equipment
- Weather conditions recording

### Budget & Finance
- Project budget tracking (total, spent, remaining)
- Multi-currency display with conversion (ETB, USD, EUR, GBP, AED, CNY, KES)
- Budget item tracking

### Authentication & Security
- JWT-based authentication with refresh tokens
- Password reset via email link (15-minute expiry)
- Change password from profile
- Role-based route protection

### AI & Predictions
- ML-powered project risk prediction (delay estimates, budget overrun)
- Weather integration for project locations

### UI/UX
- Dark/Light/System theme toggle
- Responsive design across all pages
- Real-time form validation
- Collapsible settings panels

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+ and pnpm
- PostgreSQL 14+
- Git

### 1. Clone the repository

```bash
git clone https://github.com/temesgen-abebayehu/smart-construction.git
cd smart-construction
```

### 2. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
# venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp ../.env.example .env
```

Edit `backend/.env` with your configuration:

```env
DATABASE_URL=postgresql://your_user@localhost:5432/smart_construction
JWT_SECRET=your_secret_key_here
PROJECT_NAME=Smart Construction API

# Optional: Email (for invitations and password reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_EMAIL=your_email@gmail.com
SMTP_PASSWORD=your_app_password
```

Create the database and start the server:

```bash
# Create PostgreSQL database
createdb smart_construction

# Start the backend (auto-creates tables)
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000` with interactive docs at `http://localhost:8000/docs`.

### 3. Frontend Setup

```bash
cd web

# Install dependencies
pnpm install

# Create environment file
echo "NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1" > .env.local

# Start development server
pnpm dev
```

The frontend will be available at `http://localhost:3000`.

### 4. Docker (Alternative)

```bash
cd backend
docker compose up --build
```

## API Reference

Base URL: `/api/v1`

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login (returns JWT tokens) |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/forgot-password` | Send password reset email |
| POST | `/auth/reset-password` | Reset password with token |

## User Roles

| Role | Permissions |
|------|------------|
| **Project Manager** | Full project access, create tasks, manage team, approve logs, manage budget |
| **Office Engineer** | Review daily logs for document completeness |
| **Consultant** | Verify site work, approve daily logs |
| **Site Engineer** | Submit daily logs for assigned tasks |

The project creator is automatically assigned as **Project Manager**.

## Daily Log Approval Workflow

```text
Site Engineer submits log
        |
        v
Office Engineer reviews
        |
        v
Consultant approves
        |
        v
Project Manager gives final approval
```

At any stage, the log can be rejected back to the submitter.

## License

This project is developed as a final year project for academic purposes.
