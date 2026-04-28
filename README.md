# Stolen Car Tracker API

A production-grade REST API and web dashboard for tracking stolen vehicles. Built with Node.js, Express, Handlebars, and MongoDB. Features comprehensive authentication, input validation, pagination, caching, and audit logging.

## Features

- **JWT Authentication** — All `/api/v1` endpoints require a valid Bearer token (except `/health` and `/stats/cached`). Refresh tokens are issued on login.
- **Role-Based Access Control** — Admin and user roles are enforced at the middleware level. Admins can delete any record; regular users can only access their own.
- **Input Validation** — Every POST/PUT request body is validated using Joi. Invalid requests return 400 with field-level error messages.
- **Pagination** — All list endpoints support `?page=1&limit=20` (max 100). Responses include `total`, `page`, `limit`, and `pages` metadata.
- **Redis Caching** — GET endpoints are cached for 60 seconds using Redis. Cache is automatically invalidated on write operations.
- **Audit Logging** — Every create, update, and delete operation is logged to the `audit_logs` collection with userId, action, timestamp, and details.
- **Rate Limiting** — 100 requests per minute per IP address. Disabled in development.
- **Health Check** — Verifies database and Redis connectivity.
- **CSV Export** — Streaming export of filtered theft records with automatic format detection.
- **Handlebars Dashboard** — Server‑rendered admin interface at `/admin/stats` with role‑based protection.
- **Soft Delete** — Theft records are soft‑deleted (never permanently removed). Use `/records/:id/restore` to recover.

## Tech Stack

| Layer           | Technology                  |
|-----------------|-----------------------------|
| Runtime         | Node.js 18+                 |
| Framework       | Express 4                   |
| Templating      | Handlebars (hbs)            |
| Database        | MongoDB (Mongoose ODM)      |
| Cache           | Redis (ioredis)             |
| Authentication  | JSON Web Tokens (HS256)     |
| Validation      | Joi                         |
| Logging         | Winston                     |
| HTTP Client     | Axios                       |

## Quick Start

```bash
git clone https://github.com/your-org/stolen-cars.git
cd stolen-cars
npm install
cp .env.example .env         # configure JWT_SECRET, REDIS_URL, MONGO_URI
npm run seed                 # seed car info, statuses, and sample theft records
npm start                    # starts on port 3000
```

**Requirements:** MongoDB running on `mongodb://localhost:27017/stolen_cars`, Redis on `localhost:6379`.

The web dashboard is available at `http://localhost:3000`. API base URL is `http://localhost:3000/api/v1`.

## Project Structure

```
.
├── app.js                        # Express server, middleware chain, audit queue
├── routes/
│   ├── api-routes.js             # REST API routes (v1 + v2)
│   ├── web-routes.js             # Handlebars view routes
│   ├── auth-routes.js            # Registration, login, refresh, password reset
│   ├── health-routes.js          # Health check endpoint
│   └── webhook-routes.js         # External webhook receiver
├── services/
│   ├── car-infos/                # Car CRUD + search logic
│   ├── statuses/                 # Status CRUD + summary logic
│   ├── theft-records/            # Theft record CRUD + filtering + aggregation
│   ├── stats/                    # Dashboard statistics + cached stats layer
│   └── export/                   # CSV/JSON export services
├── models/
│   └── index.js                  # All Mongoose schemas, indexes, statics
├── middleware/
│   └── auths.js                  # JWT verification, role checks, token blacklist
├── db/
│   └── redis-cache.js            # Redis client and cache helpers
├── graphql/                      # GraphQL schema and resolvers (beta)
│   ├── schema/
│   └── models/
├── views/                        # Handlebars templates
│   ├── admin/
│   ├── car-infos/
│   ├── statuses/
│   └── theft-records/
├── seeder/                       # Database seed scripts
├── package.json
└── .env.example
```

## Authentication

1. Register a user: `POST /auth/register` with `{ email, password, role }`.
2. Login: `POST /auth/login` with `{ email, password }`. Returns `{ token, refreshToken, user }`.
3. Include the token in all subsequent requests: `Authorization: Bearer <token>`.
4. Refresh an expired token: `POST /auth/refresh` with `{ refreshToken }`.
5. Logout: `POST /auth/logout` blacklists the current token.

The JWT secret is loaded from the `JWT_SECRET` environment variable. Tokens use HS256 and expire after 24 hours.

Passwords are hashed using bcrypt before storage.

## API Endpoints

All `/api/v1` endpoints require the `Authorization: Bearer <token>` header unless marked **public**.

