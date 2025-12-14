"use client";

import React, { useEffect, useState } from "react";

interface CoasterTextEntry {
  id: number;
  coaster_id: number;
  headline: string | null;
  text: string | null;
}

interface Props {
  coasterId: number;
}

const CoasterText: React.FC<Props> = ({ coasterId }) => {
  const [texts, setTexts] = useState<CoasterTextEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!coasterId) return;

    const fetchTexts = async () => {
      try {
        const res = await fetch(`/api/coasters/${coasterId}/text`);
        const data = await res.json();
        setTexts(data.texts || []);
      } catch (err) {
        console.error("Failed to fetch coaster text:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTexts();
  }, [coasterId]);

  if (loading) {
    return (
      <p className="text-center text-gray-500 dark:text-gray-400">
        Loading coaster information...
      </p>
    );
  }

  if (!texts.length) {
    return (
      <p className="text-center text-gray-600 dark:text-gray-400">
        No coaster description available yet.
      </p>
    );
  }

  return (
    <div className="space-y-10 pt-6">
      {texts.map((entry) => (
        <div
          key={entry.id}
          className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-300 dark:border-white/10"
        >
          <h3 className="text-2xl font-semibold dark:text-white mb-4">
            {entry.headline || "Coaster Information"}
          </h3>

          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
            {entry.text || ""}
          </p>
        </div>
      ))}
    </div>
  );
};

export default CoasterText;
