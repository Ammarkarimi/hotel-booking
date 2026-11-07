// Makes the installed app's icons (public/icons/) from the logo in src/app/icon.svg.
// Run again after changing the logo: node scripts/make-app-icons.mjs
import { readFile } from "node:fs/promises";
import sharp from "sharp";

const svg = await readFile(new URL("../src/app/icon.svg", import.meta.url), "utf8");
const out = (name) => new URL(`../public/icons/${name}`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

// Normal icons: the logo as it is (rounded square).
for (const size of [192, 512]) {
  await sharp(Buffer.from(svg), { density: 600 }).resize(size, size).png().toFile(out(`icon-${size}.png`));
}

// "Maskable" icon for phones that cut icons into circles or other shapes: a full square of the
// logo's background with the mark kept inside the middle 60%, so nothing important is cut off.
const mark = svg.replace(/<rect[^>]*\/>/, "");
const inner = await sharp(Buffer.from(mark), { density: 600 }).resize(300, 300).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#0f172a" } })
  .composite([{ input: inner, gravity: "center" }])
  .png()
  .toFile(out("maskable-512.png"));
console.log("Icons written to public/icons/");
