// app/components/CoasterList.tsx
import React from "react";
import type { RollerCoaster } from "@/app/types";

interface CoasterListProps {
  coasters: RollerCoaster[];
  loading: boolean;
  onEdit: (c: RollerCoaster) => void;
  onAdd: () => void;
}

const CoasterList: React.FC<CoasterListProps> = ({
  coasters,
  loading,
  onEdit,
  onAdd,
}) => {
  const sorted = [...coasters].sort((a, b) =>
    b.isbestcoaster === a.isbestcoaster ? 0 : b.isbestcoaster ? 1 : -1
  );
  const main = sorted.filter(c => c.scale !== "Junior" && c.scale !== "Kiddie");
  const optional = sorted.filter(c => c.scale === "Junior" || c.scale === "Kiddie");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Roller Coasters</h2>
        <button
          onClick={onAdd}
          className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm"
        >
          + Add
        </button>
      </div>

      {loading ? (
        <p>Loading coasters…</p>
      ) : main.length > 0 ? (
        <>
          <ul className="space-y-1">
            {main.map(c => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 text-sm md:text-base border-b border-gray-100 py-1"
              >
                {/* Left: name + info */}
                <div className="flex flex-col md:flex-row md:items-center md:gap-2 min-w-0">
                  <a
                    href={c.rcdbpath}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline font-medium truncate max-w-[200px]"
                  >
                    {c.name}
                  </a>
                  <span className="text-gray-600 truncate">
                    {c.year} • {c.manufacturer} • {c.model} • {c.scale}
                  </span>
                </div>

                {/* Right: badges + edit */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className={`px-2 py-0.5 text-xs rounded-md font-medium ${
                      c.haveridden
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {c.haveridden ? "Ridden" : "Not ridden"}
                  </span>
                  {c.isbestcoaster && (
                    <span className="px-2 py-0.5 text-xs font-semibold rounded bg-yellow-100 text-yellow-800">
                      ⭐ Best
                    </span>
                  )}
                  <button
                    onClick={() => onEdit(c)}
                    title="Edit"
                    className="text-gray-500 hover:text-gray-700 text-sm"
                  >
                    🔧
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {optional.length > 0 && (
            <>
              <h3 className="text-lg font-semibold mt-4">Optional Coasters</h3>
              <ul className="space-y-1">
                {optional.map(c => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-2 text-sm md:text-base border-b border-gray-100 py-1"
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:gap-2 min-w-0">
                      <a
                        href={c.rcdbpath}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline font-medium truncate max-w-[200px]"
                      >
                        {c.name}
                      </a>
                      <span className="text-gray-600 truncate">
                        {c.year} • {c.manufacturer} • {c.model} • {c.scale}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`px-2 py-0.5 text-xs rounded-md font-medium ${
                          c.haveridden
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {c.haveridden ? "Ridden" : "Not ridden"}
                      </span>
                      <button
                        onClick={() => onEdit(c)}
                        title="Edit"
                        className="text-gray-500 hover:text-gray-700 text-sm"
                      >
                        🔧
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      ) : (
        <p>No roller coasters found.</p>
      )}
    </div>
  );
};

export default CoasterList;
