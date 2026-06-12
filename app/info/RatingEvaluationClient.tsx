"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getRatingColor } from "@/app/utils/design";

type Group = "Coasters" | "Rides" | "Park" | "Food" | "Management";

type Category = {
  id: string;
  title: string;
  description: string;
  bullets: string[];
  rules?: string[];
};

type GroupBlock = { name: Group; categories: Category[] };

const GROUP_ICON: Record<Group, string> = {
  Coasters: "🎢",
  Rides: "🎡",
  Park: "🏞️",
  Food: "🍔",
  Management: "📋",
};

const groups: GroupBlock[] = [
  {
    name: "Coasters",
    categories: [
      {
        id: "best-coaster",
        title: "Best Coaster",
        description: "The quality of the parks best coaster",
        bullets: [
          "Theming and immersion",
          "Coaster Layout and its elements",
          "Length and Duration",
          "Pacing and flow",
          "Thrills and intensity",
          "Smoothness and comfortability",
          "Overall experience",
        ],
        rules: [
          "Only one coaster in a park can be best coaster, if another gets best coaster the previous loses it",
          "If a coaster is closed on first visit, we can't rate it and therefore, can't be best coaster",
          "If a coaster is closed on a revisit, we can't change its score"
        ]
      },
      {
        id: "coaster-depth",
        title: "Coaster Depth",
        description: "The depth and quality of the coaster lineup, excluding best coaster",
        bullets: [
          "Overall quantity of supporting coasters",
          "How good is the second best coaster in the park",
          "Variation - having different types of coasters",
          "Coverage - Having seveal family and thrill coaster and also something for children"
        ],
        rules: [
          "Children’s rides are excluded",
          "Best coaster is excluded",
          "If a ride is closed during our first visit, we can't rate it",
          "If a ride is closed during a revisit, we can't change its score",
        ]
      },
    ],
  },
  {
    name: "Rides",
    categories: [
      {
        id: "water-rides",
        title: "Water Rides",
        description:
          "The overall quality and quantity of the park’s waterride line-up.",
        bullets: [
          "How many? We expect a park to have 2, more is a bonus and less is a negative",
          "Quality in terms of theming, immersion, smoothness and uniqueness",
          "We tend to rank waterrides with thrills and wetness higher",
        ],
        rules: [
          "Self-operated boats are excluded",
          "We don't ride children flumes or splash-battle rides but they can give small bonus to score"
        ]
      },
      {
        id: "flats-darkrides",
        title: "Flatrides and Darkrides",
        description:
          "The quality and variety of flat rides and dark rides in the park",
        bullets: [
          "The overall amount of flatrides the park has",
          "Flatride coverage, does the park have flatrides for all age groups?",
          "Standout flatrides, most notibly thrill flatrides our unqiue, high quality flats",
          "Darkrides, having no darkrides in the park is a negative but having multiple is seen as a bonus"
        ],
        rules: [
          "Simulators and showrides are counted as darkrides",
          "We do not count purely upcharge attractions"
        ]
      },
    ],
  },
  {
    name: "Park",
    categories: [
      {
        id: "park-appearance",
        title: "Park Appearance",
        description:
          "The overall look, theming, and atmosphere across the entire park.",
        bullets: [
          "The Parks location and surroundings",
          "Theming throughout the park and in queues",
          "Immersion, being immersed in the themes or events at the park",
          "Cleanliness, pathsways being clean, rides and theming being in good condition",
          "Natural beauty, greenery, landscaping etc.",
        ],
      },
      {
        id: "park-practicality",
        title: "Park Practicality",
        description:
          "How practical and convenient the park is to explore and use.",
        bullets: [
          "Park app",
          "Signage / navigation",
          "Park layout",
          "Ride entrance locations",
          "Facility placements",
          "Benches / bins / shading",
        ],
      },
    ],
  },
  {
    name: "Food",
    categories: [
      {
        id: "food",
        title: "Food",
        description:
          "The quality and variety of meals available throughout the park.",
        bullets: ["Quality", "Selection / variation"],
      },
      {
        id: "snacks-drinks",
        title: "Snacks & Drinks",
        description:
          "The availability and quality of smaller snack and beverage options.",
        bullets: [
          "Quality",
          "Variety of snacks and drinks",
          "Selection / variation",
        ],
      },
    ],
  },
  {
    name: "Management",
    categories: [
      {
        id: "ride-operations",
        title: "Ride Operations",
        description:
          "How efficiently and reliably the rides are operated each day.",
        bullets: [
          "Speed of dispatches",
          "Trains in operation / staging",
          "Queue handling",
          "Passenger interactions",
          "Ride breakdowns",
        ],
      },
      {
        id: "park-management",
        title: "Park Management",
        description: "How the park is managed, organized, and run overall.",
        bullets: [
          "Facility closures",
          "General service",
          "Park policies",
          "Staggered openings",
          "Parking fees",
          "Merchandise",
        ],
      },
    ],
  },
];

