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
  isbestcoaster: boolean;
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
  const sortedCoasters = [...coasters].sort((a, b) =>
    b.isbestcoaster === a.isbestcoaster ? 0 : b.isbestcoaster ? 1 : -1
  );
  const mainCoasters = sortedCoasters.filter(
    (coaster) => coaster.scale !== "Junior" && coaster.scale !== "Kiddie"
  );

  const optionalCoasters = sortedCoasters.filter(
    (coaster) => coaster.scale === "Junior" || coaster.scale === "Kiddie"
  );
  const [editingCoaster, setEditingCoaster] = useState<
    RollerCoaster | undefined
  >(undefined);

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
      <div className="relative w-full h-200">
        <img
          src={park.imagepath}
          alt={park.name}
          className="w-full h-full object-cover"
        />
        <h1 className="absolute bottom-4 left-6 text-7xl font-bold text-white p-4 rounded-md">
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
      <div className="w-full py-10 px-6 md:px-20 border border-gray-300 rounded-lg">
        <h2 className="text-3xl font-semibold mb-4">Roller Coasters</h2>
        <button
          onClick={() => setShowModal(true)}
          className="h-7 w-28 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition duration-300 cursor-pointer mb-2"
        >
          + Add Coaster
        </button>
        {loadingCoasters ? (
          <p>Loading coasters...</p>
        ) : coasters.length > 0 ? (
          <>
            <ul className="space-y-2 mb-8">
              {mainCoasters.map((coaster) => (
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
                  {coaster.isbestcoaster && (
                    <span className="ml-3 px-2 py-1 text-sm font-bold text-yellow-800 bg-yellow-200 rounded-md">
                      ⭐ Best Coaster
                    </span>
                  )}
                  <div className="flex items-center">
                    <span
                      onClick={() => {
                        setEditingCoaster(coaster);
                        setShowModal(true);
                      }}
                      className="text-gray-600 hover:text-gray-800 cursor-pointer text-xl"
                    >
                      🔧
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            {optionalCoasters.length > 0 && (
              <>
                <h3 className="text-2xl font-semibold mt-8 mb-2">
                  Optional Coasters
                </h3>
                <ul className="space-y-2">
                  {optionalCoasters.map((coaster) => (
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
                      {coaster.haveridden && (
                        <span className="ml-3 px-2 py-1 text-sm font-semibold rounded-md bg-green-200 text-green-700">
                          Have ridden
                        </span>
                      )}
                      {!coaster.haveridden &&
                        coaster.scale !== "Junior" &&
                        coaster.scale !== "Kiddie" && (
                          <span className="ml-3 px-2 py-1 text-sm font-semibold rounded-md bg-red-200 text-red-700">
                            Have not ridden
                          </span>
                        )}
                      <div className="flex items-center px-2">
                        <span
                          onClick={() => {
                            setEditingCoaster(coaster); // Set the coaster you're editing
                            setShowModal(true); // Open the modal
                          }}
                          className="text-gray-600 hover:text-gray-800 cursor-pointer text-xl"
                        >
                          🔧
                        </span>
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

        {showModal && (
          <CoasterCreatorModal
            parkId={Number(parkId)}
            coaster={editingCoaster} // ✅ This enables edit mode
            onClose={() => {
              setShowModal(false);
              setEditingCoaster(undefined); // Reset editing state when modal closes
            }}
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
