import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { pool, loadPrompt } from "../db";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SCORE_MAP: Record<string, string> = {
  parkAppearance: "parkappearance",
  bestCoaster: "bestcoaster",
  coasterDepth: "coasterdepth",
  waterRides: "waterrides",
  flatridesAndDarkrides: "flatridesanddarkrides",
  food: "food",
  snacksAndDrinks: "snacksanddrinks",
  parkPracticality: "parkpracticality",
  rideOperations: "rideoperations",
  parkManagement: "parkmanagement",
  overall: "overall",
};

function displayCategory(cat: string): string {
  return cat.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()).trim();
}

function boldScore(s: string): string {
  const map: Record<string, string> = { "0":"𝟎","1":"𝟏","2":"𝟐","3":"𝟑","4":"𝟒","5":"𝟓","6":"𝟔","7":"𝟕","8":"𝟖","9":"𝟗" };
  return s.replace(/\d/g, (d: string) => map[d] ?? d);
}

export async function POST(req: Request) {
  const { park_id, category } = await req.json() as { park_id: number; category: string };

  try {
    const scoreCol = SCORE_MAP[category] ?? null;
    const result = await pool.query(`
      SELECT pt.text, p.name AS park_name, p.country,
             r.parkappearance, r.bestcoaster, r.coasterdepth, r.waterrides,
             r.flatridesanddarkrides, r.food, r.snacksanddrinks,
             r.parkpracticality, r.rideoperations, r.parkmanagement, r.overall
      FROM parktexts pt
      JOIN ratings r ON r.id = pt.rating_id
      JOIN parks p ON p.id = r.park_id
      WHERE r.park_id = $1 AND pt.category = $2 AND r.published = TRUE
      ORDER BY r.id DESC
      LIMIT 1
    `, [park_id, category]);

    if (!result.rows[0]) {
      return NextResponse.json({ error: "No review text found for this park and category" }, { status: 404 });
    }

    const p = result.rows[0];
    const score = scoreCol ? p[scoreCol] : null;
    const catDisplay = displayCategory(category);

    const systemPrompt = await loadPrompt();
    const postData = `POST 1: ${p.park_name} (${p.country}) · ${catDisplay}${score != null ? ` · ${score}/10` : ""}
Review text: "${p.text}"`;

    const prompt = `${systemPrompt}

---
${postData}

JSON: { "posts": [ { "post_index": 1, "caption": "...", "hashtags": "...", "reasoning": "..." } ] }`;

    const aiRes = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const rawContent = aiRes.content[0].type === "text" ? aiRes.content[0].text : "";
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in Claude response");
    const { posts } = JSON.parse(jsonMatch[0]);
    const pick = posts[0];
    if (!pick) throw new Error("No post generated");

    const caption = pick.caption.replace(/(\d+)\/10/g, (_: string, n: string) => `${boldScore(n)}/𝟏𝟎`);
    return NextResponse.json({ caption, hashtags: pick.hashtags, reasoning: pick.reasoning });
  } catch (e) {
    console.error("generate-single error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
