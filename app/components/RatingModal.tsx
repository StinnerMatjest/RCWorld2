"use client";
import React, { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Rating } from "../page";
import RatingSuccessMessage from "./RatingSuccessMessage";
import { useParks } from "../context/ParksContext";

interface ModalProps {
  closeModal: () => void;
  addNewRating: (newRating: Rating) => void;
}

const RatingModal: React.FC<ModalProps> = ({ closeModal, addNewRating }) => {
  const searchParams = useSearchParams();
  const isOpen = searchParams?.get("modal") === "true";

  const [ratings, setRatings] = useState<Record<string, number | null>>({});
  const [parkInfo, setParkInfo] = useState({
    name: "",
    continent: "",
    country: "",
    city: "",
    image: null as File | null,
  });

  const [message, setMessage] = useState<string>("");

  // State to manage collapsed/expanded sections
  const [isParkSectionExpanded, setParkSectionExpanded] = useState(false);
  const [isRatingSectionExpanded, setRatingSectionExpanded] = useState(false);

  const [checkboxState, setCheckboxState] = useState<{
    parkAppearance: boolean;
    bestCoaster: boolean;
  }>({
    parkAppearance: false,
    bestCoaster: false,
  });

  // Access parks context to update the parks list
  const { setParks } = useParks();

  type CheckboxState = {
    parkAppearance: boolean;
    bestCoaster: boolean;
  };

  // Handle rating changes and update checkbox state accordingly
  const handleInputChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    const numericValue = parseFloat(value);

    // Update the ratings state
    setRatings((prev) => ({
      ...prev,
      [name]: numericValue,
    }));

    setCheckboxState((prev: CheckboxState) => ({
      ...prev,
      [name as keyof CheckboxState]: numericValue === 5.0 ? false : prev[name as keyof CheckboxState],
    }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setCheckboxState((prev) => ({
      ...prev,
      [name as keyof CheckboxState]: checked,
    }));
  };

  const handleParkChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setParkInfo((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const isFormValid = () => {
    // Check if all park fields have values
    const areParkFieldsFilled =
      parkInfo.name && parkInfo.continent && parkInfo.country && parkInfo.city;

    // Check if all rating fields have values
    const areRatingFieldsFilled = [
      "parkAppearance",
      "bestCoaster",
      "waterRides",
      "otherRides",
      "food",
      "snacksAndDrinks",
      "parkPracticality",
      "rideOperations",
      "parkManagement",
      "value",
    ].every((key) => ratings[key] !== null && ratings[key] !== undefined);

    return areParkFieldsFilled && areRatingFieldsFilled;
  };

  const handleSubmit = () => {
    if (
      !parkInfo.name ||
      !parkInfo.continent ||
      !parkInfo.country ||
      !parkInfo.city
    ) {
      alert("Please fill in all park information");
      return;
    }

    // Check if an image file is provided
    if (!parkInfo.image) {
      alert("Please upload a park image");
      return;
    }

    // Generate a local URL for the image (for preview purposes)
    const imageURL = URL.createObjectURL(parkInfo.image);

    const newPark = {
      id: Math.random(),
      name: parkInfo.name,
      continent: parkInfo.continent,
      country: parkInfo.country,
      city: parkInfo.city,
      imagePath: imageURL,
    };

    const newRating: Rating = {
      id: Math.random(),
      date: new Date(),
      park: parkInfo.name,
      parkAppearance: ratings["parkAppearance"] || 0,
      bestCoaster: ratings["bestCoaster"] || 0,
      waterRides: ratings["waterRides"] || 0,
      otherRides: ratings["otherRides"] || 0,
      food: ratings["food"] || 0,
      snacksAndDrinks: ratings["snacksAndDrinks"] || 0,
      parkPracticality: ratings["parkPracticality"] || 0,
      rideOperations: ratings["rideOperations"] || 0,
      parkManagement: ratings["parkManagement"] || 0,
      value: ratings["value"] || 0,
      overall: 0,
      imagePath: imageURL,
    };

    // Adjust rating if checkbox is checked
    if (checkboxState.parkAppearance) newRating.parkAppearance += 1;
    if (checkboxState.bestCoaster) newRating.bestCoaster += 1;

    newRating.overall =
      (newRating.parkAppearance +
        newRating.bestCoaster +
        newRating.waterRides +
        newRating.otherRides +
        newRating.food +
        newRating.snacksAndDrinks +
        newRating.parkPracticality +
        newRating.rideOperations +
        newRating.parkManagement +
        newRating.value) /
      10;

    addNewRating(newRating);

    // Update parks list in context
    setParks((prevParks) => [...prevParks, newPark]);

    setMessage(
      `${newPark.name} has been added with a rating of: ${newRating.overall}!`
    );

    // Close modal after delay
    setTimeout(() => {
      closeModal();
      setMessage("");
    }, 2000);
  };

  if (!isOpen) return null;

  // Generate rating options from 5.0 to 0.5, decrementing by 0.5
  const ratingOptions = Array.from({ length: 10 }, (_, i) => (10 - i) * 0.5);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50"
      onClick={closeModal}
    >
      <div
        className="bg-white p-8 rounded-lg shadow-lg max-w-lg w-full h-auto relative"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
      >
        <button
          className="absolute top-4 left-4 text-gray-500 hover:text-gray-700 transition duration-300"
          onClick={closeModal}
        >
          ✕
        </button>

        <h2 className="text-3xl mb-6 text-center font-bold">Rate a Park</h2>

        {/* Display success message */}
        {message && (
          <RatingSuccessMessage
            message={message}
            onClose={() => setMessage("")}
          />
        )}

        <form className="space-y-4">
          {/* Park Section */}
          <div className="cursor-pointer">
            <div
              className="flex justify-between items-center"
              onClick={() => setParkSectionExpanded(!isParkSectionExpanded)}
            >
              <h3 className="text-lg font-semibold">Park</h3>
              <span>{isParkSectionExpanded ? "▲" : "▼"}</span>
            </div>
            {isParkSectionExpanded && (
              <div className="space-y-4 mt-2">
                <div>
                  <label htmlFor="name" className="block text-lg font-semibold">
                    Park Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={parkInfo.name}
                    onChange={handleParkChange}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    placeholder="Enter park name"
                  />
                </div>

                <div>
                  <label
                    htmlFor="continent"
                    className="block text-lg font-semibold"
                  >
                    Continent
                  </label>
                  <select
                    name="continent"
                    value={parkInfo.continent}
                    onChange={handleParkChange}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Select Continent</option>
                    <option value="Europe">Europe</option>
                    <option value="North America">North America</option>
                    <option value="Asia">Asia</option>
                    <option value="Australia">Australia</option>
                    <option value="Africa">Africa</option>
                    <option value="South America">South America</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="country"
                    className="block text-lg font-semibold"
                  >
                    Country
                  </label>
                  <input
                    type="text"
                    name="country"
                    value={parkInfo.country}
                    onChange={handleParkChange}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    placeholder="Enter country"
                  />
                </div>

                <div>
                  <label htmlFor="city" className="block text-lg font-semibold">
                    City
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={parkInfo.city}
                    onChange={handleParkChange}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    placeholder="Enter city"
                  />
                </div>

                {/* Image Selector */}
                <div>
                  <label
                    htmlFor="image"
                    className="block text-lg font-semibold"
                  >
                    Park Image
                  </label>
                  <input
                    type="file"
                    name="image"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setParkInfo((prev) => ({
                          ...prev,
                          image: file, // Store the file object in parkInfo
                        }));
                      }
                    }}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Rating Section */}
          <div className="cursor-pointer">
            <div
              className="flex justify-between items-center"
              onClick={() => setRatingSectionExpanded(!isRatingSectionExpanded)}
            >
              <h3 className="text-lg font-semibold">Ratings</h3>
              <span>{isRatingSectionExpanded ? "▲" : "▼"}</span>
            </div>
            {isRatingSectionExpanded && (
              <div className="space-y-4 mt-2">
                {[
                  "parkAppearance",
                  "bestCoaster",
                  "waterRides",
                  "otherRides",
                  "food",
                  "snacksAndDrinks",
                  "parkPracticality",
                  "rideOperations",
                  "parkManagement",
                  "value",
                ].map((category) => (
                  <div key={category} className="flex items-center space-x-4">
                    <div className="flex-grow">
                      <label
                        htmlFor={category}
                        className="block text-lg font-semibold"
                      >
                        {category.replace(/([A-Z])/g, " $1")}
                      </label>
                      <select
                        name={category}
                        value={ratings[category] || ""}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      >
                        <option value="">Select rating</option>
                        {ratingOptions.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </div>
                    {/* Render checkboxes*/}
                    {(category === "parkAppearance" ||
                      category === "bestCoaster") && (
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          name={category}
                          checked={
                            checkboxState[category as keyof CheckboxState]
                          }
                          onChange={handleCheckboxChange}
                          disabled={ratings[category] !== 5.0}
                        />
                        <label
                          htmlFor={category}
                          className="ml-2 text-sm text-gray-600"
                        >
                          Golden Point!
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleSubmit}
              className="px-6 py-2 bg-blue-600 text-white rounded-md"
              disabled={!isFormValid()}
            >
              Submit Rating
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RatingModal;
