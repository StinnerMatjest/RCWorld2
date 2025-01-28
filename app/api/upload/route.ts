import { NextResponse } from "next/server";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: Request) {
    try {
      const formData = await request.formData();
      const file = formData.get("file") as File;
  
      if (!file) {
        console.error("No file uploaded");
        return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
      }
  
      console.log("File received:", {
        name: file.name,
        size: file.size,
        type: file.type,
      });
  
      // Generate a unique file name
      const fileName = `${uuidv4()}-${file.name}`;
  
      // Create the S3 client
      const s3Client = new S3Client({
        region: "auto",
        endpoint: `https://pub-ea1e61b5d5614f95909efeacb8943e78.r2.dev`,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID!,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
      });
  
      // Create the upload command
      const parallelUploads = new Upload({
        client: s3Client,
        params: {
          Bucket: process.env.R2_BUCKET_NAME!,
          Key: fileName,
          Body: file.stream(),
          ACL: "public-read",
          ContentType: file.type,
        },
        queueSize: 4,
        leavePartsOnError: false, 
      });
  
      const res = await parallelUploads.done();
  

      console.log("Upload successful:", res);
      const publicUrl = `https://pub-ea1e61b5d5614f95909efeacb8943e78.r2.dev/${fileName}`;
  
      return NextResponse.json({ imagePath: publicUrl }, { status: 200 });
    } catch (error) {
      console.error("Error uploading file to R2:", error);
      return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
    }
  }