type Tier = {
  score: string;
  color: string;
  thrill?: string;
  family?: string;
  unified?: string;
};

const SCORING_TIERS: Tier[] = [
  { score: "11", color: getRatingColor(11), unified: "GOATED" },
  { score: "10", color: getRatingColor(10), unified: "World Class" },
  { score: "9.0 - 9.5", color: getRatingColor(9), unified: "Elite" },
  { score: "8.0 - 8.5", color: getRatingColor(8), thrill: "Great thrill coaster", family: "Extraordinary Family coaster" },
  { score: "7.0 - 7.5", color: getRatingColor(7), thrill: "Good Thrill coaster", family: "Elite Family coaster" },
  { score: "6.0 - 6.5", color: getRatingColor(6), thrill: "Solid Thrill coaster", family: "Great Family coaster" },
  { score: "5.0 - 5.5", color: getRatingColor(5), thrill: "Okay Thrill coaster", family: "Good Family coaster" },
  { score: "4.0 - 4.5", color: getRatingColor(4), thrill: "Mediocre Thrill coaster", family: "Decent Family coaster" },
  { score: "3.0 - 3.5", color: getRatingColor(3), thrill: "Poor Thrill coaster", family: "Average Family coaster" },
  { score: "2.0 - 2.5", color: getRatingColor(1.5), thrill: "Terrible Thrill coaster", family: "Small or mediocre family coaster" },
  { score: "0.5 - 1.5", color: getRatingColor(0.5), unified: "Completely worthless" },
];

const SECTION_IDS = ["introduction", "how-scoring-works", ...groups.map((g) => g.name)];

