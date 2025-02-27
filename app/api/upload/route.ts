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
  
      const fileName = `${uuidv4()}-${file.name}`.replace(/\.png$/, ".PNG");
      const bucketName = process.env.R2_BUCKET_NAME || "themeparks";
      console.log("Bucket Name Used:", bucketName);
      
  
      const s3Client = new S3Client({
        region: "auto",
        endpoint: `https://5fd21b97e81f02fc66c7903d4720b3cd.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: "0714eb5f822bb1d2dfe23408a003dce9",
          secretAccessKey: "edfb844266dc7f62308725fdeaf67a5906832c99ef102ef5337eea4ce0af4980",
        },
      });
  
      const parallelUploads = new Upload({
        client: s3Client,
        params: {
          Bucket: bucketName,
          Key: fileName,
          Body: file.stream(),
          ACL: "public-read",
          ContentType: file.type,
        },
        queueSize: 4,
        leavePartsOnError: false, 
      });

      console.log("Information to send: ", parallelUploads);
  
      const res = await parallelUploads.done();
  

      console.log("Upload successful:", res);
      const publicUrl = `https://pub-ea1e61b5d5614f95909efeacb8943e78.r2.dev/${fileName}`;
  
      return NextResponse.json({ imagePath: publicUrl }, { status: 200 });
    } catch (error) {
      console.error("Error uploading file to R2:", error);
      return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
    }
  }
