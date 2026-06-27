# Hotel Billing Manager

A full-stack hotel management and billing system for managing rooms, guests, bookings, payments, and analytics.

## Features

- **Room Management** — Add, edit, and remove rooms with type, price, amenities, and status tracking
- **Guest Management** — Register guests with personal details and upload identity documents (Aadhar, PAN, Passport)
- **Check-in / Check-out** — Complete booking workflow from reservation to checkout with automatic bill generation
- **Billing & Payments** — Generate bills, record advance/balance payments, track pending/partial/paid status
- **Analytics Dashboard** — Occupancy rates, revenue overview, room status, and recent payment activity
- **Staff Authentication** — JWT-based login with admin and staff roles

## Tech Stack

- **Frontend:** Next.js 15, React 19, Tailwind CSS 4
- **Backend:** Next.js API Routes
- **Database:** PostgreSQL with Prisma ORM
- **File Storage:** Local filesystem (dev) or Vercel Blob (production)
- **Auth:** JWT sessions with HTTP-only cookies
- **Charts:** Recharts

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 16+ (local install, Docker, or managed cloud database)

## Quick Start (Local Development)

### 1. Start PostgreSQL with Docker

```bash
docker compose up -d
```

This starts PostgreSQL on `localhost:5432` with credentials from `.env.example`.

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` if needed. The default `DATABASE_URL` works with the Docker Compose setup.

### 3. Install, migrate, and seed

```bash
npm install
npm run db:setup:dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> **First-time setup:** `db:setup:dev` runs `prisma migrate dev` (creates/applies migrations) and seeds demo data. For subsequent runs where migrations already exist, use `npm run db:setup`.

## Default Credentials

| Role  | Email             | Password  |
|-------|-------------------|-----------|
| Admin | admin@hotel.com   | admin123  |
| Staff | staff@hotel.com   | staff123  |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Production | Secret for signing session tokens. Generate with `openssl rand -base64 32` |
| `STORAGE_DRIVER` | No | `local` (default) or `blob`. Auto-selects `blob` when `BLOB_READ_WRITE_TOKEN` is set |
| `UPLOAD_DIR` | No | Local upload directory (default: `./uploads`). Only used when `STORAGE_DRIVER=local` |
| `BLOB_READ_WRITE_TOKEN` | Production (Vercel) | Vercel Blob storage token for persistent file uploads |
| `NODE_ENV` | Auto | Set to `production` on deployment hosts |

See `.env.example` for a complete template.

## Production Deployment (Vercel + Neon)

Recommended stack: **Vercel** for the Next.js app, **Neon** (or Supabase/Vercel Postgres) for PostgreSQL, and **Vercel Blob** for file uploads.

### Step 1: Provision PostgreSQL

**Option A — Neon (recommended)**

1. Create a free account at [neon.tech](https://neon.tech)
2. Create a new project and database
3. Copy the connection string (use the **pooled** connection string for serverless)
4. Ensure `?sslmode=require` is included

**Option B — Vercel Postgres**

1. In the Vercel dashboard, go to **Storage** → **Create Database** → **Postgres**
2. Connect it to your project — Vercel sets `DATABASE_URL` automatically

**Option C — Supabase**

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **Settings** → **Database** and copy the connection string (URI format)

### Step 2: Provision file storage (Vercel Blob)

1. In the Vercel dashboard, go to **Storage** → **Create Database** → **Blob**
2. Connect it to your project — Vercel sets `BLOB_READ_WRITE_TOKEN` automatically
3. Set `STORAGE_DRIVER=blob` in environment variables (optional; auto-detected from token)

### Step 3: Deploy to Vercel

1. Push your code to GitHub
2. Import the repository at [vercel.com/new](https://vercel.com/new)
3. Add environment variables in **Project Settings** → **Environment Variables**:

   | Variable | Value |
   |----------|-------|
   | `DATABASE_URL` | Your PostgreSQL connection string |
   | `JWT_SECRET` | A long random secret (`openssl rand -base64 32`) |
   | `BLOB_READ_WRITE_TOKEN` | From Vercel Blob (if not auto-linked) |
   | `STORAGE_DRIVER` | `blob` |

4. Deploy. The build runs `prisma migrate deploy` automatically (see `vercel.json` and `package.json`).

### Step 4: Seed production data (one-time)

After the first successful deploy, seed the admin account:

```bash
# Set DATABASE_URL to your production database, then:
npm run db:seed
```

Or run seed from a Vercel one-off script / local machine pointed at production DB.

### Manual migration (if needed)

```bash
DATABASE_URL="your-production-url" npm run db:migrate
```

## Local Development Without Docker

If you have PostgreSQL installed locally:

```bash
# Create database
createdb hotel_billing

# Update .env
DATABASE_URL="postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/hotel_billing?schema=public"

npm install
npm run db:setup:dev
npm run dev
```

## File Upload Storage

| Environment | Driver | Configuration |
|-------------|--------|---------------|
| Local dev | `local` | Files saved to `./uploads/` (gitignored) |
| Vercel production | `blob` | Requires `BLOB_READ_WRITE_TOKEN` |
| Docker/Railway (VM) | `local` | Mount a persistent volume to `./uploads` and set `STORAGE_DRIVER=local` |

Uploaded documents are served through `/api/uploads?path=...` with authentication — files are never publicly accessible without a valid session.

## End-to-End Workflow

1. **Add a room** — Go to Rooms → Add Room
2. **Register a guest** — Go to Guests → Register Guest → Upload identity documents
3. **Create booking** — Go to Bookings → New Booking → select guest and available room
4. **Record advance payment** — Go to Billing → Record Payment (advance)
5. **Check in guest** — Go to Bookings → Check In
6. **Check out guest** — Go to Bookings → Check Out (auto-generates bill)
7. **Record balance payment** — Go to Billing → Record Payment (balance)
8. **View analytics** — Dashboard shows occupancy, revenue, and room status

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Staff login |
| GET/POST | `/api/rooms` | List/create rooms |
| PUT/DELETE | `/api/rooms/[id]` | Update/delete room |
| GET/POST | `/api/guests` | List/create guests |
| POST | `/api/guests/[id]/documents` | Upload identity document |
| GET/POST | `/api/bookings` | List/create bookings |
| POST | `/api/bookings/[id]` | Check-in, check-out, cancel |
| GET/POST | `/api/payments` | List/record payments |
| GET/POST | `/api/bills` | List/generate bills |
| GET | `/api/analytics` | Dashboard analytics |

## Project Structure

```
src/
├── app/              # Pages and API routes
├── components/       # React UI components
├── lib/              # Database, auth, storage utilities
prisma/
├── schema.prisma     # Database schema
├── migrations/       # PostgreSQL migrations
└── seed.ts           # Demo data
docker-compose.yml    # Local PostgreSQL
vercel.json           # Vercel build configuration
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Generate Prisma client, run migrations, production build |
| `npm run db:setup` | Apply migrations and seed (CI/production) |
| `npm run db:setup:dev` | Create/apply migrations in dev and seed |
| `npm run db:migrate` | Apply pending migrations (`prisma migrate deploy`) |
| `npm run db:migrate:dev` | Create/apply migrations in development |
| `npm run db:seed` | Re-seed demo data |

## Limitations

- Basic role-based auth (admin/staff) without granular permissions
- Single-hotel setup (no multi-property support)
- GST/tax calculation is simplified (flat percentage)
