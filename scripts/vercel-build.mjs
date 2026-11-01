// Build script used by Vercel (and `npm run build`).
//
// - Production builds apply database migrations, so the live database is
//   always up to date with the code being deployed.
// - Preview builds (pull requests / branches) never touch the database: a
//   branch must not change the production schema, and previews often have no
//   DATABASE_URL at all. They only compile the app.
// - A production build without DATABASE_URL stops with a clear explanation
//   instead of a cryptic Prisma error.
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const run = (cmd, env = process.env) => execSync(cmd, { stdio: "inherit", env });

/**
 * Migrations hold a Postgres lock for their whole run, which a connection pooler (PgBouncer, Neon's
 * "-pooler" address) cannot do reliably: the lock can be left stuck and the next build times out.
 * So migrations use the direct database address: DATABASE_URL_UNPOOLED if it is set, otherwise the
 * Neon pooled address with "-pooler" taken out of the host name.
 */
export function directDatabaseUrl(url, unpooled) {
  if (unpooled) return unpooled;
  try {
    const u = new URL(url);
    if (!u.hostname.includes("-pooler.")) return url;
    u.hostname = u.hostname.replace("-pooler.", ".");
    u.searchParams.delete("pgbouncer");
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Runs the migrations. If they fail (usually Prisma's migration lock is still held by an earlier
 * connection that never let go), it tries twice more without taking that lock: only one
 * production build runs at a time, so the lock is not needed to keep migrations apart.
 */
function migrate() {
  const url = directDatabaseUrl(process.env.DATABASE_URL ?? "", process.env.DATABASE_URL_UNPOOLED);
  const env = url ? { ...process.env, DATABASE_URL: url } : { ...process.env };
  if (url && url !== process.env.DATABASE_URL) console.log("\n▶ Running migrations on the direct (not pooled) database connection.\n");
  for (let attempt = 1; ; attempt++) {
    try {
      return run("prisma migrate deploy", attempt === 1 ? env : { ...env, PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: "1" });
    } catch (error) {
      if (attempt >= 3) throw error;
      console.log(`\n▶ Migrations failed (try ${attempt} of 3). Trying again in ${attempt * 10} seconds without the migration lock…\n`);
      execSync(`sleep ${attempt * 10}`);
    }
  }
}

const vercelEnv = process.env.VERCEL_ENV; // "production" | "preview" | "development" | undefined (not on Vercel)
const isPreview = vercelEnv === "preview" || vercelEnv === "development";
// Prisma also reads a local .env file. Only check it for DATABASE_URL: loading the
// whole file could leak values such as NODE_ENV=development into `next build`.
const envFileHasDatabase = existsSync(".env") && /^\s*DATABASE_URL\s*=\s*["']?[^"'\s]/m.test(readFileSync(".env", "utf8"));
const hasDatabase = Boolean(process.env.DATABASE_URL) || envFileHasDatabase;

run("prisma generate");

if (isPreview) {
  console.log(`\n▶ Vercel ${vercelEnv} build: skipping database migrations.\n`);
} else if (hasDatabase) {
  migrate();
} else {
  console.error(`
✖ DATABASE_URL is not set, so the database cannot be prepared.

  On Vercel: open this project → Storage → connect a Postgres database (e.g. Neon),
  or add DATABASE_URL under Settings → Environment Variables for Production,
  then redeploy. Also add JWT_SECRET (any long random text).
`);
  process.exit(1);
}

run("next build");
