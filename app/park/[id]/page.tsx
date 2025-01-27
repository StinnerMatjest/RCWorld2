"use client";
import { useEffect, useState } from "react";
import Image from "next/image";

interface Park {
  id: number;
  name: string;
  continent: string;
  country: string;
  city: string;
  imagepath: string;
}

const ParkPage = ({ params }: { params: { id: string } }) => {
  const [park, setPark] = useState<Park | null>(null);

  useEffect(() => {
    const fetchPark = async () => {
      try {
        const response = await fetch(`/api/park/${params.id}`);
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
  }, [params.id]);


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
