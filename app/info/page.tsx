import React from 'react'
import MainPageButton from '../components/MainPageButton'

const page = () => {
  return (
<div className="max-w-4xl mx-auto px-6 py-10 bg-white text-gray-900 leading-relaxed text-lg rounded-2xl shadow-md">
  <h1 className="text-3xl font-bold mb-6">HOW WE EVALUATE RATINGS</h1> 
  <p className="mb-6">
  <strong>USING 10-POINT SCALE</strong> (with half points)
</p>
<section className="mb-6">
  <h2 className="text-xl font-semibold">Park Appearance</h2>
  <p>The overall visual impact of a park</p>
  <ul className="list-disc list-inside">
    <li>Location</li>
    <li>Ride & Queue theming</li>
    <li>Immersion</li>
    <li>Cleanliness</li>
    <li>Wear & Tear</li>
  </ul>
</section>
<section className="mb-6">
  <h2 className="text-xl font-semibold">Best Coaster</h2>
  <p>Score for the single best coaster in the park</p>
  <ul className="list-disc list-inside">
    <li>Layout</li>
    <li>Length</li>
    <li>Intensity / pace</li>
    <li>Smoothness</li>
    <li>Overall experience</li>
  </ul>
</section>
<section className="mb-6">
  <h2 className="text-xl font-semibold">Water Rides</h2>
  <p>The overall score of the water rides in the park</p>
  <ul className="list-disc list-inside">
    <li>Quantity</li>
    <li>Quality</li>
    <li>Self-riding boats does not count</li>
    <li>Water coasters is both a coaster (for best coaster) and a water ride</li>
  </ul>
</section>
<section className="mb-6">
  <h2 className="text-xl font-semibold">Ride-lineup</h2>
  <p>The overall quality of the ride-lineup THAT WE HAVE EXPERIENCED</p>
  <ul className="list-disc list-inside">
    <li>Entirely closed rides does not count to ride-lineup</li>
    <li>Best Coaster and Water Rides counts </li>
    <li>Other Notable rides (great flat rides, dark-rides and a deep coaster lineup)</li>
    <li>Overall quantity and variety counts</li>
    <li>Children rides does not count</li>
  </ul>
</section>
<section className="mb-6">
  <h2 className="text-xl font-semibold">Food</h2>
  <p>EAT BURGER</p>
  <ul className="list-disc list-inside">
    <li>Quality</li>
    <li>Selection / Variation</li>
  </ul>
</section>
<section className="mb-6">
  <h2 className="text-xl font-semibold">Snacks & Drinks</h2>
  <p>Quality of variety of snacks and drinks</p>
  <ul className="list-disc list-inside">
    <li>Quality</li>
    <li>Selection / Variation</li>
  </ul>
</section>
<section className="mb-6">
  <h2 className="text-xl font-semibold">Park Practicality</h2>
  <p>How practical it is to navigate and experience the park</p>
  <ul className="list-disc list-inside">
    <li>Park App</li>
    <li>Signage / navigation</li>
    <li>Park Layout</li>
    <li>Ride entrance location</li>
    <li>Facility placements</li>
    <li>Benches/bins/shading</li>
  </ul>
</section>
<section className="mb-6">
  <h2 className="text-xl font-semibold">Ride operations</h2>
  <p>How well the park opperates their rides (how good are they at running them and keeping them running)</p>
  <ul className="list-disc list-inside">
    <li>Speed of dispatches</li>
    <li>Trains in operation / stagging</li>
    <li>Queue handling</li>
    <li>Passenger interactions</li>
    <li>Ride breakdowns</li>
  </ul>
</section>
<section className="mb-6">
  <h2 className="text-xl font-semibold">Park Management</h2>
  <p>How the park is managed and run</p>
  <ul className="list-disc list-inside">
    <li>Facility Closures</li>
    <li>General Service</li>
    <li>Park Policies</li>
    <li>Staggered openings</li>
    <li>Parking fees</li>
    <li>MERCH</li>
  </ul>
</section>
      <div className="flex-shrink-0">
      <MainPageButton/>
    </div>
</div>
  )
}

export default page