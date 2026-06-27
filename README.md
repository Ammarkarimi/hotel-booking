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

Recommended stack: **Vercel** for the Next.js app, **Neon** for PostgreSQL, and **Vercel Blob** for file uploads.

> **Important:** Set up the database **before** deploying. The build runs `prisma generate` and `prisma migrate deploy`, which require `DATABASE_URL`. Without it you will see error `P1012: Environment variable not found: DATABASE_URL`.

### Step 1: Import project on Vercel

1. Push your code to GitHub
2. Import the repository at [vercel.com/new](https://vercel.com/new)

### Step 2: Provision PostgreSQL (required before first deploy)

Vercel does not offer a native "PostgreSQL" button. Use a marketplace provider:

**Neon (recommended)**

1. In Vercel → your project → **Storage** → **Create Database**
2. Under **Marketplace Database Providers**, click **Create** next to **Neon** (Serverless Postgres)
3. Connect it to this project — Vercel adds `DATABASE_URL` automatically
4. Ensure it is enabled for **Production**, **Preview**, and **Development** environments

**Supabase (alternative)**

1. Same Storage page → **Create** next to **Supabase** (Postgres backend)
2. Or create at [supabase.com](https://supabase.com) and paste the connection string into `DATABASE_URL`

### Step 3: Add remaining environment variables

In **Project Settings** → **Environment Variables**, add:

| Variable | Value | Environments |
|----------|-------|--------------|
| `DATABASE_URL` | Auto-set by Neon, or paste your Postgres URL | Production, Preview, Development |
| `JWT_SECRET` | Long random secret (`openssl rand -base64 32`) | Production, Preview, Development |
| `BLOB_READ_WRITE_TOKEN` | From Vercel Blob (step 4) | Production, Preview, Development |
| `STORAGE_DRIVER` | `blob` | Production (optional; auto-detected) |

### Step 4: Provision file storage (Vercel Blob)

1. **Storage** → **Create** → **Blob** (under Direct Vercel Storage Options)
2. Connect to your project — sets `BLOB_READ_WRITE_TOKEN` automatically

### Step 5: Deploy

1. **Redeploy** after all env vars are set (Deployments → ⋯ → Redeploy)
2. Build runs `prisma generate` → `prisma migrate deploy` → `next build`

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

### Troubleshooting: `P1012 Environment variable not found: DATABASE_URL`

This means Vercel does not have `DATABASE_URL` set **at build time**. Fix:

1. Vercel → your project → **Storage** → **Create** → **Neon** → connect to project
2. **Settings** → **Environment Variables** → confirm `DATABASE_URL` exists for **Production**, **Preview**, and **Development**
3. Add `JWT_SECRET` if missing
4. **Deployments** → latest failed deploy → **⋯** → **Redeploy** (do not skip env var sync)

If you created Neon outside Vercel, paste the pooled connection string manually:

```
postgresql://user:password@host/dbname?sslmode=require
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
