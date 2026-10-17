# API CORS configuration (SE4030 Z3)

## First administrator

The admin app uses `/api/auth/admin/login`. A 401 means the credentials do not
belong to an administrator account; public registration always creates ordinary
users. Changing frontend environment variables does not create an administrator.

For a database with no administrators, run this from `api`:

```powershell
npm run admin:bootstrap
```

This interactive command loads `api/.env`, asks for the account profile and a
hidden password, and creates one administrator with a bcrypt password hash after
confirmation. It refuses to run if an administrator already exists or the
username/email is already registered. It never promotes or resets an existing
account. Review the configured database before confirming creation.

Run `node --test api/tests/bootstrap-admin.test.js` from the repository root for
database-free validation of account creation and refusal cases.

## Demo data

Run from `api` to seed the database configured by `MONGO` in `api/.env`:

```powershell
npm run seed -- --dry-run
npm run seed
```

The seed creates 8 regular users, 10 hotels across all 5 property types, 26 room
documents with 78 room numbers, and 3 farms. Every hotel/farm references its own
rooms. Chennai, London and Bangalore match the homepage's current city keys.
Listings are marked `Demo`; sample users use `example.test` email addresses.
Some room numbers have sample unavailable dates a week after initial seeding.
The Farm schema is populated even though the application has no farm routes/UI.

Sample customer login: `demo_alex` / `DemoStay!2026`. All 8 demo users share
this development-only password, stored as a bcrypt hash. Set `SEED_DEMO_PASSWORD`
in the command's environment to use another password for newly inserted users.
The existing administrator account and its password remain unchanged.

Stable IDs and insert-only upserts make reruns safe: the script never deletes
data or resets existing users, edited listings or reservations. Conflicting
existing usernames/emails are skipped. `--dry-run` validates every model without
connecting to MongoDB. Run `node --test api/tests/seed.test.js` from the repository
root for schema, relationship and dry-run checks.

## CORS settings

`config/cors.js` authorizes exact frontend origins. Local defaults are
`http://localhost:5173` (client) and `http://localhost:5174` (admin).
Override them using `CLIENT_URL` and `ADMIN_URL` in the API's local environment:

```dotenv
CLIENT_URL=http://localhost:5173
ADMIN_URL=http://localhost:5174
```

Values must be HTTP(S) origins with no trailing slash, path, wildcard,
credentials, query or fragment. Each variable replaces its corresponding local
default. In `NODE_ENV=production`, both variables must be explicitly configured;
missing/invalid settings stop startup without logging the values.

Approved origins receive their matching Access-Control-Allow-Origin and
Access-Control-Allow-Credentials: true. Other origins, including literal `null`,
receive no CORS permission. Responses vary by Origin for caching. Preflights
permit existing route methods and Content-Type for JSON requests. Authentication
remains required; CORS does not authorize users or block non-browser clients.

The admin same-origin `/api` development proxy remains in place. Direct API
calls can now receive permission from the admin origin. Direct cross-origin
cookie requests still require the browser caller to opt into credentials;
this change does not rewrite application requests or authentication.

Both Vite apps disable asset CORS in development and preview because each app
loads its own assets from its own origin. A different local host/port requires
matching API origin settings; a deployed API also requires aligned frontend CSP.

Run from the repository root:

```powershell
node --test api/tests/cors-options.test.js api/tests/z1-security-headers.test.js
node security/tests/cors-checks.mjs
node security/tests/cors-checks.mjs --preview
```

Preview checks require both dist builds. Browser checks use an installed
Playwright module through `Z2_PLAYWRIGHT_MODULE`:

```powershell
node security/tests/cors-browser-checks.mjs
```

The browser check uses the actual API with temporary fixture origins. It
confirms approved origins can read a credential-mode 401 response while
Chromium blocks an unapproved origin. It uses no accounts, cookies or database.
See the Z3 summary for local ZAP instructions and pending application tests.
