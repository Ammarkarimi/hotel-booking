# Hosting & deployment

The app runs on **Vercel** (project **hotel-booking-8fzz**) with a **PostgreSQL**
database. ID photos are stored in **Vercel Blob**.

## How updates go live

1. A change is merged into the `master` branch on GitHub (usually through a pull
   request).
2. Vercel builds it automatically. A production build runs:
   1. `prisma generate`
   2. `prisma migrate deploy`, which applies any database changes
   3. `next build`
3. If the build succeeds, the live site switches to the new version. If it
   fails, the old version stays live.

**Preview builds** (for branches and pull requests) skip step 2, so a branch can
never change the live database. This project has no preview database, so preview
links build but can’t load data.

**Rollback:** in Vercel → *Deployments*, open an earlier successful production
deployment and choose **Promote** (or **Instant Rollback**). This puts the old code
back. It does not undo database changes.

## Settings (environment variables)

These are set in Vercel → **hotel-booking-8fzz → Settings → Environment Variables**.
After changing any of them, **redeploy**: *Deployments* → latest → ⋯ → *Redeploy*.

| Variable | Needed | What it is |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection. Set automatically when a database is connected under *Storage* |
| `JWT_SECRET` | Yes | Secret used to sign everyone’s sign-in sessions. A long random string |
| `BLOB_READ_WRITE_TOKEN` | Yes, for ID photos | Set automatically when Blob storage is connected under *Storage* |
| `PLATFORM_ADMIN_EMAIL` | For `/platform` | Your owner-panel email |
| `PLATFORM_ADMIN_PASSWORD` | For `/platform` | Your owner-panel password, at least 10 characters |
| `PLATFORM_TIMEZONE` | No | Decides what “this month” is for subscriptions. Default `Asia/Kolkata` |
| `NEXT_PUBLIC_DEMO_MODE` | No | `true` shows demo sign-ins on the login page. Only for a demo site |
| `STORAGE_DRIVER`, `UPLOAD_DIR` | No | Only for hosting outside Vercel with local file storage |

Without both `PLATFORM_ADMIN_*` values, `/platform` stays locked and its sign-in
page says so.

## Change your owner-panel password

1. In Vercel, edit `PLATFORM_ADMIN_PASSWORD` (and `PLATFORM_ADMIN_EMAIL` if
   needed) for **Production**.
2. Redeploy.
3. Every open owner-panel session is signed out. Sign in with the new password.

Choose a long password and don’t reuse it anywhere else. Anyone with access to
your Vercel account can see it, so protect that account too (turn on two-step
login in Vercel and GitHub).

## Change `JWT_SECRET`

Changing it signs **everyone** out: all hotels’ staff and you. Do it only if
you think it has leaked. Generate a new value (for example with
`openssl rand -base64 32`, or any password generator set to 40+ characters),
save it, and redeploy.

## Database

- All hotels share one PostgreSQL database. Every record carries its hotel.
- **Backups:** check the backup or restore settings of your database provider
  (for example Neon, under the database’s *Backup & Restore*). Before big changes,
  you can take a copy with `pg_dump "<DATABASE_URL>" > backup.sql` from a computer
  with PostgreSQL tools installed.
- **Database changes** (“migrations”) live in `prisma/migrations/` and are applied
  automatically on each production deploy. Never edit a migration that has
  already been deployed. Add a new one.

### Migrations so far

| Migration | What it did |
|---|---|
| `20250627000000_init` | First version of the tables |
| `20261008000000_hotel_suite` | Full hotel suite: settings, seasonal prices, guest details, booking numbers from 1001, bills, activity history |
| `20261009000000_multi_hotel` | Many hotels: `Hotel` and `SubscriptionPayment` tables, a hotel on every record, numbers unique per hotel. Existing data became the hotel `hotel_main` (JD) |

## Running a command against the live database

Occasionally useful, for example to load the starter accounts into an empty
database. From a computer with the code and Node.js 20+:

```bash
npm install
DATABASE_URL="<production connection string>" npm run db:seed
```

`db:seed` only adds `admin@hotel.com` / `staff@hotel.com` to the first hotel if
they don’t exist. It never changes existing passwords or data. **Never** run
`db:seed:demo` or `db:setup:dev` against the live database: they add sample
bookings.

## Custom domain

Vercel → *Settings → Domains* → add your domain (for example `app.yourbrand.in`)
and follow the DNS instructions. All links (`/login`, `/platform`,
`/book/<hotel>`) then work on the new domain too. Send hotels their new booking
links.

## Moving away from Vercel

Any Node.js host with PostgreSQL works (Railway, Render, a VPS):

1. Set the same environment variables.
2. Run `npm run build`, then `npm start`.
3. For ID photos, either connect Vercel Blob (`BLOB_READ_WRITE_TOKEN`) or use
   `STORAGE_DRIVER=local` with `UPLOAD_DIR` on a disk that survives restarts.
