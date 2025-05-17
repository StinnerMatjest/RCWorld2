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
import GoogleMapView from "@/app/components/GoogleMapView";
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
  parkAppearance:
    "Extremely unique and immersive, Phantasialand delivers an otherworldly level of quality and consistency — not unlike what you'd experience at DisneySea in Japan. The park draws you in and refuses to let go, until ten hours later you realize you can't find the exit. A truly worthy 10, and the first of its kind on Parkrating as of 2025.",
  bestCoaster:
    "F.L.Y takes the crown as the park’s standout coaster, closely followed by Taron. While it may lack raw intensity and features a slightly awkward riding position, its stunning theming and clever layout — filled with near-misses and flybys — more than make up for it.",
  waterRides:
    "It didn’t take long for our second-ever perfect 10 to appear. Chiapas easily claims the title of the world’s best log flume, while River Quest is an unforgettable adventure in its own right. The only thing missing? A third water ride — otherwise, we might’ve broken the scale.",
  rideLineup:
    "Phantasialand chooses quality and uniqueness over filler, with headline experiences like Winjas, F.L.Y, Crazy Bats, and Mystery Castle. A 9.5 is more than deserved — and if a few more high-caliber rides are added, the park is headed straight for its third 10.",
  food:
    "From the moment we bit into our burger at Uhrwerk, with F.L.Y soaring past the window, it was clear: Phantasialand doesn’t compromise on food. With beautifully themed venues and high-quality meals, it's safe to assume the rest of the park’s dining follows suit.",
  snacksAndDrinks:
    "We're getting spoiled by Phantasialand’s attention to detail — so much so that we're knocking off points for the absence of soft ice with churros. Still, the creative mocktails and wide snack variety across the park kept us happily nibbling throughout the day.",
  parkPracticality:
    "The price of immersion is navigation. While beautifully themed, the park layout is tricky, ride entrances can be elusive, and rest areas are scarce. Thankfully, a solid app and good signage help keep frustration in check.",
  rideOperations:
    "Phantasialand operates like a well-oiled machine, with efficient dispatches and proactive queue management throughout. The only hiccup? Taron being down for a few hours early in the day — otherwise, it would’ve been near-perfect.",
  parkManagement:
    "Phantasialand runs a tight ship with no facility closures and a polished overall experience. But it’s baffling that a park this rich in detail offers little in the way of merchandise — unless you’re in the market for a waving plastic cat.",
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
      setRatings(
        data.ratings.filter((r: Rating) => r.parkId === Number(parkId))
      );
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
            <div className="border-t border-gray-300 my-3" />
            <h2 className="text-xl font-semibold mb-1 py-1">Location Map</h2>
            <GoogleMapView />
          </div>

          <div>
            <div className="border-t border-gray-300 my-3" />
            <RatingPanel ratings={ratings} />
          </div>
        </div>

        {/* Introduction and Rating Explanations */}
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-semibold">Introduction</h2>
            <div className="border-t border-gray-300 my-3" />
            <p className="text-gray-700 text-base leading-relaxed">
              Step into another world — quite literally. Phantasialand is where immersive theming,
              world-class attractions, and atmosphere collide to create an unforgettable theme park
              experience. It&apos;s the kind of place where 10 hours slip by unnoticed as you wander
              through intricately detailed lands, ride some of Europe&apos;s most inventive attractions,
              and chase churros with mocktails. Whether you&apos;re a thrill-seeker, a theming enthusiast, 
              or a foodie on a rollercoaster diet, this park has something magical in store. Read on
              to find out why it&apos;s making history on Parkrating.
            </p>
          </div>

          <RatingExplanations ratings={ratings} explanations={explanations} />
        </div>

        {/* Coasters */}
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
          {/* Gallery */}
          <Gallery images={galleryImages} />
        </div>
      </div>
      <div className="flex justify-center py-10">
        <MainPageButton />
      </div>
    </div>
  );
};

export default ParkPage;
