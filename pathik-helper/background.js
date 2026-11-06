// Pathik helper: keeps the guest that Innvela sent until Pathik's Add Guest form asks for it.
const ADD_GUEST_URL = "https://pathik.guru/dashboard/add";
const KEEP_FOR_MS = 30 * 60 * 1000; // a guest waits at most 30 minutes (time to sign in to Pathik)

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.type === "pathik:fill") {
    (async () => {
      await chrome.storage.session.set({ pending: { record: msg.record, files: msg.files || [], at: Date.now() } });
      await chrome.tabs.create({ url: ADD_GUEST_URL, index: sender.tab ? sender.tab.index + 1 : undefined });
      reply({ ok: true });
    })().catch((e) => reply({ ok: false, error: String(e?.message || e) }));
    return true;
  }

  if (msg?.type === "pathik:peek" || msg?.type === "pathik:take") {
    (async () => {
      const { pending } = await chrome.storage.session.get("pending");
      if (!pending || Date.now() - pending.at > KEEP_FOR_MS) {
        await chrome.storage.session.remove("pending");
        return reply({ pending: null });
      }
      if (msg.type === "pathik:take") await chrome.storage.session.remove("pending");
      reply({ pending });
    })().catch(() => reply({ pending: null }));
    return true;
  }

  // Pathik's drop-downs may be drawn by jQuery plug-ins (bootstrap-select, select2). Those only
  // redraw from the page's own scripts, so ask the page to refresh them after the values are set.
  if (msg?.type === "pathik:refresh" && sender.tab?.id) {
    chrome.scripting
      .executeScript({
        target: { tabId: sender.tab.id, frameIds: [sender.frameId ?? 0] },
        world: "MAIN",
        func: () => {
          const $ = window.jQuery;
          if (!$ || !$.fn) return;
          $("select").each(function () {
            try {
              if ($.fn.selectpicker && $(this).data("selectpicker")) $(this).selectpicker("refresh");
              if ($.fn.select2 && $(this).hasClass("select2-hidden-accessible")) $(this).trigger("change.select2");
            } catch {
              // a plug-in that cannot refresh is left as it is
            }
          });
        },
      })
      .then(() => reply({ ok: true }))
      .catch((e) => reply({ ok: false, error: String(e?.message || e) }));
    return true;
  }
  return false;
});
