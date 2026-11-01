// Deletes uploaded files that are no longer wanted (see the FileCleanup table), a few at a time,
// while the app is being used. Each server instance tries at most once every few minutes.
import { rawPrisma } from "./db";
import { deleteStoredFile } from "./storage";

let lastRun = 0;
const EVERY_MS = 5 * 60 * 1000;

export async function drainFileCleanup(batch = 25) {
  if (Date.now() - lastRun < EVERY_MS) return 0;
  lastRun = Date.now();
  const pending = await rawPrisma.fileCleanup.findMany({ take: batch, orderBy: { createdAt: "asc" } });
  let done = 0;
  for (const f of pending) {
    try {
      await deleteStoredFile(f.filePath);
    } catch (error) {
      // A file that is already gone counts as deleted; anything else is tried again later.
      const message = String((error as Error)?.message ?? error);
      if (!/not.?found|ENOENT|404/i.test(message)) continue;
    }
    await rawPrisma.fileCleanup.delete({ where: { filePath: f.filePath } }).catch(() => undefined);
    done += 1;
  }
  return done;
}
