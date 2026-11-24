import { NextResponse } from "next/server";
import { S3Client, DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pool } from "@/app/lib/db";
import { VARIANT_WIDTHS, VARIANT_QUALITY, variantKey } from "@/app/lib/imageVariants";

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

/**
 * The three files of a clip, made with the bundled ffmpeg: the clip at its own size
 * in H.264 (CRF 22), a 1080 px copy (CRF 23, 30 fps) and a poster frame (webp, 1200 px).
 * Fast presets: this runs inside the upload request.
 */
async function transcodeClip(input: Buffer, fileName: string): Promise<{ full: Buffer; inline: Buffer; poster: Buffer }> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "clip-"));
  const src = path.join(dir, "in" + path.extname(fileName).replace(/\.mp4$/, ".bin"));
  const full = path.join(dir, "full.mp4"), inline = path.join(dir, "inline.mp4"), poster = path.join(dir, "poster.webp");
  const run = (args: string[]) => new Promise<void>((resolve, reject) => {
    execFile(ffmpegPath as string, ["-y", "-loglevel", "error", ...args], { maxBuffer: 1 << 20 }, (err, _out, stderr) => (err ? reject(new Error(stderr || err.message)) : resolve()));
  });
  try {
    await fs.writeFile(src, input);
    await run(["-i", src, "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "5.1", "-c:a", "aac", "-b:a", "160k", "-ac", "2", "-movflags", "+faststart", full]);
    await run(["-i", src, "-vf", "scale='if(gt(iw,ih),min(1920,iw),-2)':'if(gt(iw,ih),-2,min(1920,ih))',fps=30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.1", "-c:a", "aac", "-b:a", "128k", "-ac", "2", "-movflags", "+faststart", inline]);
    await run(["-ss", "0.5", "-i", src, "-frames:v", "1", "-vf", "scale='if(gt(iw,ih),min(1200,iw),-2)':'if(gt(iw,ih),-2,min(1200,ih))'", "-q:v", "80", poster]);
    return { full: await fs.readFile(full), inline: await fs.readFile(inline), poster: await fs.readFile(poster) };
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

function slugify(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

// --- UPLOAD LOGIC ---
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const title = formData.get("title")?.toString() ?? "image";

    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const safeTitle = slugify(title);
    const timestamp = Date.now().toString().slice(-6);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const isVideo = file.type.startsWith("video/") || /^(mp4|mov|webm|m4v|hevc)$/i.test(ext);
    const fileName = isVideo ? `${safeTitle}-${timestamp}.mp4` : `${safeTitle}-${timestamp}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    let buffer: Buffer = Buffer.from(arrayBuffer);
    let contentType = file.type;

    // A clip becomes three files (see app/lib/videoFiles.ts): the clip itself re-encoded
    // to H.264 at its full size, a 1080 px copy for playing in a page, and a poster frame.
    // Phones upload HEVC at 60 Mbit/s; stored as they come, one visit added a gigabyte to its page.
    let extras: { Key: string; Body: Buffer; ContentType: string }[] = [];
    if (isVideo) {
      try {
        const made = await transcodeClip(buffer, fileName);
        buffer = made.full; contentType = "video/mp4";
        extras = [
          { Key: fileName.replace(/\.mp4$/, "-w1080.mp4"), Body: made.inline, ContentType: "video/mp4" },
          { Key: fileName.replace(/\.mp4$/, "-poster.webp"), Body: made.poster, ContentType: "image/webp" },
        ];
      } catch (err) {
        console.error("Clip transcoding failed for", fileName, err);
        return NextResponse.json({ error: "The clip could not be converted. Try a shorter clip, or an MP4 in H.264." }, { status: 422 });
      }
    }

    const parallelUploads = new Upload({
      client: s3Client,
      params: {
        Bucket: process.env.R2_BUCKET_NAME || "themeparks",
        Key: fileName,
        Body: buffer,
        ContentType: contentType,
        // File names carry a UUID, so a URL never changes content: cache forever.
        CacheControl: "public, max-age=31536000, immutable",
      },
    });

    await parallelUploads.done();
    for (const x of extras) {
      await s3Client.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME || "themeparks", ...x, CacheControl: "public, max-age=31536000, immutable" }));
    }

    // Pre-generated sizes next to the original, so pages never resize on the fly
    // (see app/lib/imageVariants.ts). Best effort: a failure here must not fail the upload.
    if (file.type.startsWith("image/")) {
      try {
        const img = sharp(buffer, { failOn: "none" }).rotate();
        // Record the photo's pixel size so pages can pick the exact file to
        // serve for a given frame instead of guessing (see app/lib/imageDims.ts).
        const meta = await sharp(buffer, { failOn: "none" }).metadata();
        if (meta.width && meta.height) {
          const swap = (meta.orientation ?? 1) >= 5;
          await pool.query(
            "INSERT INTO image_dimensions (key, width, height) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET width = EXCLUDED.width, height = EXCLUDED.height",
            [fileName, swap ? meta.height : meta.width, swap ? meta.width : meta.height]
          );
        }
        for (const w of VARIANT_WIDTHS) {
          const out = await img.clone().resize({ width: w, withoutEnlargement: true }).webp({ quality: VARIANT_QUALITY[w] }).toBuffer();
          await s3Client.send(new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME || "themeparks",
            Key: variantKey(fileName, w),
            Body: out,
            ContentType: "image/webp",
            CacheControl: "public, max-age=31536000, immutable",
          }));
        }
      } catch (err) {
        console.error("Image variant generation failed for", fileName, err);
      }
    }

    const publicUrl = `https://pub-${process.env.R2_PUBLIC_BUCKET_ID}.r2.dev/${fileName}`;
    return NextResponse.json({ imagePath: publicUrl }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { url } = await request.json();
    if (!url) return NextResponse.json({ error: "No URL" }, { status: 400 });

    const fileName = url.split("/").pop();

    const Bucket = process.env.R2_BUCKET_NAME || "themeparks";
    await s3Client.send(new DeleteObjectCommand({ Bucket, Key: fileName }));
    // Variants go with the original (ignore misses: videos and older files have none).
    await Promise.allSettled(VARIANT_WIDTHS.map(w => s3Client.send(new DeleteObjectCommand({ Bucket, Key: variantKey(fileName, w) }))));
    await pool.query("DELETE FROM image_dimensions WHERE key = $1", [fileName]).catch(() => {});

    return NextResponse.json({ message: "Deleted" }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}