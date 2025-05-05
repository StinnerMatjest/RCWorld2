"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import MainPageButton from "@/app/components/MainPageButton";
import CoasterCreatorModal from "@/app/components/CoasterCreatorModal";
import RatingPanel from "@/app/components/RatingPanel";
import RatingExplanations from "@/app/components/RatingExplanations";
import Coasterlist from "@/app/components/Coasterlist";
import ParkHeader from "@/app/components/ParkHeader";
import ParkInfo from "@/app/components/ParkInfo";
import Gallery from "@/app/components/Gallery";
import GoogleMapView from "@/app/components/GoogleMapView"; // ✅ updated path
import type { Park, Rating, RollerCoaster } from "@/app/types";

// Sample gallery images (replace with real data)
const galleryImages = [
  "https://cdn.pixabay.com/photo/2014/11/11/09/32/roller-coaster-526534_1280.jpg",
  "https://cdn.pixabay.com/photo/2016/09/25/20/35/carowinds-1694539_1280.jpg",
  "https://cdn.pixabay.com/photo/2023/04/22/02/19/roller-coaster-7942853_1280.jpg",
  "https://cdn.pixabay.com/photo/2015/09/12/21/21/abendstimmung-937403_1280.jpg",
  "https://cdn.pixabay.com/photo/2015/09/03/00/45/disney-919926_1280.jpg",
  "https://cdn.pixabay.com/photo/2018/11/17/11/15/rollercoaster-3820916_1280.jpg",
];

// Rating explanation text
const explanations: Record<string, string> = {
  parkAppearance: "The park's appearance is well-maintained, but a few areas could use some improvement.",
  bestCoaster: "The best coaster is thrilling but could benefit from smoother transitions.",
  waterRides: "Water rides are fun but can get overcrowded during peak hours.",
  rideLineup: "The ride lineup is diverse, but some older rides need maintenance.",
  food: "Food options are delicious and diverse, though a bit on the expensive side.",
  snacksAndDrinks: "Good variety of snacks and drinks, though lines can be long during peak times.",
  parkPracticality: "The park layout is easy to navigate with plenty of signage.",
  rideOperations: "Ride operations are generally efficient, though some lines can be long.",
  parkManagement: "The park management is responsive, but improvements can be made in queue management.",
};

const ParkPage: React.FC = () => {
  const { id: parkId } = useParams();
  const [park, setPark] = useState<Park | null>(null);
  const [coasters, setCoasters] = useState<RollerCoaster[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loadingCoasters, setLoadingCoasters] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCoaster, setEditingCoaster] = useState<RollerCoaster>();

  useEffect(() => {
    if (!parkId) return;
    (async () => {
      const [parkRes, coastersRes, ratingsRes] = await Promise.all([
        fetch(`/api/park/${parkId}`),
        fetch(`/api/park/${parkId}/coasters`),
        fetch(`/api/ratings?parkId=${parkId}`),
      ]);
      setPark(await parkRes.json());
      setCoasters(await coastersRes.json());
      setLoadingCoasters(false);
      const data = await ratingsRes.json();
      setRatings(data.ratings.filter((r: Rating) => r.parkId === Number(parkId)));
    })();
  }, [parkId]);

  const refreshCoasters = async () => {
    const res = await fetch(`/api/park/${parkId}/coasters`);
    setCoasters(await res.json());
  };

  if (!park) return <div>Loading park...</div>;

  return (
    <div className="w-full">
      <ParkHeader park={park} />

      {/* Layout: Info | Ratings | Coasters */}
      <div className="grid grid-cols-1 md:grid-cols-[20%_1fr_1fr] gap-6 w-full py-10 px-6 md:px-20 bg-base-200">
        {/* Info Panel */}
        <div className="bg-blue-50 rounded-2xl p-6 shadow-sm text-center space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-1">Park Info</h2>
            <div className="border-t border-gray-300 my-3" />
            <ParkInfo park={park} />
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-1">Location Map</h2>
            <div className="border-t border-gray-300 my-3" />
            <GoogleMapView />
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-1">Quick Ratings</h2>
            <div className="border-t border-gray-300 my-3" />
            <RatingPanel ratings={ratings} />
          </div>
        </div>

        {/* Explanations */}
        <div className="space-y-6">
          <RatingExplanations ratings={ratings} explanations={explanations} />
        </div>

        {/* Coasters + Gallery */}
        <div className="space-y-6">
          <Coasterlist
            coasters={coasters}
            loading={loadingCoasters}
            onAdd={() => {
              setEditingCoaster(undefined);
              setShowModal(true);
            }}
            onEdit={(c) => {
              setEditingCoaster(c);
              setShowModal(true);
            }}
          />
          <Gallery images={galleryImages} />
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <CoasterCreatorModal
          parkId={Number(parkId)}
          coaster={editingCoaster}
          onClose={() => {
            setShowModal(false);
            setEditingCoaster(undefined);
            refreshCoasters();
          }}
          onCoasterAdded={refreshCoasters}
        />
      )}

      <div className="flex justify-center py-10">
        <MainPageButton />
      </div>
    </div>
  );
};

export default ParkPage;
