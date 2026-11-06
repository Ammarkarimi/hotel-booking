// Pathik helper, on Innvela's pages: tells the page the helper is installed, and passes the
// guest to Pathik when staff press "Open Pathik and fill the form".
(() => {
  const VERSION = chrome.runtime.getManifest().version;

  document.documentElement.dataset.pathikHelper = VERSION;
  window.dispatchEvent(new Event("pathik-helper:ready"));
  document.addEventListener("DOMContentLoaded", () => {
    document.documentElement.dataset.pathikHelper = VERSION;
    window.dispatchEvent(new Event("pathik-helper:ready"));
  });

  const answer = (type, extra = {}) => window.postMessage({ source: "pathik-helper", type, ...extra }, location.origin);

  window.addEventListener("message", async (e) => {
    if (e.source !== window || e.origin !== location.origin) return;
    const m = e.data;
    if (!m || m.source !== "hotel-manager" || m.type !== "pathik:fill" || !m.record) return;
    try {
      // No ID copies are kept in Innvela: staff attach the ID photo in Pathik by hand.
      const res = await chrome.runtime.sendMessage({ type: "pathik:fill", record: m.record, files: [] });
      if (!res?.ok) throw new Error(res?.error || "Pathik could not be opened");
      answer("pathik:opened");
    } catch (err) {
      answer("pathik:error", { message: `Pathik helper: ${err?.message || err}` });
    }
  });
})();
