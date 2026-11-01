// Copies the QR code reader (zxing-wasm's WebAssembly file) into /public, so the Aadhaar scanner
// loads it from this app rather than from an outside CDN. Runs after `npm install`.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";

const from = "node_modules/zxing-wasm/dist/reader/zxing_reader.wasm";
if (existsSync(from)) {
  mkdirSync("public", { recursive: true });
  copyFileSync(from, "public/zxing_reader.wasm");
}
