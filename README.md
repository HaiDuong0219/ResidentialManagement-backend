# Residential Management — Backend (API)

A Node.js/Express REST API for managing households, residents, temporary stay/leave declarations, meetings, and meeting attendance (including QR-based public check-in).

## Contributors

Group: 20
Contributors:

Trịnh Minh Thành - 20235834
Lê Duy Vũ - 20235878
Đào Thái Hoàng - 20235720
Trần Thu Phương - 20235811
Nguyễn Hải Dương - 20235692

## Tech Stack

- Node.js + Express
- PostgreSQL (works with Neon via `@neondatabase/serverless`)
- `dotenv` for configuration
- `cors` enabled for local development

## Project Structure

- `src/server.js` — Express bootstrap and route mounting
- `src/config/db.js` — Database connection (Neon/Postgres)
- `src/config/db_init.sql` — Database schema initialization
- `src/routes/` — Route definitions
- `src/controllers/` — Request handlers and DB logic

## Requirements

- Node.js (LTS recommended)
- A PostgreSQL database (local Postgres or Neon)

## Configuration

Create a `.env` file in this folder (`ResidentialManagement-backend/`) with the following variables:

```env
# Server
PORT=5001

# Postgres connection parts
PGUSER=...
PGPASSWORD=...
PGHOST=...
PGDATABASE=...

# Optional: used for signing attendance QR/check-in tokens
# If not set, the server uses a dev fallback secret.
CHECKIN_SECRET=change-me
```

### Database Setup

1. Create an empty PostgreSQL database.
2. Run the schema script in `src/config/db_init.sql` against that database.

Example (generic):

```bash
psql "postgresql://USER:PASSWORD@HOST/DATABASE" -f src/config/db_init.sql
```

Schema highlights:

- `account` — staff login accounts and roles (`leader`, `deputy`, `officer`)
- `household` — household registry
- `resident` — residents linked to a household
- `residentlog` — audit/log of resident changes
- `temporarystayleave` — temporary stay/leave declarations
- `meeting` — community meetings
- `attendance` — per-meeting attendance per household

## Install

```bash
npm install
```

## Run

- Development (auto-reload):

```bash
npm run dev
```

- Production:

```bash
npm start
```

The API listens on `http://localhost:${PORT}` (default `5001`).

## API Overview

Base URL: `http://localhost:5001`

Mounted route prefixes (see `src/server.js`):

- `/api/auth`
- `/api/users`
- `/api/households`
- `/api/residents`
- `/api/meetings`
- `/api/attendance`
- `/api/temporary-stay-leave`

### Auth

- `POST /api/auth`
  - Body: `{ "email": "...", "password_hash": "..." }`
  - Returns: `{ success, data: { id, email, full_name, role, status } }`

Note: current implementation compares `password_hash` as a plain string.

### Users

- `GET /api/users/roles` — list available roles
- `GET /api/users/stats` — role/status breakdown
- `POST /api/users/bulk/status` — bulk activate/deactivate
- `GET /api/users` — list/search (`q`, `role`, `status`, `limit`, `offset`)
- `GET /api/users/me?email=...` — get profile by email
- `PATCH /api/users/me` — update profile (by email)
- `PATCH /api/users/me/password` — change password (by email)
- `GET /api/users/by-email?email=...` — lookup by email
- `GET /api/users/:id` — lookup by id
- `POST /api/users` — create user
- `PATCH /api/users/:id` — update user
- `PATCH /api/users/:id/status` — set status (boolean)
- `PATCH /api/users/:id/password` — set password
- `DELETE /api/users` — legacy “delete” by email (sets `status=false`)
- `DELETE /api/users/:id` — hard delete by id

### Households

- `POST /api/households` — create household
- `GET /api/households` — list households
- `GET /api/households/code/:household_code` — get by code
- `GET /api/households/:household_code/residents` — residents in a household (by code)
- `POST /api/households/:id/split` — split household
- `GET /api/households/:id/resident-logs` — resident logs for household
- `GET /api/households/:id` — get by id
- `PUT /api/households/:id` — update
- `DELETE /api/households/:id` — delete

### Residents

- `POST /api/residents` — create
- `GET /api/residents` — list
- `GET /api/residents/statistics` — resident statistics
- `GET /api/residents/household/:household_id` — list by household id
- `GET /api/residents/:id/logs` — resident change history
- `GET /api/residents/:id` — get by id
- `PUT /api/residents/:id` — update
- `DELETE /api/residents/:id` — delete

### Meetings

- `GET /api/meetings` — list
- `GET /api/meetings/:id` — get details
- `POST /api/meetings` — create
- `PUT /api/meetings/:id` — update
- `DELETE /api/meetings/:id` — delete

### Attendance (including QR check-in)

- `GET /api/attendance` — list raw attendance rows
- `GET /api/attendance/statistics` — attendance statistics
- `GET /api/attendance/top-households` — top attending households
- `GET /api/attendance/frequency-by-month` — monthly frequency
- `GET /api/attendance/cultural-families` — “cultural families” query

Per meeting:

- `GET /api/attendance/meeting/:meetingId` — attendance sheet for all households
- `PUT /api/attendance/meeting/:meetingId` — bulk upsert attendance

Public QR check-in:

- `GET /api/attendance/meeting/:meetingId/token` — returns `{ token }`
- `GET /api/attendance/checkin/:meetingId?token=...` — public check-in info
- `POST /api/attendance/checkin/:meetingId` — confirm check-in `{ token, household_id }`

### Temporary Stay / Leave

- `POST /api/temporary-stay-leave` — create
- `GET /api/temporary-stay-leave` — list
- `GET /api/temporary-stay-leave/statistics` — statistics
- `GET /api/temporary-stay-leave/:id` — get by id
- `PUT /api/temporary-stay-leave/:id` — update
- `DELETE /api/temporary-stay-leave/:id` — delete

## Common Issues

- **Database connection errors**: verify `.env` values (`PGUSER`, `PGPASSWORD`, `PGHOST`, `PGDATABASE`) and that the database is reachable.
- **CORS**: the server enables CORS globally; if you deploy, restrict origins appropriately.

## License

See `LICENSE`.
