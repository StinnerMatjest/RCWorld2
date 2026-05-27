import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { pool, loadPrompt } from "../db";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function boldScore(s: string): string {
  const map: Record<string,string> = {'0':'𝟎','1':'𝟏','2':'𝟐','3':'𝟑','4':'𝟒','5':'𝟓','6':'𝟔','7':'𝟕','8':'𝟖','9':'𝟗'};
  return s.replace(/\d/g, (d: string) => map[d] ?? d);
}

export async function GET() {
  const prompt = await loadPrompt();
  return Response.json({ prompt });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const customPrompt: string | undefined = body.customPrompt;
  try {
    const result = await pool.query(`
      WITH fallback_images AS (
        SELECT DISTINCT ON (park_id) park_id, path AS image_url
        FROM parkgallery
        WHERE path NOT ILIKE '%.mp4'
          AND path NOT ILIKE '%.webm'
          AND path NOT ILIKE '%.mov'
          AND title NOT ILIKE '%header%'
          AND path IS NOT NULL
        ORDER BY park_id, id
      )
      SELECT
        pt.category,
        pt.text       AS review_text,
        pt.rating_id,
        p.id          AS park_id,
        p.name        AS park_name,
        p.country,
        p.continent,
        COALESCE(pt.image_url, fi.image_url) AS image_url,
        r.parkappearance, r.bestcoaster, r.coasterdepth, r.waterrides,
        r.flatridesanddarkrides, r.food, r.snacksanddrinks,
        r.parkpracticality, r.rideoperations, r.parkmanagement, r.overall
      FROM parktexts pt
      JOIN ratings r  ON r.id  = pt.rating_id
      JOIN parks   p  ON p.id  = r.park_id
      LEFT JOIN fallback_images fi ON fi.park_id = p.id
      WHERE pt.text IS NOT NULL
        AND pt.text != ''
        AND r.published = TRUE
        AND COALESCE(pt.image_url, fi.image_url) IS NOT NULL
        AND (p.id, pt.category) NOT IN (
          SELECT park_id, category FROM social_posts
          WHERE status IN ('draft','published')
            AND created_at > NOW() - INTERVAL '21 days'
            AND category IS NOT NULL
        )
      ORDER BY RANDOM()
      LIMIT 20
    `);

    const all = result.rows;
    if (all.length === 0) return NextResponse.json({ error: "No eligible review paragraphs found" }, { status: 400 });

    const picked = all.slice(0, 3);

    const SCORE_MAP: Record<string, string> = {
      "parkAppearance": "parkappearance",   "Park Appearance": "parkappearance",
      "bestCoaster": "bestcoaster",         "Best Coaster": "bestcoaster",
      "coasterDepth": "coasterdepth",       "Coaster Depth": "coasterdepth",
      "waterRides": "waterrides",           "Water Rides": "waterrides",
      "flatridesAndDarkrides": "flatridesanddarkrides", "Flat Rides and Dark Rides": "flatridesanddarkrides", "Flat Rides & Dark Rides": "flatridesanddarkrides",
      "food": "food",                       "Food": "food",
      "snacksAndDrinks": "snacksanddrinks", "Snacks and Drinks": "snacksanddrinks", "Snacks & Drinks": "snacksanddrinks",
      "parkPracticality": "parkpracticality","Park Practicality": "parkpracticality",
      "rideOperations": "rideoperations",   "Ride Operations": "rideoperations",
      "parkManagement": "parkmanagement",   "Park Management": "parkmanagement",
      "overall": "overall",                 "Overall": "overall",
    };

    function displayCategory(cat: string): string {
      return cat.replace(/([A-Z])/g, " $1").replace(/^./, (s: string) => s.toUpperCase()).trim();
    }

    const systemPrompt = customPrompt ?? (await loadPrompt());

    const postData = picked.map((p, i) => {
      const scoreCol = SCORE_MAP[p.category] ?? null;
      const score = scoreCol ? p[scoreCol] : null;
      const catDisplay = displayCategory(p.category);
      return `POST ${i + 1}: ${p.park_name} (${p.country}) · ${catDisplay}${score != null ? ` · ${score}/10` : ""}
Review text: "${p.review_text}"`;
    }).join("\n\n");

    const prompt = `${systemPrompt}

---
${postData}

JSON: { "posts": [ { "post_index": 1, "caption": "...", "hashtags": "...", "reasoning": "..." }, ... ] }`;

    const aiRes = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const rawContent = aiRes.content[0].type === "text" ? aiRes.content[0].text : "";
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in Claude response");
    const { posts: picks } = JSON.parse(jsonMatch[0]);

    const inserted = [];
    for (const pick of picks) {
      const item = picked[pick.post_index - 1];
      if (!item) continue;
      const caption = pick.caption.replace(/(\d+)\/10/g, (_: string, n: string) => `${boldScore(n)}/𝟏𝟎`);
      const row = await pool.query(
        `INSERT INTO social_posts (caption, hashtags, image_url, park_id, park_name, category, reasoning)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [caption, pick.hashtags, item.image_url, item.park_id, item.park_name, item.category, pick.reasoning]
      );
      inserted.push(row.rows[0]);
    }

    return NextResponse.json({ posts: inserted });
  } catch (e) {
    console.error("social/generate error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