### Authentication (public)

| Method | Path             | Description              |
|--------|------------------|--------------------------|
| POST   | `/auth/register`  | Register new user        |
| POST   | `/auth/login`     | Login, get JWT           |
| POST   | `/auth/refresh`   | Refresh expired token    |
| POST   | `/auth/logout`    | Blacklist current token  |
| POST   | `/auth/verify`    | Validate token           |
| POST   | `/auth/reset-password` | Reset password (admin only) |

### Health (public)

| Method | Path      | Description                           |
|--------|-----------|---------------------------------------|
| GET    | `/health` | Verifies database and Redis connectivity |

### Cars

| Method | Path                    | Auth | Description                              |
|--------|-------------------------|------|------------------------------------------|
| GET    | `/api/v1/cars`          | Yes  | List cars (paginated, 20 per page)       |
| GET    | `/api/v1/cars/autocomplete` | Yes  | Search cars by term (min 2 chars)        |
| GET    | `/api/v1/cars/brands`   | Yes  | List distinct brand names                |
| GET    | `/api/v1/cars/:id`      | Yes  | Get car with related theft records       |
| POST   | `/api/v1/cars`          | Yes  | Create car (validated)                   |
| PUT    | `/api/v1/cars/:id`      | Yes  | Update car (validated)                   |
| DELETE | `/api/v1/cars/:id`      | Yes  | Delete car (fails if linked to records)  |
| POST   | `/api/v1/cars/bulk`     | Yes  | Bulk create cars (max 100)               |

### Statuses

| Method | Path                      | Auth | Description                           |
|--------|---------------------------|------|---------------------------------------|
| GET    | `/api/v1/statuses`        | Yes  | List statuses (paginated)             |
| GET    | `/api/v1/statuses/summary`| Yes  | Summary with record counts            |
| GET    | `/api/v1/statuses/:id`    | Yes  | Get status with related records       |
| POST   | `/api/v1/statuses`        | Yes  | Create status (validated)             |
| PUT    | `/api/v1/statuses/:id`    | Yes  | Update status (validated)             |
| DELETE | `/api/v1/statuses/:id`    | Yes  | Delete status (fails if linked)       |
| POST   | `/api/v1/statuses/bulk`   | Yes  | Bulk create statuses                  |

### Theft Records

| Method | Path                              | Auth | Description                                   |
|--------|-----------------------------------|------|-----------------------------------------------|
| GET    | `/api/v1/records`                 | Yes  | List records (paginated, filterable)          |
| GET    | `/api/v1/records/count`           | Yes  | Count records matching filter criteria        |
| GET    | `/api/v1/records/stats/status`    | Yes  | Aggregated stats grouped by status            |
| GET    | `/api/v1/records/stats/brand`     | Yes  | Aggregated stats grouped by car brand         |
| GET    | `/api/v1/records/stats/timeline`  | Yes  | Time‑series breakdown (by year/month/day)     |
| GET    | `/api/v1/records/stats/cached`    | Pub  | Cached dashboard stats (60s TTL)              |
| GET    | `/api/v1/records/:id`             | Yes  | Get single record                             |
| POST   | `/api/v1/records`                 | Yes  | Create record (validated)                     |
| PUT    | `/api/v1/records/:id`             | Yes  | Update record (validated)                     |
| DELETE | `/api/v1/records/:id`             | Yes  | Soft‑delete record                            |
| DELETE | `/api/v1/records/:id/hard`        | Yes  | Permanently delete (admin only)               |
| POST   | `/api/v1/records/:id/restore`     | Yes  | Restore a soft‑deleted record                 |
| POST   | `/api/v1/records/bulk`            | Yes  | Bulk create records (max 100)                 |
| POST   | `/api/v1/records/bulk/delete`     | Yes  | Bulk soft‑delete by ID array                  |
| GET    | `/api/v1/records/plate/normalize` | Yes  | Parse and identify license plate format       |

### Export

| Method | Path                   | Auth | Description                                |
|--------|------------------------|------|--------------------------------------------|
| GET    | `/api/v1/export/csv`   | Yes  | Export records as CSV (streaming)          |
| GET    | `/api/v1/export/json`  | Yes  | Export records as JSON                     |
| GET    | `/api/v1/export/summary` | Yes  | Summary statistics as JSON                 |
| GET    | `/api/v1/export`       | Yes  | Auto‑detect format from Accept header      |

### Filtering & Pagination

List endpoints accept these query parameters:

