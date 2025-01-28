"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export interface Park {
  id: number;
  name: string;
  continent: string;
  country: string;
  city: string;
  imagepath: string;
}

const ParkPage = () => {
  const params = useParams();
  const parkId = params?.id;
  const [park, setPark] = useState<Park | null>(null);

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

    fetchPark();
  }, [parkId]);

  if (!park) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>{park.name}</h1>
      <p>{park.continent}</p>
      <p>{park.country}</p>
      <p>{park.city}</p>
      <img src={park.imagepath} alt={park.name} width={800} height={500} />
    </div>
  );
};

export default ParkPage;
