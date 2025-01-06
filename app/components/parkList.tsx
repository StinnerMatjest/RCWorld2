import React from "react";
import { parks } from "../parks/page";

const ParkList = () => {
  return (
    <div>
      <h1>Parks List</h1>
      <ul>
        {parks.map((park) => (
          <li key={park.id}>
            <h2>{park.name}</h2>
            <p>Continent: {park.continent}</p>
            <p>Continent: {park.country}</p>
            <p>Continent: {park.city}</p>
            <p>Rating: {park.rating}</p>
            <img src={park.parkImageURL} alt={park.name} width="200" />
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ParkList;
