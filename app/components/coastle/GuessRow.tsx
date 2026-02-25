import Image from "next/image";
import { getParkFlag } from "@/app/utils/design";
import { CoastleCoaster, GuessInsider, Cell } from "@/app/types";
import { getStatusStyles } from "@/app/utils/coastle";

export function GuessRow({
  guess,
  answer,
}: {
  guess: GuessInsider;
  answer: CoastleCoaster | null;
}) {
  if (!answer) return null;

  const isCorrect = guess.coaster.id === answer.id;

  const cells: Cell[] = [
    {
      key: "rating",
      content: guess.coaster.rating.toFixed(1),
      status: guess.matches.rating ?? "wrong",
      isArrow: true,
      diff: guess.coaster.rating - answer.rating,
      noColor: false,
    },
    {
      key: "manufacturer",
      content: guess.coaster.manufacturer,
      status: guess.matches.manufacturer ?? "wrong",
      noColor: false,
    },
    {
      key: "park",
      content: guess.coaster.park,
      status: guess.matches.park ?? "wrong",
      noColor: false,
    },
    {
      key: "country",
      content: guess.coaster.countryName ? (
        <div className="flex flex-col items-center justify-center gap-1.5 w-full">
          <div className="relative shadow-md rounded-sm overflow-hidden border border-black/20">
            <Image
              src={getParkFlag(guess.coaster.countryName)}
              alt={`${guess.coaster.countryName} flag`}
              width={42}
              height={28}
              className="object-cover"
              unoptimized
            />
          </div>
          {/* HIDE country name on mobile */}
          <span className="text-[10px] uppercase tracking-wide opacity-90 font-bold hidden md:block">
            {guess.coaster.countryName.substring(0, 3)}
          </span>
        </div>
      ) : (
        "—"
      ),
      status: guess.matches.country ?? "wrong",
      noColor: false,
    },
    {
      key: "rideCount",
      content: guess.coaster.rideCount,
      status: guess.matches.rideCount ?? "wrong",
      isArrow: true,
      diff: guess.coaster.rideCount - answer.rideCount,
      noColor: false,
    },
    
    {
      key: "year",
      content: guess.coaster.year || "—",
      status: guess.matches.year ?? "wrong",
      isArrow: true,
      diff: guess.coaster.year - answer.year,
      noColor: false,
    },
  ];

  return (
    <tr className="border-b border-transparent">
      {/* Desktop Only: Coaster Name */}
      <td className="hidden md:table-cell p-2 align-middle text-center overflow-hidden bg-slate-50 dark:bg-slate-800/40 border-r border-slate-200 dark:border-neutral-800">
        <div className={`
          text-lg font-black leading-tight mx-auto max-w-[200px] whitespace-normal break-words
          ${isCorrect ? "text-emerald-500 dark:text-emerald-400" : "text-slate-800 dark:text-slate-200"}
          animate-flipInCell
        `}>
          <a
            href={guess.coaster.rcdbPath}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline decoration-2 underline-offset-2 block"
            title={guess.coaster.name}
          >
            {guess.coaster.name}
          </a>
        </div>
      </td>

      {/* Attributes */}
      {cells.map((cell, i) => (
        <td
          key={cell.key}
          // Tight padding on mobile
          className={`p-0.5 sm:p-2 align-middle`}
        >
          <div
            className={`
              relative flex flex-col items-center justify-center
              h-12 sm:h-16 w-full rounded-lg border text-[10px] sm:text-base font-bold
              shadow-md transition-all overflow-hidden shrink-0
              ${cell.noColor
                ? "bg-white border-slate-200 text-slate-800 dark:bg-neutral-900 dark:border-neutral-700 dark:text-slate-200"
                : getStatusStyles(cell.status)
              }
              opacity-0 animate-flipInCell
            `}
            style={{
              animationDelay: `${(i + 1) * 80}ms`,
              animationFillMode: "forwards",
            }}
          >
            {/* Manufacturer & Park */}
            <span className={`px-0.5 sm:px-1 text-center w-full z-10 relative drop-shadow-sm ${cell.key === 'park' || cell.key === 'manufacturer' ? 'whitespace-normal leading-[1.1] line-clamp-2 break-words' : 'truncate leading-tight'}`}>
              {cell.content}
            </span>
            {cell.isArrow && typeof cell.diff === "number" && cell.diff !== 0 && (
              <span className="z-10 text-[7px] sm:text-[10px] uppercase opacity-90 font-bold leading-none mt-0.5 sm:mt-1 flex items-center gap-0.5 bg-black/25 px-1 py-0.5 rounded-full backdrop-blur-sm tracking-tighter">
                {cell.diff > 0 ? "Lower ▼" : "Higher ▲"}
              </span>
            )}
          </div>
        </td>
      ))}
    </tr>
  );
}