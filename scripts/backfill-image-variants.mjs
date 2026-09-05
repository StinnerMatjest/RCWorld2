// Create the -w480 / -w1200 / -w1920 .webp variants for every image already in the
// public R2 bucket (see app/lib/imageVariants.ts). Safe to re-run: existing
// variants are skipped. Reads R2 credentials from .env.local.
//
//   node scripts/backfill-image-variants.mjs [--dry] [--concurrency=4] [--force=1200,1920]
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const DRY = process.argv.includes("--dry");
const CONCURRENCY = Number((process.argv.find(a => a.startsWith("--concurrency=")) || "").split("=")[1] || 4);
const WIDTHS = [480, 1200, 1920];
const QUALITY = { 480: 82, 1200: 88, 1920: 90 };
// --force=1200,1920 regenerates those widths even when they already exist (e.g. after a quality change).
const FORCE = new Set(((process.argv.find(a => a.startsWith("--force=")) || "").split("=")[1] || "").split(",").filter(Boolean).map(Number));
const IMAGE_EXT = /\.(jpe?g|png|webp|heic|heif|avif|gif|tiff?)$/i;
const VARIANT_SUFFIX = /-w\d+\.webp$/i;
const Bucket = process.env.R2_BUCKET_NAME || "themeparks";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
});

async function listAll() {
  const keys = new Map();
  let ContinuationToken;
  do {
    const r = await s3.send(new ListObjectsV2Command({ Bucket, ContinuationToken }));
    for (const o of r.Contents || []) keys.set(o.Key, o.Size);
    ContinuationToken = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return keys;
}

const keys = await listAll();
const originals = [...keys.keys()].filter(k => IMAGE_EXT.test(k) && !VARIANT_SUFFIX.test(k));
const needs = (k, w) => FORCE.has(w) || !keys.has(k.replace(IMAGE_EXT, "") + `-w${w}.webp`);
const todo = originals.filter(k => WIDTHS.some(w => needs(k, w)));
console.log(`bucket objects: ${keys.size}, image originals: ${originals.length}, needing variants: ${todo.length}${DRY ? " (dry run)" : ""}`);

let done = 0, failed = 0, bytesIn = 0, bytesOut = 0;
const failures = [];
async function processKey(key) {
  const base = key.replace(IMAGE_EXT, "");
  try {
    const obj = await s3.send(new GetObjectCommand({ Bucket, Key: key }));
    const input = Buffer.from(await obj.Body.transformToByteArray());
    bytesIn += input.length;
    const img = sharp(input, { failOn: "none" }).rotate();
    for (const w of WIDTHS) {
      const vk = `${base}-w${w}.webp`;
      if (!needs(key, w)) continue;
      const out = await img.clone().resize({ width: w, withoutEnlargement: true }).webp({ quality: QUALITY[w] }).toBuffer();
      bytesOut += out.length;
      if (!DRY) {
        await s3.send(new PutObjectCommand({ Bucket, Key: vk, Body: out, ContentType: "image/webp", CacheControl: "public, max-age=31536000, immutable" }));
      }
    }
    done++;
  } catch (err) {
    failed++;
    failures.push(`${key}: ${err.message}`);
  }
  if ((done + failed) % 25 === 0) console.log(`  ${done + failed}/${todo.length} (${failed} failed) in ${(bytesIn / 1e6).toFixed(0)} MB → out ${(bytesOut / 1e6).toFixed(1)} MB`);
}

const queue = [...todo];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => { while (queue.length) await processKey(queue.shift()); }));
console.log(`\nfinished: ${done} ok, ${failed} failed. downloaded ${(bytesIn / 1e6).toFixed(0)} MB, variants ${(bytesOut / 1e6).toFixed(1)} MB`);
if (failures.length) { console.log("failures:"); for (const f of failures) console.log("  " + f); }
