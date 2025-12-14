import { NextResponse } from "next/server";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

// ⬇️ helper to create safe filenames
function slugify(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const title = formData.get("title")?.toString() ?? "image"; // <-- NEW

    if (!file) {
      console.error("No file uploaded");
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // ⬇️ create readable filename
    const safeTitle = slugify(title);                          // "europa-park-silver-star"
    const timestamp = Date.now().toString().slice(-6);        // short unique suffix
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const fileName = `${safeTitle}-${timestamp}.${ext}`;      // europa-park-silver-star-728491.jpg
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const bucketName = process.env.R2_BUCKET_NAME || "themeparks";

    const s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });

    const parallelUploads = new Upload({
      client: s3Client,
      params: {
        Bucket: bucketName,
        Key: fileName,
        Body: buffer,
        ACL: "public-read",
        ContentType: file.type,
        Metadata: {
          title,
        },
      },
      queueSize: 4,
      leavePartsOnError: false,
    });

    await parallelUploads.done();

    const publicUrl = `https://pub-${process.env.R2_PUBLIC_BUCKET_ID}.r2.dev/${fileName}`;

    return NextResponse.json({ imagePath: publicUrl }, { status: 200 });
  } catch (error) {
    console.error("Error uploading file to R2:", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
