// The app no longer stores any files. ID copies used to be uploaded; they were removed, and the
// files already saved are deleted a few at a time through the FileCleanup table (see file-cleanup.ts).
// Only deleting is left here, for those old files.
import path from "path";

function usesBlob(): boolean {
  const configured = process.env.STORAGE_DRIVER?.toLowerCase();
  if (configured === "local" || configured === "blob") return configured === "blob";
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function deleteStoredFile(filePath: string): Promise<void> {
  const sanitized = filePath.replace(/\.\./g, "").replace(/\\/g, "/");

  if (usesBlob()) {
    const { del } = await import("@vercel/blob");
    await del(sanitized);
    return;
  }

  const { unlink } = await import("fs/promises");
  await unlink(path.join(process.cwd(), process.env.UPLOAD_DIR || "./uploads", sanitized));
}
