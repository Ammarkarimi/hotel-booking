// Pathik helper, on Innvela's pages: tells the page the helper is installed, and passes the
// guest to Pathik when staff press "Open Pathik and fill the form".
(() => {
  const VERSION = chrome.runtime.getManifest().version;
  const MAX_BYTES = 245 * 1024; // Pathik takes images of at most 250 KB
  const MAX_IMAGES = 6;

  document.documentElement.dataset.pathikHelper = VERSION;
  window.dispatchEvent(new Event("pathik-helper:ready"));
  document.addEventListener("DOMContentLoaded", () => {
    document.documentElement.dataset.pathikHelper = VERSION;
    window.dispatchEvent(new Event("pathik-helper:ready"));
  });

  const answer = (type, extra = {}) => window.postMessage({ source: "pathik-helper", type, ...extra }, location.origin);

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  }

  /** An ID photo as a JPEG under 250 KB (smaller and smaller until it fits). */
  async function shrink(blob) {
    if ((blob.type === "image/jpeg" || blob.type === "image/png") && blob.size <= MAX_BYTES) return blob;
    const bitmap = await createImageBitmap(blob);
    let side = Math.min(1600, Math.max(bitmap.width, bitmap.height));
    let quality = 0.85;
    for (let i = 0; i < 12; i++) {
      const scale = side / Math.max(bitmap.width, bitmap.height);
      const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const out = await canvas.convertToBlob({ type: "image/jpeg", quality });
      if (out.size <= MAX_BYTES) return out;
      if (quality > 0.55) quality -= 0.1;
      else side = Math.round(side * 0.8);
    }
    throw new Error("An ID copy could not be made small enough for Pathik");
  }

  /** The ID copies, fetched with this page's sign-in and made small enough for Pathik. PDFs are skipped. */
  async function prepareFiles(documents) {
    const files = [];
    const skipped = [];
    for (const d of documents || []) {
      try {
        const res = await fetch(new URL(d.url, location.origin), { credentials: "same-origin" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (!blob.type.startsWith("image/")) {
          skipped.push(d.fileName);
          continue;
        }
        const small = await shrink(blob);
        const base = (d.fileName || "id").replace(/\.[^.]+$/, "");
        files.push({ person: d.person, docType: d.type, name: `${base}.jpg`, type: small.type, dataUrl: await blobToDataUrl(small) });
      } catch {
        skipped.push(d.fileName);
      }
    }
    // Pathik takes at most 6 images for a guest.
    const guestFiles = files.filter((f) => f.person === null);
    if (guestFiles.length > MAX_IMAGES) for (const f of guestFiles.slice(MAX_IMAGES)) files.splice(files.indexOf(f), 1);
    return { files, skipped };
  }

  window.addEventListener("message", async (e) => {
    if (e.source !== window || e.origin !== location.origin) return;
    const m = e.data;
    if (!m || m.source !== "hotel-manager" || m.type !== "pathik:fill" || !m.record) return;
    try {
      const { files, skipped } = await prepareFiles(m.record.documents);
      const record = { ...m.record, skippedFiles: skipped };
      const res = await chrome.runtime.sendMessage({ type: "pathik:fill", record, files });
      if (!res?.ok) throw new Error(res?.error || "Pathik could not be opened");
      answer("pathik:opened");
    } catch (err) {
      answer("pathik:error", { message: `Pathik helper: ${err?.message || err}` });
    }
  });
})();
