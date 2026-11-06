// The app no longer stores any files. ID copies used to be uploaded to Vercel Blob; they were removed,
// and the files already saved are deleted a few at a time through the FileCleanup table (file-cleanup.ts).
// Only deleting from Blob is left here. There is deliberately no local-disk code: a path built from
// process.cwd() makes the build copy the whole project into every function that imports this file.

export async function deleteStoredFile(filePath: string): Promise<void> {
  // Without Blob (local development) there is nothing to delete: the entry just leaves the queue.
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  const { del } = await import("@vercel/blob");
  await del(filePath.replace(/\.\./g, "").replace(/\\/g, "/"));
}
