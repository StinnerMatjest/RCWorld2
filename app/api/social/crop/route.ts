import { NextResponse } from "next/server";
import { Upload } from "@aws-sdk/lib-storage";
import { r2 } from "@/app/library/r2";
import sharp from "sharp";

const BUCKET = process.env.R2_BUCKET_NAME!;
const PUBLIC_BASE = `https://pub-${process.env.R2_PUBLIC_BUCKET_ID}.r2.dev`;

export async function POST(req: Request) {
  const { imageUrl, x, y, w, h, ratio, postId } = await req.json() as {
    imageUrl: string; x: number; y: number; w: number; h: number;
    ratio: "1:1" | "4:5"; postId: number;
  };

  const [outW, outH] = ratio === "4:5" ? [1080, 1350] : [1080, 1080];

  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) return NextResponse.json({ error: "Failed to fetch image" }, { status: 400 });
  const imgBuf = Buffer.from(await imgRes.arrayBuffer());

  const cropped = await sharp(imgBuf)
    .extract({ left: x, top: y, width: w, height: h })
    .resize(outW, outH)
    .jpeg({ quality: 92 })
    .toBuffer();

  const key = `social-crops/${postId}-${Date.now()}.jpg`;

  await new Upload({
    client: r2,
    params: { Bucket: BUCKET, Key: key, Body: cropped, ContentType: "image/jpeg" },
  }).done();

  return NextResponse.json({ url: `${PUBLIC_BASE}/${key}` });
}
