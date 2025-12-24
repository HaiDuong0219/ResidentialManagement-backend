## Purpose

This file gives concise, actionable guidance for AI coding agents working on the ResidentialManagement repository (backend). It focuses on the concrete patterns, run/debug commands, integration points, and examples that are discoverable in the codebase.

## Big-picture architecture

- Backend: `src/server.js` (Express, ES modules). Routes are mounted under `/api/*` (e.g. `/api/meetings`, `/api/residents`). See the top-level app wiring in `src/server.js`.
- Routing & controllers: each resource has two files:
  - `src/routes/<resource>Routes.js` — defines Express routes and imports controller functions.
  - `src/controllers/<resource>Controller.js` — exports named async functions (getAll..., getById, create..., update..., delete...).
- DB layer: `src/config/db.js` exports a single `sql` object created with `@neondatabase/serverless` (neon(connectionString)). SQL queries are performed directly from controllers using `await sql.query(...)`. See `src/config/db.js` and `src/controllers/meetingsController.js` for examples.

## Key patterns (copyable examples)

- Mounting routes (in `src/server.js`):

  app.use("/api/meetings", meetingsRoutes);

- Route file pattern (example `src/routes/meetingsRoutes.js`):

  import express from 'express';
  import { getAllMeetings, createMeeting } from '../controllers/meetingsController.js';
  const router = express.Router();
  router.get('/', getAllMeetings);
  router.post('/', createMeeting);
  export default router;

- Controller -> DB usage (example `src/controllers/meetingsController.js`):

  import { sql } from "../config/db.js";

  const meetings = await sql.query('SELECT * FROM meeting');

  // Parameterized queries use $1, $2, ...
  await sql.query('SELECT * FROM meeting WHERE id = $1', [id]);

- JSON response shape

  Successful responses: { success: true, data: ... }
  Errors: typically return 400 for validation or 500 for server errors: { error: '...' }

## Environment & secrets

- Database connection is built from env vars in `src/config/db.js`: PGUSER, PGPASSWORD, PGHOST, PGDATABASE. The module composes `postgresql://<user>:<pass>@<host>/<db>`.
- Backend reads `.env` via `dotenv.config()` in `src/server.js` and `src/config/db.js`.

## Run / dev commands (backend)

- Install and run:

  - Install dependencies: run `npm install` in `ResidentialManagement-backend`.
  - Dev (nodemon): `npm run dev` — runs `nodemon src/server.js`.
  - Start: `npm start` — runs `node src/server.js`.

Note: `package.json` sets "type": "module" so use `import`/`export` syntax.

## Database / schema

- The repository contains `src/config/db_init.sql` (DB schema and initial statements). When modifying queries, consult this file to learn table names and columns (e.g., `meeting`, `resident`, etc.).

## Conventions & patterns to preserve

- File naming: plural resource names for both routes and controllers (e.g., `meetingsController.js`, `meetingsRoutes.js`).
- Keep controllers thin: perform SQL directly in controllers (this repo currently does not use a separate data-access layer). Follow the existing pattern: simple validation, parameterized queries, try/catch -> respond with 500 on errors.
- Response shapes and status codes are consistent (400 validation, 200 success, 201 created, 404 not found, 500 server error). Mirror these when adding endpoints.

## Integration points / external deps

- Uses `@neondatabase/serverless` for Postgres access in serverless-friendly way. See `src/config/db.js`.
- Express + CORS are configured in `src/server.js`.

## Example PR hints for AI agents

- When adding a new resource (e.g., `events`):
  1. Add `src/controllers/eventsController.js` with named exports following the existing functions (`getAllEvents`, `createEvent`, ...).
  2. Add `src/routes/eventsRoutes.js` exporting a default Router mounting those functions.
  3. In `src/server.js` import and mount: `app.use('/api/events', eventsRoutes);`
  4. Update `db_init.sql` if new tables are required and add docs in the README.

## Files to inspect for details

- `src/server.js` — route mounting and middleware
- `src/config/db.js` — env vars and DB client construction
- `src/controllers/*Controller.js` — query style, response shape, validation
- `src/routes/*Routes.js` — how routes map to controllers
- `src/config/db_init.sql` — table/column names used in queries

## If something is missing / ambiguous

- Ask the developer for the preferred DB migration/deployment process (there's no migration tool discovered). Also ask whether a dedicated data-access layer is desired before refactoring controllers.

---
If any of the above is incomplete or you want me to add examples for the frontend or CI/deployment steps, tell me which files to inspect next (e.g., frontend package.json or cloud deploy config).
