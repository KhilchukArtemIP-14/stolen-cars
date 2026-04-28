# Stolen Car Tracker API 🚓

A secure REST API and web dashboard for tracking stolen vehicles. Built with Node.js, Express, Handlebars, and MongoDB.

## Features

- **JWT Authentication** – All API endpoints (except `/api/public`) require a valid Bearer token.
- **MongoDB + Mongoose** – Data is stored in MongoDB with full Mongoose schema validation.
- **Input Validation** – Every POST/PUT request is validated using Joi.
- **Pagination** – List endpoints return paginated results (20 items per page by default).
- **Logging** – All requests and errors are logged via Winston.
- **Handlebars Views** – Server‑side rendered dashboard for browsing, creating, and editing records.
- **JSON Services** – Clean separation of data access logic in dedicated service modules.

## Tech Stack

| Layer          | Technology                          |
|----------------|-------------------------------------|
| Backend        | Node.js, Express                    |
| Templating     | Handlebars (hbs)                    |
| Database       | MongoDB (via Mongoose)              |
| Authentication | JSON Web Tokens (JWT)               |
| Validation     | Joi                                 |
| Logging        | Winston                             |

## Project Structure

```
.
├── routes/
│   ├── api-routes.js
│   └── web-routes.js
├── services/
│   ├── car-infos/
│   ├── statuses/
│   └── theft-records/
├── views/
│   ├── car-infos/
│   ├── statuses/
│   ├── theft-records/
│   └── index.hbs
├── middleware/
│   └── auth.js
├── db/
│   └── mongodb.js
├── seeder/
├── app.js
└── package.json
```

## Installation

```bash
git clone <repo-url>
cd stolen-car-tracker
npm install
```

Make sure you have a MongoDB instance running on `mongodb://localhost:27017/stolen_cars`.

## Usage

Start the server:

```bash
node app.js
```

The web dashboard will be available at `http://localhost:3000`.

## API Endpoints

All endpoints except `/api/public` require an `Authorization` header:  
`Bearer <your-jwt-token>`.

### Public

- `GET /api/public/status` – Health check (no auth required)

### Cars

- `GET /api/cars` – List cars (paginated, 20 per page)
- `POST /api/cars` – Create a new car (validated)
- `GET /api/cars/:id` – Get single car
- `PUT /api/cars/:id` – Update car (validated)
- `DELETE /api/cars/:id` – Delete car

### Statuses

- `GET /api/statuses`
- `POST /api/statuses`
- `PUT /api/statuses/:id`

### Theft Records

- `GET /api/theft-records`
- `POST /api/theft-records`
- `PUT /api/theft-records/:id`

## Authentication Flow

1. Obtain a token by logging in via `/api/auth/login`.
2. Include the token in subsequent requests.
3. The `auth` middleware verifies the token signature using HS256 and attaches the user to `req.user`.
4. Expired tokens are rejected; invalid tokens result in a 401 response.

## Known Issues / TODOs

- Some views still use hardcoded test data (see `car-infos-render.js`).
- The Auth middleware signature verification is currently skipped in development – enable before production.
- Stats endpoint uses Redis cache with 60s TTL.
- Health check verifies Redis and database connectivity.

## License

MIT