export default function EvaluationCriteriaPage() {
  const [activeSection, setActiveSection] = useState<string>("introduction");

  useEffect(() => {
    const onScroll = () => {
      let current = SECTION_IDS[0];
      for (const id of SECTION_IDS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 120) current = id;
      }
      setActiveSection(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#0f172a] text-slate-200">
      <style>{`
        :root { --anchor-offset: 80px; }

        html { scroll-behavior: smooth; }
        .group-anchor { scroll-margin-top: var(--anchor-offset); }

        .scroll-buffer { height: calc(100vh - var(--anchor-offset)); }
      `}</style>

      <div className="mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-12 gap-10 px-4 sm:px-8 pt-16 pb-24">

        {/* TOC (left) */}
        <aside className="hidden md:block md:col-span-3">
          <nav className="sticky top-24">
            <p className="text-xs font-bold uppercase tracking-widest text-brand mb-4">
              On this page
            </p>
            <ul className="text-sm border-l border-slate-800">
              <li>
                <a
                  href="#introduction"
                  className={`block border-l-2 -ml-px pl-4 py-1.5 transition-colors ${
                    activeSection === "introduction"
                      ? "border-brand text-brand font-semibold"
                      : "border-transparent text-slate-400 hover:text-white hover:border-slate-500"
                  }`}
                >
                  Introduction
                </a>
              </li>
              <li>
                <a
                  href="#how-scoring-works"
                  className={`block border-l-2 -ml-px pl-4 py-1.5 transition-colors ${
                    activeSection === "how-scoring-works"
                      ? "border-brand text-brand font-semibold"
                      : "border-transparent text-slate-400 hover:text-white hover:border-slate-500"
                  }`}
                >
                  How scoring works
                </a>
              </li>

              {groups.map((group) => (
                <li key={group.name} className="mt-2">
                  <a
                    href={`#${group.name}`}
                    className={`flex items-center gap-2 border-l-2 -ml-px pl-4 py-1.5 transition-colors ${
                      activeSection === group.name
                        ? "border-brand text-brand font-semibold"
                        : "border-transparent text-slate-400 hover:text-white hover:border-slate-500"
                    }`}
                  >
                    <span className="text-base leading-none">{GROUP_ICON[group.name]}</span>
                    {group.name}
                  </a>
                  <ul>
                    {group.categories.map((c) => (
                      <li key={c.id}>
                        <a
                          href={`#${c.id}`}
                          className="block border-l-2 border-transparent -ml-px pl-10 py-1 text-xs text-slate-500 hover:text-brand transition-colors truncate"
                          title={c.title}
                        >
                          {c.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* RIGHT column content */}
        <main className="md:col-span-9 space-y-24">

          {/* Hero/Introduction */}
          <section id="introduction" className="pt-4 text-left">
            <p className="text-brand text-xs font-bold uppercase tracking-widest mb-3">
              ParkRating · Methodology
            </p>
            <h1 className="text-4xl sm:text-5xl font-black mb-3 leading-tight text-white">
              Evaluation <span className="text-brand">Criteria</span>
            </h1>
            <div className="max-w-3xl text-base text-slate-400 leading-relaxed space-y-4">
              <p>
                Our park ratings are split into five main categories:{" "}
                <strong className="text-slate-200">Coasters</strong>, <strong className="text-slate-200">Rides</strong>,{" "}
                <strong className="text-slate-200">Park</strong>, <strong className="text-slate-200">Food</strong>, and{" "}
                <strong className="text-slate-200">Management</strong>. Each category is driven by two specific criteria,
                scored from 0 to 10, and the overall rating is the balanced average of
                all five categories.
              </p>
              <p>
                <em className="text-slate-500 text-sm">
                  Disclaimer: These reviews reflect our personal experiences and opinions from the day of our visit. Please do not hold us liable if you suddenly find yourself falling
                  in love with a new manufacturer or swearing by a ride we did not
                  love quite as much!
                </em>
              </p>
            </div>
          </section>

          {/* How scoring works */}
          <section id="how-scoring-works" className="scroll-mt-24">
            <div className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                How scoring works
              </h2>
              <div className="w-12 h-1 bg-brand rounded-full mt-4 mb-6" />
              <p className="text-slate-400 text-base max-w-3xl mb-8">
                Every coaster and category is scored from 0–10 based on our experience. Because different ride types aim for different experiences, our expectations shift depending on whether we are reviewing a <strong className="text-slate-200">Thrill Coaster</strong> or a <strong className="text-slate-200">Family Coaster</strong>.
                <br className="mb-2" />
                In extremely rare cases, a truly standout criterion may break the scale and earn a <span className={getRatingColor(11)}>Golden 11</span>.
              </p>

{/* Coaster Ratings */}
              <div className="max-w-3xl rounded-2xl bg-slate-800/20 border border-slate-800 p-6 md:p-8 mb-10 space-y-6">
                <div>
                  <h4 className="text-sm font-black uppercase tracking-widest text-brand mb-2">
                    Our coaster ratings
                  </h4>
                  <div className="text-sm md:text-base text-slate-300 leading-relaxed space-y-3">
                    <p>
                      Our rating system spans the entire spectrum of coaster experiences. You might find our scores stricter than typical review sites or YouTubers, but that is by design.
                    </p>
                    <p>
                      We do not just hand out a <span className={`font-bold ${getRatingColor(7)}`}>7</span> or <span className={`font-bold ${getRatingColor(8)}`}>8</span> because we had fun; we critically weigh a ride's strengths against every coaster we have ridden globally. Similarly, we reserve a <span className={`font-bold ${getRatingColor(1)}`}>1</span> or <span className={`font-bold ${getRatingColor(2)}`}>2</span> exclusively for the absolute worst thrill rides or the most mundane junior coasters.
                    </p>
                    <p>Think of our scale like IMDb or Metacritic:</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                    <div className="rounded-xl bg-slate-900/50 border border-slate-700/40 px-4 py-3">
                      <div className={`text-xl font-black tabular-nums ${getRatingColor(6)}`}>6+</div>
                      <div className="text-xs text-slate-400 mt-1">A genuinely solid ride</div>
                    </div>
                    <div className="rounded-xl bg-slate-900/50 border border-slate-700/40 px-4 py-3">
                      <div className={`text-xl font-black tabular-nums ${getRatingColor(8)}`}>8</div>
                      <div className="text-xs text-slate-400 mt-1">Incredibly hard to achieve</div>
                    </div>
                    <div className="rounded-xl bg-slate-900/50 border border-slate-700/40 px-4 py-3">
                      <div className={`text-xl font-black tabular-nums ${getRatingColor(3)}`}>Below 4</div>
                      <div className="text-xs text-slate-400 mt-1">Requires serious flaws</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/60">
                  <div>
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Thrill Dynamics
                    </h5>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      Thrill coasters naturally score higher due to their intensity. Even a flawed, rough thrill ride usually stays above a <span className={`font-bold ${getRatingColor(4)}`}>4.0</span> simply because the baseline thrill still provides enjoyment. Our perfect thrill coaster combines long duration, high intensity, relentless pacing, and forceful elements.
                    </p>
                  </div>
                  <div>
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Family Appeal
                    </h5>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      Because they lack extreme intensity, family coasters generally score lower. Standard family rides usually sit in the <span className={`font-bold ${getRatingColor(4)}`}>4</span>–<span className={`font-bold ${getRatingColor(5)}`}>5</span> range, while smaller junior coasters fall into the <span className={`font-bold ${getRatingColor(2)}`}>2</span>–<span className={`font-bold ${getRatingColor(3)}`}>3</span> range. Elite 'family-thrill' coasters can reach the <span className={`font-bold ${getRatingColor(6)}`}>6</span>–<span className={`font-bold ${getRatingColor(7)}`}>7</span> range, but exceeding a <span className={`font-bold ${getRatingColor(7)}`}>7</span> is rare. Our ideal family coaster delivers a long, incredibly smooth ride with immersive theming and unique elements.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Tier Table */}
            <div className="w-full overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-800/30 shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm whitespace-normal table-fixed">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-700 text-slate-400 uppercase tracking-wider text-[10px] sm:text-xs font-bold">
                      <th className="px-2 sm:px-4 py-3 sm:py-4 w-[22%] text-center border-r border-slate-700/50">Score</th>
                      <th className="py-3 sm:py-4 px-3 sm:px-6 w-[39%] text-right border-r border-slate-700/50">Thrill Coasters</th>
                      <th className="py-3 sm:py-4 px-3 sm:px-6 w-[39%] text-left">Family Coasters</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {SCORING_TIERS.map((tier, i) => (
                      <tr key={i} className="hover:bg-slate-800/50 transition-colors">
                        {/* Score Cell */}
                        <td className="px-2 sm:px-4 py-3 sm:py-4 text-center border-r border-slate-700/50">
                          <span className={`font-black text-sm sm:text-lg md:text-xl tabular-nums ${tier.color}`}>
                            {tier.score}
                          </span>
                        </td>
                        {tier.unified ? (
                          <td colSpan={2} className="px-3 sm:px-6 py-4 sm:py-5 text-center text-sm sm:text-lg text-slate-300">
                            {tier.unified}
                          </td>
                        ) : (
                          /* Split Row */
                          <>
                            <td className="py-3 sm:py-4 px-3 sm:px-6 text-slate-300 text-right border-r border-slate-700/50">
                              {tier.thrill}
                            </td>
                            <td className="py-3 sm:py-4 px-3 sm:px-6 text-slate-300 text-left">
                              {tier.family}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <div className="py-6">
            <hr className="border-slate-800" />
          </div>

          <section className="text-center pb-8">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Category Breakdown
            </h2>
            <p className="mt-3 text-slate-400 text-base">The detailed metrics behind the numbers.</p>
          </section>

          {groups.map((group, gi) => (
            <section key={group.name} className="relative">
              <div id={group.name} className="group-anchor mb-10">
                <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
                  <span className="text-3xl drop-shadow-md">
                    {GROUP_ICON[group.name]}
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    {group.name}
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {group.categories.map((c) => (
                  <CategoryMinimal key={c.id} data={c} />
                ))}
              </div>

              {gi === groups.length - 1 && (
                <>
                  <div className="mt-24 pt-10 border-t border-slate-800 w-full flex flex-col sm:flex-row justify-center items-center gap-4">
                    <button
                      onClick={() =>
                        window.scrollTo({ top: 0, behavior: "smooth" })
                      }
                      className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold shadow-md transition-all border border-slate-700 cursor-pointer"
                    >
                      ↑ Back to top
                    </button>
                    <Link
                      href="/"
                      className="px-6 py-3 rounded-xl bg-brand hover:bg-brand-light text-white font-bold shadow-lg shadow-orange-900/20 transition-all cursor-pointer"
                    >
                      Browse Park Reviews →
                    </Link>
                  </div>

                  {/* Buffer exists so TOC anchor jumps can scroll the last
                      section to the top — pointless on mobile (no TOC) */}
                  <div className="scroll-buffer hidden md:block" aria-hidden="true" />
                </>
              )}
            </section>
          ))}
        </main>
      </div>
    </div>
  );
}

function CategoryMinimal({
  data,
}: {
  data: { id: string; title: string; description: string; bullets: string[]; rules?: string[] };
}) {
  return (
    <div id={data.id} className="h-full scroll-mt-24 rounded-2xl bg-slate-800/40 border border-slate-700/50 p-6 sm:p-8 hover:bg-slate-800/80 transition-colors shadow-lg">
      <h4 className="text-xl font-bold text-white mb-2 tracking-tight">
        {data.title}
      </h4>
      <p className="text-slate-400 text-sm leading-relaxed mb-5">
        {data.description}
      </p>

      <h5 className="text-xs font-bold text-brand uppercase tracking-wider mb-2">Criteria</h5>
      <ul className="list-disc list-outside pl-5 text-sm marker:text-brand/50 text-slate-300 space-y-1.5">
        {data.bullets.map((b) => (
          <li key={b} className="leading-snug">{b}</li>
        ))}
      </ul>

      {data.rules && data.rules.length > 0 && (
        <div className="mt-5 pt-4 border-t border-slate-700/50">
          <h5 className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-2">Rules</h5>
          <ul className="list-disc list-outside pl-5 text-sm marker:text-rose-800 text-slate-400 space-y-1.5">
            {data.rules.map((r) => (
              <li key={r} className="leading-snug">{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}