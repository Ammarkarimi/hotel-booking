// Pathik helper, on pathik.guru: fills the Add Guest form with the guest Hotel Manager sent.
// Fields are found by the words of their labels ("First Name*", "Zip Code*", "No. of Adult*"),
// so small changes to Pathik's page do not break it. Nothing is submitted: staff check the form,
// add the Aadhaar by hand and press Submit themselves.
(() => {
  if (window.__pathikHelper) return;
  window.__pathikHelper = true;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[*:]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const CONTROL = "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio]), select, textarea";

  // Labels Pathik uses for each value (the first that matches wins). "comapny" is Pathik's own spelling.
  const MAIN = {
    firstName: ["first name"],
    middleName: ["middle name"],
    lastName: ["last name", "surname"],
    company: ["comapny name", "company name", "company"],
    address: ["address", "customer address"],
    locality: ["locality", "area"],
    city: ["city"],
    district: ["district"],
    zipCode: ["zip code", "pin code", "pincode", "zip"],
    country: ["country"],
    state: ["state"],
    dateOfBirth: ["date of birth", "dob", "birth date"],
    mobile: ["mobile no.", "mobile no", "mobile number", "mobile"],
    phone: ["phone no.", "phone no", "phone number", "phone"],
    email: ["email address", "email"],
    comingFrom: ["coming from"],
    goingTo: ["going to"],
    docType: ["document type", "id type", "id proof type"],
    docNumber: ["document number", "document no", "id number"],
    docImage: ["document image", "document photo", "id image"],
    roomNumber: ["room number", "room no"],
    checkInDate: ["checkin date", "check in date", "check-in date"],
    checkInTime: ["checkin time", "check in time", "check-in time"],
    checkOutDate: ["checkout date", "check out date", "check-out date"],
    checkOutTime: ["checkout time", "check out time", "check-out time"],
    children: ["no. of child", "no of child", "no. of children", "children"],
    adults: ["no. of adult", "no of adult", "no. of adults", "adults"],
    vehicleType: ["vehicle type"],
    vehicleNumber: ["vehicle registration no.", "vehicle registration no", "vehicle registration number", "vehicle number", "vehicle no"],
  };
  // Labels in the block Pathik adds for each extra adult.
  const OTHER = {
    firstName: ["first name"],
    middleName: ["middle name"],
    lastName: ["last name", "surname"],
    fullName: ["name", "full name", "guest name", "person name", "member name"],
    mobile: ["mobile no.", "mobile no", "mobile number", "mobile", "phone no.", "phone no", "phone"],
    docType: ["document type", "id type", "id proof type"],
    docNumber: ["document number", "document no", "id number"],
    docImage: ["document image", "document photo", "id image"],
  };

  const DOC_TYPES = {
    aadhar: [/aadh?aa?r/],
    passport: [/passport/],
    driving_licence: [/driving/, /licen[cs]e/, /\bdl\b/],
    voter_id: [/voter/, /election/],
    pan: [/\bpan\b/],
    visa: [/visa/],
    other: [/other/],
  };
  const VEHICLES = {
    two_wheeler: [/two/, /2\s*-?\s*wheel/, /bike/, /scooter/, /motor\s*cycle/],
    four_wheeler: [/four/, /4\s*-?\s*wheel/, /\bcar\b/],
    other: [/other/],
    none: [/^none$/, /^no$/, /no vehicle/, /not applicable/, /^n\/?a$/, /without/, /walk/],
  };

  // ---------- finding fields ----------

  function controlFor(label) {
    if (label.htmlFor) {
      const el = document.getElementById(label.htmlFor);
      if (el && el.matches(CONTROL)) return el;
    }
    const inside = label.querySelector(CONTROL);
    if (inside) return inside;
    // The control right after the label, inside the same group (Pathik puts each in a small box).
    for (let box = label.parentElement, depth = 0; box && depth < 3; box = box.parentElement, depth++) {
      const all = [...box.querySelectorAll(CONTROL)];
      const after = all.find((c) => label.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING);
      if (after && box.querySelectorAll("label").length <= 2) return after;
    }
    let n = label.nextElementSibling;
    for (let i = 0; n && i < 3; i++, n = n.nextElementSibling) {
      if (n.matches(CONTROL)) return n;
      const c = n.querySelector(CONTROL);
      if (c) return c;
    }
    return null;
  }

  /** Every labelled field on the page, in page order: { key, el, labelText }. */
  function labelledFields() {
    const seen = new Set();
    const out = [];
    for (const label of document.querySelectorAll("label")) {
      const el = controlFor(label);
      if (!el || seen.has(el)) continue;
      seen.add(el);
      out.push({ key: norm(label.textContent), el, labelText: label.textContent.trim().replace(/\s+/g, " ") });
    }
    // Fields with only a placeholder ("Enter First Name").
    for (const el of document.querySelectorAll(CONTROL)) {
      if (seen.has(el) || !el.placeholder) continue;
      seen.add(el);
      out.push({ key: norm(el.placeholder.replace(/^enter\s+/i, "")), el, labelText: el.placeholder });
    }
    return out.sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  }

  function pick(fields, names) {
    for (const n of names) {
      const exact = fields.find((f) => f.key === n);
      if (exact) return exact;
    }
    for (const n of names) {
      const starts = fields.find((f) => f.key.startsWith(n + " ") || f.key.startsWith(n + "(") || f.key.startsWith(n + "."));
      if (starts) return starts;
    }
    return null;
  }

  // ---------- setting values ----------

  const setNative = (el, value) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  };
  const fire = (el, ...types) => types.forEach((t) => el.dispatchEvent(new Event(t, { bubbles: true })));

  function chooseOption(select, value, patterns) {
    const opts = [...select.options].filter((o) => o.value !== "" && !/^(select|choose|--)/i.test(o.text.trim()));
    const want = norm(value).replace(/&/g, "and");
    const text = (o) => norm(o.text).replace(/&/g, "and");
    let hit =
      opts.find((o) => text(o) === want || norm(o.value) === want) ||
      (patterns ? opts.find((o) => patterns.some((p) => p.test(text(o)))) : null) ||
      (want.length > 2 ? opts.find((o) => text(o).startsWith(want) || want.startsWith(text(o))) : null);
    if (!hit && want === "united states") hit = opts.find((o) => /united states|^usa$|america/.test(text(o)));
    if (!hit && want === "united kingdom") hit = opts.find((o) => /united kingdom|^uk$|britain|england/.test(text(o)));
    if (!hit) return false;
    setNative(select, hit.value);
    hit.selected = true;
    fire(select, "input", "change");
    return true;
  }

  function setField(el, value) {
    if (value === undefined || value === null || value === "" || el.disabled) return false;
    // Date and time pickers are often read-only text boxes: they still take the value.
    el.focus?.();
    setNative(el, String(value));
    fire(el, "input", "keyup", "change");
    el.blur?.();
    fire(el, "blur");
    return el.value !== "";
  }

  // ---------- dates and times ----------

  let dateFormat = "dd/mm/yyyy";
  let timeFormat = "12h";

  function formatDate(key, el) {
    if (!key) return "";
    const [y, m, d] = key.split("-");
    if (el.type === "date") return key;
    const hint = (el.getAttribute("data-date-format") || el.getAttribute("data-format") || el.placeholder || "").toLowerCase();
    let fmt = dateFormat;
    if (/yyyy-mm-dd/.test(hint)) fmt = "yyyy-mm-dd";
    else if (/dd-mm-yyyy/.test(hint)) fmt = "dd-mm-yyyy";
    else if (/dd\/mm\/yyyy/.test(hint)) fmt = "dd/mm/yyyy";
    else if (/mm\/dd\/yyyy/.test(hint)) fmt = "mm/dd/yyyy";
    return fmt.replace("yyyy", y).replace("mm", m).replace("dd", d);
  }

  /** "14:05" for a time box or when set to 24 hours; otherwise "02:05 PM", as most time pickers show it. */
  function formatTime(hhmm, el) {
    if (!hhmm) return "";
    if (el.type === "time" || timeFormat === "24h") return hhmm;
    const [h, m] = hhmm.split(":").map(Number);
    return `${String(((h + 11) % 12) + 1).padStart(2, "0")}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  }

  // ---------- ID photos ----------

  function toFile(f) {
    const [meta, b64] = f.dataUrl.split(",");
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return new File([bytes], f.name, { type: (meta.match(/data:([^;]+)/) || [])[1] || "image/jpeg" });
  }

  function attach(input, files) {
    if (!input || input.type !== "file" || !files.length) return 0;
    const dt = new DataTransfer();
    for (const f of input.multiple ? files : files.slice(0, 1)) dt.items.add(toFile(f));
    input.files = dt.files;
    fire(input, "input", "change");
    return dt.files.length;
  }

  // ---------- the panel ----------

  const host = document.createElement("div");
  host.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647;";
  const shadow = host.attachShadow({ mode: "open" });
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  function panel(html) {
    shadow.innerHTML = `<style>
      .p{width:340px;max-height:70vh;overflow:auto;background:#fff;color:#0f172a;border-radius:14px;box-shadow:0 12px 40px rgba(15,23,42,.3);font:14px/1.4 system-ui,sans-serif;border:1px solid #e2e8f0}
      .h{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 14px;background:#2548eb;color:#fff;border-radius:14px 14px 0 0;font-weight:700}
      .b{padding:12px 14px}.b p{margin:0 0 8px}.ok{color:#047857;font-weight:600}.warn{background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:8px 10px;margin:8px 0}
      ul{margin:4px 0 8px;padding-left:18px}button,select{font:inherit}button{cursor:pointer;border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:5px 10px}
      .x{background:transparent;border:0;color:#fff;font-size:18px;padding:0 4px}.row{display:flex;gap:6px;align-items:center;justify-content:space-between;padding:3px 0;border-top:1px solid #f1f5f9;font-size:13px}
      .row span:first-child{color:#64748b;width:110px;flex:none}.row span:nth-child(2){flex:1;word-break:break-word}.small{font-size:12px;color:#64748b}
    </style><div class="p"><div class="h"><span>Pathik helper</span><button class="x" id="close" title="Close">×</button></div><div class="b">${html}</div></div>`;
    shadow.getElementById("close").onclick = () => host.remove();
    if (!host.isConnected) document.documentElement.appendChild(host);
  }

  function highlight(el, ok) {
    el.style.outline = ok ? "2px solid #10b981" : "2px solid #f59e0b";
    el.style.outlineOffset = "1px";
  }

  // ---------- filling ----------

  async function waitFor(test, ms = 4000, step = 150) {
    for (let t = 0; t < ms; t += step) {
      const v = test();
      if (v) return v;
      await sleep(step);
    }
    return test();
  }

  const looksLikeAddGuest = () => {
    const f = labelledFields();
    return !!(pick(f, MAIN.firstName) && (pick(f, MAIN.roomNumber) || pick(f, MAIN.adults) || pick(f, MAIN.zipCode)));
  };

  async function fill(pending) {
    const { record: r, files = [] } = pending;
    const g = r.guest;
    const s = r.stay || {};
    const filled = [];
    const notFilled = [];
    const fields = labelledFields();

    const put = async (name, value, how) => {
      const f = pick(fields, MAIN[name]);
      if (!f) return;
      let ok = false;
      if (how === "skip") return;
      if (f.el instanceof HTMLSelectElement) {
        const patterns = name === "docType" ? DOC_TYPES[value] : name === "vehicleType" ? VEHICLES[value || "none"] : null;
        ok = value || name === "vehicleType" ? chooseOption(f.el, value || "none", patterns) : false;
      } else if (f.el.type === "file") {
        return;
      } else if (/date/i.test(name)) ok = setField(f.el, formatDate(value, f.el));
      else if (/time/i.test(name)) ok = setField(f.el, formatTime(value, f.el));
      else ok = setField(f.el, value);
      highlight(f.el, ok);
      (ok ? filled : notFilled).push(f.labelText.replace(/[*:]/g, "").trim());
    };

    // Country first: the list of states usually loads after it is chosen.
    await put("country", g.country);
    const stateField = pick(labelledFields(), MAIN.state);
    if (stateField?.el instanceof HTMLSelectElement) await waitFor(() => stateField.el.options.length > 1, 5000);
    await put("state", g.state);

    for (const [name, value] of [
      ["firstName", g.firstName],
      ["middleName", g.middleName],
      ["lastName", g.lastName],
      ["company", g.company],
      ["address", g.address],
      ["locality", g.locality],
      ["city", g.city],
      ["district", g.district],
      ["zipCode", g.zipCode],
      ["dateOfBirth", g.dateOfBirth],
      ["mobile", g.mobile],
      ["phone", g.phone],
      ["email", g.email],
      ["docType", g.docType],
      ["docNumber", g.docNumber],
    ]) {
      await put(name, value);
    }
    if (r.stay) {
      for (const [name, value] of [
        ["comingFrom", s.comingFrom],
        ["goingTo", s.goingTo],
        ["roomNumber", s.roomNumber],
        ["checkInDate", s.checkInDate],
        ["checkInTime", s.checkInTime],
        ["checkOutDate", s.checkOutDate],
        ["checkOutTime", s.checkOutTime],
        ["children", String(s.children)],
        ["vehicleType", s.vehicleType],
        ["vehicleNumber", s.vehicleNumber],
      ]) {
        await put(name, value);
      }
    }

    // The guest's ID copies (never Aadhaar: that photo is added by hand).
    const imageField = pick(fields, MAIN.docImage);
    const guestFiles = files.filter((f) => f.person === null);
    let attached = 0;
    if (imageField && guestFiles.length) {
      attached = attach(imageField.el, guestFiles);
      highlight(imageField.el, attached > 0);
    }

    // Number of adults last: Pathik then adds a block for each extra adult, which we fill too.
    const before = new Set(labelledFields().map((f) => f.el));
    const others = r.others || [];
    const otherNotes = [];
    if (r.stay) {
      await put("adults", String(s.adults));
      if (others.length) {
        // "Fill again" uses the blocks found the first time.
        let blocks = savedBlocks?.every((b) => b.every((f) => f.el.isConnected)) ? savedBlocks : await waitFor(() => extraBlocks(before), 3000);
        if (!blocks || !blocks.length) {
          // Some forms add people with a button instead.
          const addBtn = [...document.querySelectorAll("button, a, input[type=button]")].find((b) => /add\s+(more\s+)?(person|guest|member|adult)/i.test(b.textContent || b.value || ""));
          if (addBtn) {
            for (let i = 0; i < others.length; i++) {
              addBtn.click();
              await sleep(400);
            }
            blocks = await waitFor(() => extraBlocks(before), 3000);
          }
        }
        savedBlocks = blocks;
        others.forEach((o, i) => {
          const block = blocks?.[i];
          if (!block) {
            otherNotes.push(`${o.fullName}: no place for this adult was found`);
            return;
          }
          const missed = fillOther(block, o, files.filter((f) => f.person === o.fullName || f.person === [o.firstName, o.middleName, o.lastName].filter(Boolean).join(" ")));
          if (missed.length) otherNotes.push(`${o.fullName}: ${missed.join(", ")}`);
        });
      }
    }

    // Required fields still empty (the other adults' are listed under their names).
    const inBlocks = new Set((savedBlocks || []).flat().map((f) => f.el));
    const emptyRequired = labelledFields()
      .filter((f) => /\*/.test(f.labelText) && f.el.type !== "file" && !f.el.value && !inBlocks.has(f.el))
      .map((f) => {
        highlight(f.el, false);
        return f.labelText.replace(/[*:]/g, "").trim();
      });

    show(r, { filled: filled.length, attached, emptyRequired, otherNotes, skipped: r.skippedFiles || [] });
    chrome.runtime.sendMessage({ type: "pathik:refresh" }).catch(() => undefined);
  }

  /** The fields Pathik added for the extra adults, split into one group per person. */
  function extraBlocks(before) {
    const fresh = labelledFields().filter((f) => !before.has(f.el));
    if (!fresh.length) return null;
    const groups = [];
    let current = null;
    for (const f of fresh) {
      const k = f.key;
      // A label seen again in the same group starts the next person.
      if (!current || current.some((x) => x.key === k)) {
        current = [];
        groups.push(current);
      }
      current.push(f);
    }
    return groups;
  }

  function fillOther(block, o, files) {
    const missed = [];
    const put = (names, value, patterns) => {
      const f = pick(block, names);
      if (!f) return null;
      let ok;
      if (f.el instanceof HTMLSelectElement) ok = value ? chooseOption(f.el, value, patterns) : false;
      else if (f.el.type === "file") return f;
      else ok = setField(f.el, value);
      highlight(f.el, ok);
      if (!ok && /\*/.test(f.labelText)) missed.push(f.labelText.replace(/[*:]/g, "").trim());
      return f;
    };
    if (pick(block, OTHER.firstName)) {
      put(OTHER.firstName, o.firstName);
      put(OTHER.middleName, o.middleName);
      put(OTHER.lastName, o.lastName);
    } else {
      put(OTHER.fullName, o.fullName);
    }
    put(OTHER.mobile, o.mobile);
    put(OTHER.docType, o.docType, DOC_TYPES[o.docType]);
    put(OTHER.docNumber, o.docNumber);
    const image = pick(block, OTHER.docImage);
    if (image && files.length) highlight(image.el, attach(image.el, files) > 0);
    for (const f of block) {
      if (/\*/.test(f.labelText) && f.el.type !== "file" && !f.el.value && !missed.includes(f.labelText.replace(/[*:]/g, "").trim())) {
        highlight(f.el, false);
        missed.push(f.labelText.replace(/[*:]/g, "").trim());
      }
    }
    return missed;
  }

  function copyRows(r) {
    const g = r.guest;
    const s = r.stay;
    const rows = [
      ["First name", g.firstName],
      ["Last name", g.lastName],
      ["Address", g.address],
      ["Locality", g.locality],
      ["City", g.city],
      ["District", g.district],
      ["PIN code", g.zipCode],
      ["State", g.state],
      ["Date of birth", g.dateOfBirth && g.dateOfBirth.split("-").reverse().join("/")],
      ["Mobile", g.mobile],
      ["Email", g.email],
      ["Document no.", g.docNumber],
    ];
    if (s) rows.push(["Room", s.roomNumber], ["Coming from", s.comingFrom], ["Going to", s.goingTo], ["Vehicle no.", s.vehicleNumber]);
    (r.others || []).forEach((o, i) => rows.push([`Adult ${i + 2}`, o.fullName]));
    return rows.filter(([, v]) => v);
  }

  function show(r, res) {
    const rows = copyRows(r);
    panel(`
      <p><b>${esc(r.title)}</b></p>
      <p class="ok">✓ ${res.filled} fields filled${res.attached ? `, ${res.attached} ID ${res.attached === 1 ? "copy" : "copies"} attached` : ""}${r.others?.length ? `, ${r.others.length + 1} adults` : ""}.</p>
      ${r.byHand?.length ? `<div class="warn"><b>Add by hand:</b> ${esc(r.byHand.join("; "))}</div>` : ""}
      ${res.emptyRequired.length ? `<div class="warn"><b>Still empty (amber):</b><ul>${res.emptyRequired.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
      ${res.otherNotes.length ? `<div class="warn"><b>Other adults:</b><ul>${res.otherNotes.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
      ${res.skipped.length ? `<div class="warn">Not attached (not a photo, or could not be opened): ${esc(res.skipped.join(", "))}. Attach a JPG or PNG by hand.</div>` : ""}
      <p class="small">Check every field (green = filled), then press <b>Submit</b> on the Pathik page. Afterwards mark the stay as entered in Hotel Manager.</p>
      <p class="small">Dates wrong? Date format:
        <select id="df">${["dd/mm/yyyy", "dd-mm-yyyy", "yyyy-mm-dd", "mm/dd/yyyy"].map((f) => `<option ${f === dateFormat ? "selected" : ""}>${f}</option>`).join("")}</select>
        Time: <select id="tf">${[["12h", "02:05 PM"], ["24h", "14:05"]].map(([v, t]) => `<option value="${v}" ${v === timeFormat ? "selected" : ""}>${t}</option>`).join("")}</select>
        <button id="again">Fill again</button></p>
      <details><summary class="small">Copy details one by one</summary>${rows
        .map(([k, v], i) => `<div class="row"><span>${esc(k)}</span><span>${esc(v)}</span><button data-i="${i}">Copy</button></div>`)
        .join("")}</details>`);
    shadow.querySelectorAll("button[data-i]").forEach((b) => {
      b.onclick = () => navigator.clipboard.writeText(rows[Number(b.dataset.i)][1]).then(() => (b.textContent = "Copied"));
    });
    shadow.getElementById("again").onclick = async () => {
      dateFormat = shadow.getElementById("df").value;
      timeFormat = shadow.getElementById("tf").value;
      await chrome.storage.local.set({ dateFormat, timeFormat });
      fill(current);
    };
  }

  let current = null;
  let savedBlocks = null;

  async function start() {
    const opts = await chrome.storage.local.get(["dateFormat", "timeFormat"]);
    dateFormat = opts.dateFormat || dateFormat;
    timeFormat = opts.timeFormat || timeFormat;
    const { pending } = await chrome.runtime.sendMessage({ type: "pathik:peek" });
    if (!pending) return;
    // Wait for the form (it may be drawn by scripts after the page loads).
    const ready = await waitFor(looksLikeAddGuest, 6000, 250);
    if (!ready) {
      panel(`<p><b>${esc(pending.record.title)}</b> is waiting to be filled in.</p>
        <p>Sign in to Pathik if it asks, then open <b>Add Guest</b>. The form is filled in as soon as it opens.</p>
        <p><a href="https://pathik.guru/dashboard/add">Open Add Guest</a></p>`);
      return;
    }
    const taken = (await chrome.runtime.sendMessage({ type: "pathik:take" })).pending;
    if (!taken) return;
    current = taken;
    await fill(taken);
  }

  start().catch((e) => panel(`<p>Pathik helper could not fill the form: ${esc(e?.message || e)}</p>`));
})();
