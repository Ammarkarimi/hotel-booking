// Packs the pathik-helper folder (the Chrome add-on that fills Pathik) into public/pathik-helper.zip,
// so hotels can download it from Settings. Runs on every build. The add-on is allowed on this
// deployment's own address too (Vercel sets VERCEL_PROJECT_PRODUCTION_URL), so it works on a custom domain.
//   node scripts/build-pathik-zip.mjs
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const SRC = "pathik-helper";
const OUT = "public/pathik-helper.zip";

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** A plain zip (files stored, not compressed): small text files, and every unzip tool reads it. */
export function zip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt16LE(0, 10); // time
    local.writeUInt16LE(0x5b61, 12); // date: 2025-11-01
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x5b61, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, end]);
}

const entries = readdirSync(SRC)
  .filter((f) => !f.startsWith("."))
  .sort()
  .map((f) => {
    let data = readFileSync(path.join(SRC, f));
    if (f === "manifest.json") {
      const manifest = JSON.parse(data.toString("utf8"));
      const site = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.APP_DOMAIN;
      if (site) {
        const match = `https://${site.replace(/^https?:\/\//, "").replace(/\/.*$/, "")}/*`;
        const bridge = manifest.content_scripts[0];
        if (!bridge.matches.includes(match)) bridge.matches.push(match);
      }
      data = Buffer.from(JSON.stringify(manifest, null, 2) + "\n", "utf8");
    }
    return { name: `pathik-helper/${f}`, data };
  });

writeFileSync(OUT, zip(entries));
console.log(`▶ Pathik helper packed: ${OUT} (${entries.length} files)`);
