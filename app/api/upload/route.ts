import { NextResponse } from "next/server";
import { S3Client, DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import sharp from "sharp";
import { VARIANT_WIDTHS, VARIANT_QUALITY, variantKey } from "@/app/lib/imageVariants";

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

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
    const fileName = `${safeTitle}-${timestamp}.${ext}`;
    
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const parallelUploads = new Upload({
      client: s3Client,
      params: {
        Bucket: process.env.R2_BUCKET_NAME || "themeparks",
        Key: fileName,
        Body: buffer,
        ContentType: file.type,
      },
    });

    await parallelUploads.done();

    // Pre-generated sizes next to the original, so pages never resize on the fly
    // (see app/lib/imageVariants.ts). Best effort: a failure here must not fail the upload.
    if (file.type.startsWith("image/")) {
      try {
        const img = sharp(buffer, { failOn: "none" }).rotate();
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

    return NextResponse.json({ message: "Deleted" }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}