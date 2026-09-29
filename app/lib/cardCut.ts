import sharp from "sharp";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { r2 } from "@/app/library/r2";
import { pool } from "@/app/lib/db";
import { getImageSizes, r2KeyOf } from "@/app/lib/imageDims";
import { CARD_CUT, cardCutFor, cardCutKey, planCardCut } from "@/app/lib/cardCutGeometry";

/** A saved card cut, stored on the park row (card_cut) or inside a card_images entry (cut). */
export type CardCut = { url: string; focus: string; w: number; h: number; for: string };

const Bucket = process.env.R2_BUCKET_NAME || "themeparks";
const publicUrl = (key: string) => `https://pub-${process.env.R2_PUBLIC_BUCKET_ID}.r2.dev/${key}`;

/**
 * Make the cut for one photo + framing. Returns null when the photo is not
 * wide enough to need one. Fetches the original from R2, so it costs a few
 * seconds for a large photo; callers run it after responding to the admin.
 */
export async function generateCardCut(src: string, focusStr: string | null | undefined, size: { w: number; h: number }): Promise<CardCut | null> {
  const key = r2KeyOf(src);
  if (!key) return null;
  const plan = planCardCut(size, focusStr);
  if (!plan) return null;

  const res = await fetch(src);
  if (!res.ok) throw new Error(`fetch ${src}: HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());

  // rotate() applies EXIF orientation so the extract rectangle is in the same
  // space as the recorded (oriented) size and as what browsers display.
  const out = await sharp(buffer, { failOn: "none" })
    .rotate()
    .extract({ left: plan.x, top: plan.y, width: plan.cw, height: plan.ch })
    .resize({ width: plan.outW, height: plan.outH, withoutEnlargement: true })
    .webp({ quality: CARD_CUT.quality })
    .toBuffer();

  const cutKey = cardCutKey(key, plan);
  await r2.send(new PutObjectCommand({
    Bucket, Key: cutKey, Body: out, ContentType: "image/webp",
    CacheControl: "public, max-age=31536000, immutable",
  }));
  return { url: publicUrl(cutKey), focus: plan.focus, w: plan.outW, h: plan.outH, for: cardCutFor(src, focusStr) };
}

export async function deleteCardCut(cut: CardCut | null | undefined): Promise<void> {
  const key = cut ? r2KeyOf(cut.url) : null;
  if (!key) return;
  await r2.send(new DeleteObjectCommand({ Bucket, Key: key })).catch(() => {});
}

type ParkRow = {
  id: number;
  imagepath: string | null;
  card_imagepath: string | null;
  image_focus: string | null;
  card_images: Record<string, { src?: string; focus?: string; cut?: CardCut }> | null;
  card_cut: CardCut | null;
};

/**
 * Bring a park's cuts in line with its current card framing: generate what is
 * missing or stale, delete what is no longer used, and record the result.
 * Safe to run repeatedly; a cut whose `for` matches is left alone.
 */
export async function regenerateParkCuts(park: ParkRow): Promise<{ made: number; deleted: number }> {
  const cardSrc = park.card_imagepath || park.imagepath;
  const focus = park.image_focus || "0.5 0.5 1";
  const entries = Object.entries(park.card_images ?? {}).filter(([, e]) => e?.src) as [string, { src: string; focus?: string; cut?: CardCut }][];

  const sizes = await getImageSizes([cardSrc, ...entries.map(([, e]) => e.src)]);
  let made = 0, deleted = 0;

  // Main card image.
  if (cardSrc) {
    const want = cardCutFor(cardSrc, focus);
    if (park.card_cut?.for !== want) {
      const size = sizes[cardSrc];
      const cut = size ? await generateCardCut(cardSrc, focus, size) : null;
      if (cut) made++;
      await pool.query("UPDATE parks SET card_cut = $1 WHERE id = $2", [cut ? JSON.stringify(cut) : null, park.id]);
      if (park.card_cut && park.card_cut.url !== cut?.url) { await deleteCardCut(park.card_cut); deleted++; }
    }
  } else if (park.card_cut) {
    await pool.query("UPDATE parks SET card_cut = NULL WHERE id = $1", [park.id]);
    await deleteCardCut(park.card_cut); deleted++;
  }

  // Category images, one at a time so a concurrent admin save of card_images
  // is never overwritten wholesale: the cut is set only if that entry still
  // shows the same photo.
  for (const [cat, e] of entries) {
    const want = cardCutFor(e.src, e.focus);
    if (e.cut?.for === want) continue;
    const size = sizes[e.src];
    const cut = size ? await generateCardCut(e.src, e.focus, size) : null;
    if (cut) made++;
    await pool.query(
      `UPDATE parks
         SET card_images = jsonb_set(card_images, $1::text[], $2::jsonb, true)
       WHERE id = $3 AND card_images->$4->>'src' = $5`,
      [[cat, "cut"], JSON.stringify(cut), park.id, cat, e.src]
    );
    if (e.cut && e.cut.url !== cut?.url) { await deleteCardCut(e.cut); deleted++; }
  }

  return { made, deleted };
}

/** A cut is only usable if it was made for exactly this photo and framing. */
export function validCut(cut: CardCut | null | undefined, src: string | null | undefined, focusStr: string | null | undefined): CardCut | undefined {
  if (!cut || !src) return undefined;
  return cut.for === cardCutFor(src, focusStr) ? cut : undefined;
}
