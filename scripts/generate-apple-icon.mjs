// One-shot: render src/app/icon.svg into a 180x180 PNG for apple-icon.
// Next.js 14 requires apple-icon to be a raster (jpg/jpeg/png), not SVG.
// Generates src/app/apple-icon.png so iOS picks it up automatically.
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const svg = readFileSync("src/app/icon.svg", "utf8");
const png = await sharp(Buffer.from(svg))
  .resize(180, 180, { fit: "cover" })
  .png()
  .toBuffer();

const out = "src/app/apple-icon.png";
writeFileSync(out, png);
console.log(`Wrote ${out} (${png.length} bytes, 180x180)`);
