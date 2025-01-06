import React from 'react'
import ParkList from '../components/parkList';

interface Park {
    id: number;
    name: string;
    continent: string;
    country: string;
    city: string;
    rating: number;
    parkImageURL: string;
}

export const parks: Park[] = [
    {
      id: 1,
      name: "Djurs Sommerland",
      continent: "Europe",
      country: "Denmark",
      city: "Nimtofte",
      rating: 3.0,
      parkImageURL: "https://example.com/mountain-adventure.jpg",
    },
    {
      id: 2,
      name: "Toverland",
      continent: "Europe",
      country: "Netherlands",
      city: "Sevenum",
      rating: 3.5,
      parkImageURL: "https://example.com/mountain-adventure.jpg",
    },
    {
      id: 3,
      name: "Walibi Belgium",
      continent: "Europe",
      country: "Belgium",
      city: "Wavre",
      rating: 4.0,
      parkImageURL: "https://example.com/mountain-adventure.jpg",
    },
    {
      id: 4,
      name: "Cedar Point",
      continent: "North America",
      country: "United States",
      city: "Sandusky",
      rating: 5.0,
      parkImageURL: "https://example.com/mountain-adventure.jpg",
    },
  ];

const ParksPage = () => {
  return (
    <div>
    <ParkList/>
    </div>


  )
}
export default ParksPage