import { NextResponse } from "next/server";
import { pool } from "@/app/lib/db";

// Every published park review and coaster review as one Markdown document, so an
// AI assistant (or anyone) can read the whole site in a single fetch. Linked from
// /llms.txt. Reads the DB directly; cached at the edge for an hour.
export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = {
  description:           "Overview",
  bestCoaster:           "Best Coaster",
  coasterDepth:          "Coaster Depth",
  waterRides:            "Water Rides",
  flatRidesAndDarkRides: "Flat Rides & Dark Rides",
  flatridesAndDarkrides: "Flat Rides & Dark Rides",
  parkAppearance:        "Park Appearance",
  food:                  "Food",
  snacksAndDrinks:       "Snacks & Drinks",
  parkPracticality:      "Park Practicality",
  rideOperations:        "Ride Operations",
  parkManagement:        "Park Management",
};

const SCORE_COLUMNS: [string, string][] = [
  ["bestcoaster", "Best Coaster"],
  ["coasterdepth", "Coaster Depth"],
  ["waterrides", "Water Rides"],
  ["flatridesanddarkrides", "Flat Rides & Dark Rides"],
  ["parkappearance", "Park Appearance"],
  ["food", "Food"],
  ["snacksanddrinks", "Snacks & Drinks"],
  ["parkpracticality", "Park Practicality"],
  ["rideoperations", "Ride Operations"],
  ["parkmanagement", "Park Management"],
];

function fmt(n: unknown): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return "n/a";
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export async function GET() {
  try {
    const [parksRes, parkTextsRes, coastersRes, coasterTextsRes] = await Promise.all([
      // Latest published visit per park, with its scores.
      pool.query(`
        SELECT DISTINCT ON (p.id)
          p.id, p.name, p.slug, p.country, p.city,
          v.id AS visit_id, v.date, v.overall,
          v.bestcoaster, v.coasterdepth, v.waterrides, v.flatridesanddarkrides,
          v.parkappearance, v.food, v.snacksanddrinks, v.parkpracticality,
          v.rideoperations, v.parkmanagement
        FROM parks p
        JOIN visits v ON v.park_id = p.id AND v.published = TRUE
        ORDER BY p.id, v.date DESC
      `),
      pool.query(`
        SELECT visit_id, category, text
        FROM parktexts
        WHERE text IS NOT NULL AND text <> ''
        ORDER BY id
      `),
      pool.query(`
        SELECT rc.id, rc.name, rc.slug, rc.year, rc.model, rc.rating, rc.ridecount, rc.isbestcoaster,
               p.name AS park_name, p.slug AS park_slug, m.name AS manufacturer
        FROM rollercoasters rc
        JOIN parks p ON p.id = rc.park_id
        LEFT JOIN manufacturers m ON m.id = rc.manufacturer_id
        WHERE rc.haveridden = TRUE AND rc.rating IS NOT NULL AND rc.slug IS NOT NULL
        ORDER BY rc.rating DESC, rc.name
      `),
      pool.query(`
        SELECT coaster_id, headline, text
        FROM coastertext
        WHERE text IS NOT NULL AND text <> ''
        ORDER BY coaster_id, "order", id
      `),
    ]);

    const parkTexts = new Map<number, { category: string; text: string }[]>();
    for (const r of parkTextsRes.rows) {
      const list = parkTexts.get(r.visit_id) ?? [];
      list.push({ category: r.category, text: r.text });
      parkTexts.set(r.visit_id, list);
    }
    const coasterTexts = new Map<number, { headline: string | null; text: string }[]>();
    for (const r of coasterTextsRes.rows) {
      const list = coasterTexts.get(r.coaster_id) ?? [];
      list.push({ headline: r.headline, text: r.text });
      coasterTexts.set(r.coaster_id, list);
    }

    const parks = [...parksRes.rows].sort((a, b) => Number(b.overall) - Number(a.overall));
    const out: string[] = [];

    out.push("# ParkRating — all reviews");
    out.push("");
    out.push("> Theme park and roller coaster reviews by ParkRating (https://parkrating.com), two brothers who visit and score parks across Europe. All scores are 0–10; exceptional entries can break the scale and score 11. Each park score is from the most recent published visit. Generated " + new Date().toISOString().slice(0, 10) + ".");
    out.push("");
    out.push(`## Park rankings (${parks.length} parks)`);
    out.push("");
    parks.forEach((p, i) => {
      out.push(`${i + 1}. ${p.name} (${p.country}) — ${fmt(p.overall)}/10 — https://parkrating.com/park/${p.slug}`);
    });
    out.push("");

    out.push("## Park reviews");
    out.push("");
    for (const p of parks) {
      out.push(`### ${p.name}`);
      out.push("");
      out.push(`- URL: https://parkrating.com/park/${p.slug}`);
      out.push(`- Location: ${[p.city, p.country].filter(Boolean).join(", ")}`);
      out.push(`- Overall score: ${fmt(p.overall)}/10`);
      out.push(`- Visit date: ${p.date ? new Date(p.date).toISOString().slice(0, 10) : "n/a"}`);
      out.push(`- Category scores: ${SCORE_COLUMNS.map(([col, label]) => `${label} ${fmt(p[col])}`).join(", ")}`);
      out.push("");
      const texts = parkTexts.get(p.visit_id) ?? [];
      // Overview first, then the rest in category order.
      const ordered = [
        ...texts.filter((t) => t.category === "description"),
        ...texts.filter((t) => t.category !== "description"),
      ];
      for (const t of ordered) {
        out.push(`#### ${CATEGORY_LABELS[t.category] ?? t.category}`);
        out.push("");
        out.push(t.text.trim());
        out.push("");
      }
      if (ordered.length === 0) {
        out.push("_No written review yet._");
        out.push("");
      }
    }

    const coasters = coastersRes.rows;
    out.push(`## Coaster rankings (${coasters.length} coasters ridden and rated)`);
    out.push("");
    coasters.forEach((c, i) => {
      out.push(`${i + 1}. ${c.name} at ${c.park_name} — ${fmt(c.rating)}/10 — https://parkrating.com/coasters/${c.slug}`);
    });
    out.push("");

    out.push("## Coaster reviews");
    out.push("");
    for (const c of coasters) {
      const texts = coasterTexts.get(c.id) ?? [];
      if (texts.length === 0) continue; // unreviewed coasters are listed in the rankings above only
      out.push(`### ${c.name} (${c.park_name})`);
      out.push("");
      out.push(`- URL: https://parkrating.com/coasters/${c.slug}`);
      out.push(`- Park: ${c.park_name} — https://parkrating.com/park/${c.park_slug}`);
      out.push(`- Rating: ${fmt(c.rating)}/10${c.isbestcoaster ? " (best coaster in its park)" : ""}`);
      out.push(`- Manufacturer / model / year: ${[c.manufacturer, c.model, c.year].filter(Boolean).join(" / ") || "n/a"}`);
      out.push(`- Times ridden: ${c.ridecount ?? "n/a"}`);
      out.push("");
      for (const t of texts) {
        if (t.headline) {
          out.push(`#### ${t.headline}`);
          out.push("");
        }
        out.push(t.text.trim());
        out.push("");
      }
      if (texts.length === 0) {
        out.push("_No written review yet._");
        out.push("");
      }
    }

    return new NextResponse(out.join("\n"), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("llms-full.txt:", err);
    return new NextResponse("Temporarily unavailable", { status: 503 });
  }
}
