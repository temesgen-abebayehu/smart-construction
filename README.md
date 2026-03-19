# smart-construction

Monorepo for Smart Construction platform:
- `backend/` API, ML service, and database migrations
- `web/` Next.js 14 frontend
- `mobile/` Flutter mobile app

## Local Development
1. Copy `.env.example` to `.env` and update values.
2. Start infrastructure:
   ```bash
   docker compose up -d
   ```
3. Run each service from its folder.

## CI
GitHub workflows are available in `.github/workflows/`.
