# Construction Management System

A web application for coordinating construction projects: dashboards, tasks, daily logs, team visibility, and notifications. The interface is built with **Next.js** and talks to a separate **REST API** (JWT authentication, OpenAPI-documented).

## Features

- **Authentication** — Registration, login, session handling with access and refresh tokens  
- **Projects** — Project selection, creation, and role-aware dashboard navigation  
- **Operations** — Tasks, daily logs, reports, notifications, and profile-oriented settings  
- **Responsive UI** — Built with React, Tailwind CSS, and accessible UI primitives (Radix)

## Tech stack

| Layer | Choice |
|--------|--------|
| Framework | [Next.js](https://nextjs.org) (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Components | Radix UI, Lucide icons |
| API client | `fetch`-based module with typed responses |

## Prerequisites

- **Node.js** 18+ (20+ recommended)  
- **npm**, **pnpm**, or **yarn**  
- A running **backend** that exposes the API (see your team’s deployment or local FastAPI instance)

## Configuration

Create a file named `.env.local` in the project root:

```bash
NEXT_PUBLIC_API_BASE_URL=https://your-api-host.example.com/api/v1
```

Use the base URL that points at the **`/api/v1`** prefix of your backend. Do not use the Swagger UI path (`/docs`) as part of this value.

## Getting started

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the development server with hot reload |
| `npm run build` | Create an optimized production build |
| `npm run start` | Run the production server (after `build`) |
| `npm run lint` | Run ESLint on the codebase |

## Project layout

- `app/` — Routes, layouts, and pages (App Router)  
- `components/` — Shared and feature UI components  
- `lib/` — API client, auth context, types, and domain helpers  

## API integration

The frontend expects a backend that implements the documented contract (e.g. auth, users, projects, tasks, logs). Adjust `NEXT_PUBLIC_API_BASE_URL` per environment. For local development, point it at your API origin; ensure CORS is configured on the server if the API runs on a different host or port.

## License

This project is maintained for educational and demonstration purposes. Add a license file if you intend to distribute or open-source the work.
