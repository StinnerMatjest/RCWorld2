"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import MainPageButton from "@/app/components/MainPageButton";
import CoasterCreatorModal from "@/app/components/CoasterCreatorModal";

export interface Park {
  id: number;
  name: string;
  continent: string;
  country: string;
  city: string;
  imagepath: string;
}

export interface RollerCoaster {
  id: number;
  name: string;
  year: number;
  manufacturer: string;
  model: string;
  scale: string;
  haveridden: boolean;
  rcdbpath: string;
}

const scaleOrder = [
  "Thrill",
  "Family-Thrill",
  "Family",
  "Family-Chill",
  "Junior",
  "Kiddie",
];

const ParkPage = () => {
  const params = useParams();
  const parkId = params?.id;
  const [park, setPark] = useState<Park | null>(null);
  const [coasters, setCoasters] = useState<RollerCoaster[]>([]);
  const [loadingCoasters, setLoadingCoasters] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!parkId) return;

    const fetchPark = async () => {
      try {
        const response = await fetch(`/api/park/${parkId}`);
        if (!response.ok) {
          throw new Error("Park not found");
        }
        const data = await response.json();
        setPark(data);
      } catch (error) {
        console.error("Error fetching park:", error);
      }
    };

    const fetchCoasters = async () => {
      try {
        const response = await fetch(`/api/park/${parkId}/coasters`);
        if (!response.ok) {
          throw new Error("Coasters not found");
        }
        const data = await response.json();

        const sortedCoasters = data.sort(
          (a: RollerCoaster, b: RollerCoaster) =>
            scaleOrder.indexOf(a.scale) - scaleOrder.indexOf(b.scale)
        );

        setCoasters(sortedCoasters);
      } catch (error) {
        console.error("Error fetching coasters:", error);
      } finally {
        setLoadingCoasters(false);
      }
    };

    fetchPark();
    fetchCoasters();
  }, [parkId]);

  if (!park) {
    return <div>Loading park...</div>;
  }

  const refreshCoasters = async () => {
    try {
      const response = await fetch(`/api/park/${parkId}/coasters`);
      if (!response.ok) {
        throw new Error("Coasters not found");
      }
      const data = await response.json();

      // Sort based on scale order
      const sortedCoasters = data.sort(
        (a: RollerCoaster, b: RollerCoaster) =>
          scaleOrder.indexOf(a.scale) - scaleOrder.indexOf(b.scale)
      );

      setCoasters(sortedCoasters);
    } catch (error) {
      console.error("Error fetching coasters:", error);
    } finally {
      setLoadingCoasters(false);
    }
  };

  return (
    <div className="w-full">
      <div className="relative w-full h-[400px]">
        <img
          src={park.imagepath}
          alt={park.name}
          className="w-full h-full object-cover"
        />
        <h1 className="absolute bottom-4 left-6 text-6xl font-bold text-white bg-black bg-opacity-60 p-4 rounded-md">
          {park.name}
        </h1>
      </div>

      {/* Park Info Section */}
      <div className="w-full py-10 px-6 md:px-20 bg-base-200">
        <h2 className="text-3xl font-semibold mb-4">Park Information</h2>
        <div className="text-lg grid grid-cols-1 md:grid-cols-3 gap-6">
          <p>
            <strong>Continent:</strong> {park.continent}
          </p>
          <p>
            <strong>Country:</strong> {park.country}
          </p>
          <p>
            <strong>City:</strong> {park.city}
          </p>
        </div>
      </div>

      {/* Roller Coasters Section */}
      <div className="w-full py-10 px-6 md:px-20">
        <h2 className="text-3xl font-semibold mb-4">Roller Coasters</h2>
        <button
          onClick={() => setShowModal(true)}
          className="text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition duration-300 cursor-pointer"
        >
          + Add Coaster
        </button>
        {loadingCoasters ? (
          <p>Loading coasters...</p>
        ) : coasters.length > 0 ? (
          <ul className="space-y-2">
            {coasters.map((coaster) => (
              <li
                key={coaster.id}
                className="text-lg flex items-center space-x-2"
              >
                <a
                  href={coaster.rcdbpath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  {coaster.name}
                </a>{" "}
                - {coaster.year} {coaster.manufacturer} ({coaster.model} -{" "}
                {coaster.scale})
                <span
                  className={`ml-3 px-2 py-1 text-sm font-semibold rounded-md ${
                    coaster.haveridden
                      ? "bg-green-200 text-green-700"
                      : "bg-red-200 text-red-700"
                  }`}
                >
                  {coaster.haveridden ? "Have ridden" : "Have not ridden"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>No roller coasters found.</p>
        )}

        {showModal && (
          <CoasterCreatorModal
            parkId={park.id}
            onClose={() => setShowModal(false)}
            onCoasterAdded={refreshCoasters}
          />
        )}
      </div>

      {/* Comment Section */}
      <div className="w-full py-10 px-6 md:px-20 bg-base-200">
        <h2 className="text-3xl font-semibold mb-4">Notes</h2>
        <p className="text-lg">Park notes.</p>
      </div>

      <div className="flex justify-center py-10">
        <MainPageButton />
      </div>
    </div>
  );
};

export default ParkPage;
