export const metadata = {
  title: "About ParkRating",
  description:
    "We are two brothers with a passion for theme parks and thrilling coasters",
};

"use client";

import React, { useState } from "react";
import Link from "next/link";

type Group = "Coasters" | "Rides" | "Park" | "Food" | "Management";

type Category = {
  id: string;
  title: string;
  description: string;
  bullets: string[];
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
        description: "The single standout coaster in the park.",
        bullets: [
          "Layout",
          "Length",
          "Intensity / pacing",
          "Smoothness",
          "Overall experience",
        ],
      },
      {
        id: "coaster-depth",
        title: "Coaster Depth",
        description: "The depth and quality of the coaster lineup.",
        bullets: [
          "Entirely closed rides are excluded",
          "Overall quantity and variety",
          "Children’s rides are excluded",
          "best coasters is excluded",
        ],
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
          "The overall quality and presence of the park’s water attractions.",
        bullets: ["Quantity", "Quality", "Self-operated boats are excluded"],
      },
      {
        id: "flats-darkrides",
        title: "Flatrides and Darkrides",
        description:
          "The quality and variety of flat rides and indoor attractions.",
        bullets: ["Quantity", "Quality"],
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
          "Location",
          "Ride & queue theming",
          "Immersion",
          "Cleanliness",
          "Wear & tear",
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

export default function EvaluationCriteriaPage() {
  return (
    <div className="w-full bg-white dark:bg-gray-900">
      <style>{`
        :root { --anchor-offset: 60px; }
        :root { --desc-min: 3.75rem; }

        html { scroll-behavior: smooth; }
        .group-anchor { scroll-margin-top: var(--anchor-offset); }

        .collapsible {
          transition: max-height 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease;
        }
        .scroll-buffer { height: calc(100vh - var(--anchor-offset)); }

        @media (prefers-reduced-motion: no-preference) {
          .rainbow-animation {
            background: linear-gradient(90deg, #ef4444, #f59e0b, #eab308, #22c55e, #3b82f6, #8b5cf6, #ec4899);
            background-size: 400% 100%;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: rainbow-move 6s linear infinite;
          }
          @keyframes rainbow-move {
            0% { background-position: 0% 50%; }
            100% { background-position: 100% 50%; }
          }
        }
      `}</style>

      <div className="mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-12 gap-10 px-6 pt-14 pb-24">
        {/* TOC (left) */}
        <aside className="hidden md:block md:col-span-3">
          <nav className="sticky top-20">
            <p className="text-xs font-semibold tracking-wide text-gray-500 dark:text-gray-400 mb-3">
              Jump to section
            </p>
            <ul className="space-y-3 text-sm">
              <li>
                <a
                  href="#introduction"
                  className="inline-flex items-center gap-2 font-medium text-gray-900 dark:text-white rounded px-2 py-1 hover:bg-blue-50 dark:hover:bg-[#1e293b]"
                >
                  📖 Introduction
                </a>
              </li>
              <li>
                <a
                  href="#how-scoring-works"
                  className="inline-flex items-center gap-2 font-medium text-gray-900 dark:text-white rounded px-2 py-1 hover:bg-blue-50 dark:hover:bg-[#1e293b]"
                >
                  📊 How scoring works
                </a>
              </li>
              {groups.map((group) => (
                <li key={group.name}>
                  <a
                    href={`#${group.name}`}
                    className="mb-1 inline-flex items-center gap-2 font-medium text-gray-900 dark:text-white rounded px-2 py-1 hover:bg-blue-50 dark:hover:bg-[#1e293b]"
                  >
                    <span>{GROUP_ICON[group.name]}</span>
                    {group.name}
                  </a>
                  <ul className="space-y-1 pl-2 border-l border-gray-200 dark:border-white/10">
                    {group.categories.map((c) => (
                      <li key={c.id}>
                        <a
                          href={`#${group.name}`}
                          className="block rounded-l px-2 py-1 hover:bg-blue-50 dark:hover:bg-[#1e293b] text-gray-700 dark:text-gray-300"
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
        <main className="md:col-span-9 space-y-28">
          {/* Hero/Introduction */}
          <section id="introduction" className="pt-0 pb-4 text-center">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 dark:text-white">
              Rating Evaluation
            </h1>
            <p className="mt-4 mx-auto max-w-2xl text-lg text-gray-700 dark:text-gray-300">
              Our park ratings are split into five categories:{" "}
              <strong>Coasters</strong>, <strong>Rides</strong>,{" "}
              <strong>Park</strong>, <strong>Food</strong>, and{" "}
              <strong>Management</strong>. Each category has two criteria,
              scored from 0 to 10, and the overall rating is just the average of
              all five categories.
              <br />
              These reviews are, of course, only our personal opinions, so
              please do not hold us liable if you suddenly find yourself falling
              in love with a new manufacturer or swearing by a ride we did not
              love quite as much.
            </p>
          </section>

          {/* How scoring works */}
          <section id="how-scoring-works">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white text-center">
              How scoring works
            </h2>
            <p className="mt-3 text-gray-700 dark:text-gray-300 text-base text-center">
              Each criterion is scored from 0–10 based on our experience during
              the visit. The scores and their meanings are outlined below. In
              rare cases, a truly standout criterion may break the scale and
              earn a{" "}
              <span className="font-extrabold text-yellow-500">Golden</span>{" "}
              rating of 11.
              <br />
            </p>

            <div className="mt-10 grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
              <LegendBox
                spanMobile
                number={<span className="text-yellow-500">👑 11 👑</span>}
                label="Golden"
              />
              <LegendBox
                number={<span className="rainbow-animation">10</span>}
                label="Extraordinary"
              />
              <LegendBox
                number={
                  <span className="text-blue-700 dark:text-blue-400">9–10</span>
                }
                label="Elite"
              />
              <LegendBox
                number={
                  <span className="text-green-600 dark:text-green-400">
                    7.5–9
                  </span>
                }
                label="Great"
              />
              <LegendBox
                number={
                  <span className="text-green-400 dark:text-green-300">
                    6.5–7.5
                  </span>
                }
                label="Good"
              />
              <LegendBox
                number={
                  <span className="text-yellow-400 dark:text-yellow-300">
                    5.5–6.5
                  </span>
                }
                label="Decent"
              />
              <LegendBox
                number={
                  <span className="text-yellow-600 dark:text-yellow-500">
                    4.5–5.5
                  </span>
                }
                label="Below Avg"
              />
              <LegendBox
                number={
                  <span className="text-red-400 dark:text-red-300">3–4.5</span>
                }
                label="Poor"
              />
              <LegendBox
                number={
                  <span className="text-red-600 dark:text-red-500">0–3</span>
                }
                label="Very Poor"
              />
            </div>
          </section>

          <section>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 dark:text-white text-center">
              Evaluation Criteria
            </h2>
          </section>

          {groups.map((group, gi) => (
            <section key={group.name}>
              <div id={group.name} className="group-anchor mb-12">
                <div className="flex flex-col items-center gap-2">
                  <span className="text-4xl md:text-5xl">
                    {GROUP_ICON[group.name]}
                  </span>
                  <h3 className="text-3xl font-bold text-gray-900 dark:text-white text-center">
                    {group.name}
                  </h3>
                </div>
              </div>

              <div className="relative mx-auto max-w-3xl">
                <div className="pointer-events-none absolute inset-y-0 left-1/2 hidden -translate-x-1/2 md:block">
                  <div className="h-full border-l border-gray-200 dark:border-white/10" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-10 md:gap-x-12">
                  {group.categories.map((c) => (
                    <div key={c.id} className="px-4 md:px-6">
                      <CategoryMinimal data={c} />
                    </div>
                  ))}
                </div>
              </div>

              {gi !== groups.length - 1 && (
                <div className="mt-16">
                  <hr className="mx-auto max-w-3xl border-gray-200 dark:border-white/10" />
                </div>
              )}

              {gi === groups.length - 1 && (
                <>
                  <div className="mt-16 w-full">
                    <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                      <button
                        onClick={() =>
                          window.scrollTo({ top: 0, behavior: "smooth" })
                        }
                        className="px-6 py-3 rounded-full bg-gradient-to-r from-gray-800 to-gray-600 text-white dark:from-white dark:to-gray-200 dark:text-gray-900 font-semibold shadow-md hover:scale-105 transition transform"
                      >
                        ↑ Back to top
                      </button>
                      <Link
                        href="/"
                        className="px-6 py-3 rounded-full bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-semibold shadow-md hover:scale-105 transition transform"
                      >
                        Browse Park Reviews →
                      </Link>
                    </div>
                  </div>

                  <div className="scroll-buffer" aria-hidden="true" />
                </>
              )}
            </section>
          ))}
        </main>
      </div>
    </div>
  );
}

function LegendBox({
  number,
  label,
  spanMobile,
}: {
  number: React.ReactNode;
  label: string;
  spanMobile?: boolean;
}) {
  return (
    <div
      className={`px-3 py-4 rounded-2xl bg-blue-50 dark:bg-[#1e293b] flex flex-col items-center ${
        spanMobile ? "col-span-2 md:col-span-1" : ""
      }`}
    >
      <span className="font-extrabold text-xl">{number}</span>
      <span className="font-medium text-gray-900 dark:text-white">{label}</span>
    </div>
  );
}

function CategoryMinimal({
  data,
}: {
  data: { id: string; title: string; description: string; bullets: string[] };
}) {
  const [open, setOpen] = useState(false);

  return (
    <div id={data.id} className="mx-auto max-w-md text-center md:text-left">
      <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
        {data.title}
      </h4>
      <p
        className="mt-1 text-gray-700 dark:text-gray-300 leading-relaxed"
        style={{ minHeight: "var(--desc-min)" }}
      >
        {data.description}
      </p>

      <div className="mt-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-200 hover:underline underline-offset-2 focus:outline-none"
          aria-expanded={open}
          aria-controls={`${data.id}-panel`}
        >
          <span
            className={`transform transition-transform duration-200 ${
              open ? "rotate-90" : ""
            }`}
            aria-hidden
          >
            ▶
          </span>
          {open ? "Hide criteria" : `View criteria (${data.bullets.length})`}
        </button>

        <div
          id={`${data.id}-panel`}
          className={`collapsible overflow-hidden ${
            open ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <ul className="mt-3 list-disc list-outside pl-5 text-left marker:text-gray-400 dark:marker:text-gray-500 text-gray-800 dark:text-gray-100 space-y-1">
            {data.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
