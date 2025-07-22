"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getRatingColor } from "@/app/utils/design";
import { useSearch } from "@/app/context/SearchContext";

type Coaster = {
  id: number;
  name: string;
  manufacturer: string;
  model: string;
  scale: string;
  haveRidden: boolean;
  isBestCoaster: boolean;
  rcdbPath: string;
  rideCount: number;
  rating: number | null;
  parkId: number;
  parkName: string;
  year: number;
};

export default function CoasterRatingsPage() {
  const [coasters, setCoasters] = useState<Coaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortBy, setSortBy] = useState<keyof Coaster | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const { query } = useSearch();

  useEffect(() => {
    const fetchCoasters = async () => {
      try {
        const res = await fetch("/api/coasters");
        const data = await res.json();

        if (!data || !Array.isArray(data.coasters)) {
          throw new Error("Unexpected data format from API");
        }

        const structuredCoasters: Coaster[] = data.coasters
          .filter((coaster: Coaster) => coaster.rating !== null)
          .map((c: Coaster) => ({
            id: c.id,
            name: c.name,
            manufacturer: c.manufacturer,
            model: c.model,
            scale: c.scale,
            haveRidden: c.haveRidden,
            isBestCoaster: c.isBestCoaster,
            rcdbPath: c.rcdbPath,
            rideCount: c.rideCount,
            rating:
              typeof c.rating === "string" ? parseFloat(c.rating) : c.rating,
            parkId: c.parkId,
            parkName: c.parkName,
            year: c.year ?? 0,
          }));

        setCoasters(structuredCoasters);
      } catch (err: unknown) {
        if (err instanceof Error) {
          console.error("Error fetching data:", err.message);
          setError(err.message);
        } else {
          console.error("Unexpected error:", err);
          setError("An unexpected error occurred");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchCoasters();
  }, []);

  if (loading) return <p className="p-4 text-gray-500">Loading coasters...</p>;
  if (error) return <p className="p-4 text-red-500">Error: {error}</p>;

  const filteredCoasters = coasters.filter(
    (coaster) =>
      (coaster.name ?? "").toLowerCase().includes(query.toLowerCase()) ||
      (coaster.parkName ?? "").toLowerCase().includes(query.toLowerCase()) ||
      (coaster.manufacturer ?? "").toLowerCase().includes(query.toLowerCase())
  );

  const sortedCoasters = [...filteredCoasters].sort((a, b) => {
    if (!sortBy) return 0;

    const valA = a[sortBy];
    const valB = b[sortBy];

    if (valA === valB) return 0;

    if (valA === null || valA === undefined) return 1;
    if (valB === null || valB === undefined) return -1;

    if (typeof valA === "number" && typeof valB === "number") {
      return sortDirection === "asc" ? valA - valB : valB - valA;
    }

    return sortDirection === "asc"
      ? String(valA).localeCompare(String(valB), "en", {
          ignorePunctuation: true,
          sensitivity: "base",
        })
      : String(valB).localeCompare(String(valA), "en", {
          ignorePunctuation: true,
          sensitivity: "base",
        });
  });

  function handleSort(column: keyof Coaster) {
    const descByDefault = ["rating", "rideCount"] as (keyof Coaster)[];

    if (sortBy === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      if (descByDefault.includes(column)) {
        setSortDirection("desc");
      } else {
        setSortDirection("asc");
      }
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">TOP COASTERS</h1>
      <div className="overflow-auto rounded-lg shadow border border-gray-200 max-h-[1200px]">
        <table className="min-w-full text-sm text-left">
          <thead className="bg-gray-100 text-xs uppercase text-gray-600 sticky top-0 z-10">
            <tr>
              <th scope="col" className="px-4 py-3">
                #
              </th>

              <th
                scope="col"
                className="px-4 py-3 cursor-pointer hover:underline select-none"
                onClick={() => handleSort("name")}
              >
                <div className="inline-flex items-center">
                  Name
                  <span
                    className={`ml-1 w-4 text-gray-700 ${
                      sortBy === "name" ? "visible" : "invisible"
                    }`}
                  >
                    {sortDirection === "asc" ? "▲" : "▼"}
                  </span>
                </div>
              </th>

              <th
                scope="col"
                className="px-4 py-3 cursor-pointer hover:underline select-none"
                onClick={() => handleSort("parkName")}
              >
                <div className="inline-flex items-center">
                  Park
                  <span
                    className={`ml-1 w-4 text-gray-700 ${
                      sortBy === "parkName" ? "visible" : "invisible"
                    }`}
                  >
                    {sortDirection === "asc" ? "▲" : "▼"}
                  </span>
                </div>
              </th>

              <th
                scope="col"
                className="px-4 py-3 cursor-pointer hover:underline select-none"
                onClick={() => handleSort("manufacturer")}
              >
                <div className="inline-flex items-center">
                  Manufacturer
                  <span
                    className={`ml-1 w-4 text-gray-700 ${
                      sortBy === "manufacturer" ? "visible" : "invisible"
                    }`}
                  >
                    {sortDirection === "asc" ? "▲" : "▼"}
                  </span>
                </div>
              </th>

              <th
                scope="col"
                className="px-4 py-3 cursor-pointer hover:underline select-none"
                onClick={() => handleSort("rating")}
              >
                <div className="inline-flex items-center">
                  Rating
                  <span
                    className={`ml-1 w-4 text-gray-700 ${
                      sortBy === "rating" ? "visible" : "invisible"
                    }`}
                  >
                    {sortDirection === "asc" ? "▲" : "▼"}
                  </span>
                </div>
              </th>

              <th
                scope="col"
                className="px-4 py-3 cursor-pointer hover:underline select-none"
                onClick={() => handleSort("rideCount")}
              >
                <div className="inline-flex items-center">
                  Ride Count
                  <span
                    className={`ml-1 w-4 text-gray-700 ${
                      sortBy === "rideCount" ? "visible" : "invisible"
                    }`}
                  >
                    {sortDirection === "asc" ? "▲" : "▼"}
                  </span>
                </div>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200">
            {sortedCoasters.map((coaster, index) => (
              <tr key={coaster.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  {index + 1}
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  <a
                    href={coaster.rcdbPath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {coaster.name}
                  </a>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/park/${coaster.parkId}`}
                    className="text-blue-600 hover:underline"
                    rel="noopener noreferrer"
                  >
                    {coaster.parkName}
                  </Link>
                </td>
                <td className="px-4 py-3">{coaster.manufacturer}</td>
                <td
                  className={`px-5 py-3 font-semibold ${
                    coaster.rating !== null
                      ? getRatingColor(coaster.rating)
                      : ""
                  }`}
                >
                  {coaster.rating !== null ? coaster.rating.toFixed(1) : "—"}
                </td>
                <td className="px-12 py-3">{coaster.rideCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
