"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";

interface Park {
  id: number;
  name: string;
  continent: string;
  country: string;
  city: string;
  imagepath: string;
}

const ParkPage = () => {
  const params = useParams(); // Correctly access params with useParams
  const parkId = params?.id; // Extract id safely
  const [park, setPark] = useState<Park | null>(null);

  useEffect(() => {
    if (!parkId) return; // Ensure parkId is defined
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
      <Image src={park.imagepath} alt={park.name} width={600} height={400} />
    </div>
  );
};

export default ParkPage;
