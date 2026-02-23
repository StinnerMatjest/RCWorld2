import { NextResponse } from "next/server";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

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

    const publicUrl = `https://pub-${process.env.R2_PUBLIC_BUCKET_ID}.r2.dev/${fileName}`;
    return NextResponse.json({ imagePath: publicUrl }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { url } = await request.json();
    if (!url) return NextResponse.json({ error: "No URL" }, { status: 400 });

    const fileName = url.split("/").pop();

    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME || "themeparks",
        Key: fileName,
      })
    );

    return NextResponse.json({ message: "Deleted" }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}