| Parameter      | Type     | Description                                      |
|----------------|----------|--------------------------------------------------|
| `page`         | integer  | Page number (default: 1)                         |
| `limit`        | integer  | Items per page (default: 20, max: 100)           |
| `car_brand`    | string   | Filter by car brand (case‑insensitive)           |
| `car_model`    | string   | Filter by car model (partial match)              |
| `owner_surname`| string   | Partial match search (case‑insensitive)          |
| `car_number`   | string   | Partial match on license plate                   |
| `status`       | string   | Filter by status name                            |
| `date_from`    | ISO date | Records created on or after this date            |
| `date_to`      | ISO date | Records created on or before this date           |
| `sort_by`      | string   | Sort field: `date_created`, `car_number`, `owner_surname` |
| `sort_dir`     | string   | Sort direction: `asc` or `desc`                  |
| `search`       | string   | Full‑text search across brand and model (cars)   |
| `q`            | string   | General search query (statuses/records)          |
| `advanced`     | JSON     | Raw MongoDB filter object (authenticated only)   |

**Pagination response format:**

```json
{
  "success": true,
  "data": [...],
  "meta": {
    "total": 142,
    "page": 1,
    "limit": 20,
    "pages": 8
  }
}
```

## Example Requests

### List theft records for a specific car brand

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/records?car_brand=Toyota&sort_by=date_created&sort_dir=desc"
```

Response:

```json
{
  "success": true,
  "data": [
    {
      "id": 7,
      "car": "Toyota Camry",
      "status": "Stolen",
      "car_number": "MNO678",
      "owner": "Wilson",
      "date": "2024-03-15T10:30:00Z"
    }
  ],
  "meta": {
    "total": 7,
    "page": 1,
    "limit": 20,
    "pages": 1
  }
}
```

### Create a new theft record

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"car_info_id": 3, "status_id": 1, "car_number": "XYZ999", "owner_surname": "Peterson"}' \
  "http://localhost:3000/api/v1/records"
```

Response (201):

```json
{
  "success": true,
  "data": {
    "id": 15,
    "car": "Ford Focus",
    "status": "Stolen",
    "car_number": "XYZ999",
    "owner": "Peterson",
    "date": "2024-05-20T14:22:10Z"
  }
}
```

## Web Dashboard

The server‑rendered dashboard provides browser‑based management:

| Path                   | Description                              |
|------------------------|------------------------------------------|
| `/`                    | Home page with navigation                |
| `/cars`                | Car list with search, create, edit, delete |
| `/statuses`            | Status list with record counts           |
| `/records`             | Theft records with sort and filter       |
| `/records/dashboard`   | Summary view with charts and stats       |
| `/records/archived`    | View soft‑deleted records                |
| `/admin/stats`         | Admin dashboard (role protected)         |

## Webhook

External systems can submit theft alerts via webhook:

```
POST /webhooks/theft-alert
Content-Type: application/json

{
  "car_info_id": 5,
  "status_id": 1,
  "car_number": "ALERT001",
  "owner_surname": "Doe"
}
```

Requests are signature‑verified using the `WEBHOOK_SECRET` environment variable. Unverified requests return 403.

## Error Handling

Validation errors return 400 with a `fields` array detailing each failure:

```json
{
  "error": "Validation failed",
  "fields": [
    { "field": "car_number", "message": "car_number must not be empty" }
  ]
}
```

Authentication errors return 401 or 403. Server errors return 500 with an optional `details` field in development mode.

## Environment Variables

| Variable      | Default                        | Description                  |
|---------------|--------------------------------|------------------------------|
| `PORT`        | `3000`                         | Server port                  |
| `MONGO_URI`   | `mongodb://localhost:27017/stolen_cars` | MongoDB connection string |
| `REDIS_URL`   | `redis://localhost:6379`       | Redis connection string      |
| `JWT_SECRET`  | *(required)*                   | HS256 signing key            |
| `WEBHOOK_SECRET` | *(required for webhooks)*   | HMAC signature secret        |
| `NODE_ENV`    | `development`                  | `production` disables stack traces |

## Future Improvements

- GraphQL API with subscriptions for real‑time theft alerts
- Full‑text search across owner surnames and car numbers
- WebSocket notifications for admin dashboard
- Bulk import from CSV files
- Integration with vehicle registration APIs for plate lookup

## Known Issues

- Pagination may return inconsistent totals when records are soft‑deleted during filtering.
- The car brand filter is case‑sensitive; use exact matching for best results.
- Stats cache is invalidated on a 60‑second TTL; newly created records may take up to a minute to appear.

## License

MIT
