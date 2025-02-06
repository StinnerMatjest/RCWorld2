"use client";
import React, { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import RatingSuccessMessage from "./RatingSuccessMessage";

interface ModalProps {
  closeModal: () => void;
  fetchRatingsAndParks: () => void;
}

const RatingModal: React.FC<ModalProps> = ({
  closeModal,
  fetchRatingsAndParks,
}) => {
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

  type CheckboxState = {
    parkAppearance: boolean;
    bestCoaster: boolean;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;

    // Ensure the value is parsed to a number properly
    const numericValue = parseFloat(value);

    // Only update if the numeric value is valid (i.e., not NaN)
    if (!isNaN(numericValue)) {
      setRatings((prev) => ({
        ...prev,
        [name]: numericValue,
      }));

      setCheckboxState((prev: CheckboxState) => ({
        ...prev,
        [name as keyof CheckboxState]:
          numericValue === 5.0 ? false : prev[name as keyof CheckboxState],
      }));
    }
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

  const handleSubmit = async () => {
    if (!isFormValid()) {
      alert("Please fill out all required fields.");
      return;
    }

    try {
      let imagePath = "/images/Error.PNG";

      if (parkInfo.image) {
        const formData = new FormData();
        formData.append("file", parkInfo.image);

        const r2Response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (r2Response.ok) {
          const r2Result = await r2Response.json();
          console.log("R2 Response:", r2Result);
          imagePath = r2Result.imagePath;
        } else {
          console.error("Image upload failed");
          alert("Failed to upload image. Please try again.");
          return;
        }
      }

      // Ensure the imagePath is assigned before the payload
      const parkPayload = {
        name: parkInfo.name,
        continent: parkInfo.continent,
        country: parkInfo.country,
        city: parkInfo.city,
        imagepath: imagePath,
      };

      console.log("Name: " + parkInfo.name);
      console.log("Continent: " + parkInfo.continent);
      console.log("Country: " + parkInfo.country);
      console.log("City: " + parkInfo.city);
      console.log("Image Path: " + parkPayload.imagepath);

      const parkResponse = await fetch("/api/parks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parkPayload),
      });

      if (!parkResponse.ok) {
        const error = await parkResponse.json();
        console.error("Error creating park:", error);
        alert(`Error creating park: ${error.message || "Unknown error"}`);
        return;
      }

      const savedPark = await parkResponse.json();
      console.log("Park saved:", savedPark);

      const ratingPayload = {
        ...ratings,
        date: new Date().toISOString().split("T")[0],
        parkId: savedPark.parkId,
        overall:
          ((ratings.parkAppearance ?? 0) + (checkboxState.parkAppearance ? 1 : 0) +
            (ratings.bestCoaster ?? 0) + (checkboxState.bestCoaster ? 1 : 0) +
            (ratings.waterRides ?? 0) +
            (ratings.otherRides ?? 0) +
            (ratings.food ?? 0) +
            (ratings.snacksAndDrinks ?? 0) +
            (ratings.parkPracticality ?? 0) +
            (ratings.rideOperations ?? 0) +
            (ratings.parkManagement ?? 0) +
            (ratings.value ?? 0)) /
          10,
        parkAppearance:
          (ratings.parkAppearance ?? 0) + (checkboxState.parkAppearance ? 1 : 0),
        bestCoaster:
          (ratings.bestCoaster ?? 0) + (checkboxState.bestCoaster ? 1 : 0),
      };
      
      

      const ratingResponse = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ratingPayload),
      });

      if (ratingResponse.ok) {
        setMessage(`${savedPark.name} has been added with a rating.`);
        setTimeout(() => closeModal(), 2000);
      } else {
        console.error("Failed to save rating");
      }
    } catch (error) {
      console.error("Submission error:", error);
      alert("Failed to submit. Please try again.");
    }

    fetchRatingsAndParks();
  };

  if (!isOpen) return null;

  return (
    <Suspense fallback={<div>Loading...</div>}>
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
                    <label
                      htmlFor="name"
                      className="block text-lg font-semibold"
                    >
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
                    <label
                      htmlFor="city"
                      className="block text-lg font-semibold"
                    >
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
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          // Just save the file in parkInfo, no upload yet
                          setParkInfo({
                            ...parkInfo,
                            image: file,
                          });
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
                onClick={() =>
                  setRatingSectionExpanded(!isRatingSectionExpanded)
                }
              >
                <h3 className="text-lg font-semibold">Rating</h3>
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
                  ].map((field) => (
                    <div key={field} className="flex items-center space-x-4">
                      {/* Rating Section */}
                      <div className="flex-1">
                        <label
                          htmlFor={field}
                          className="block text-lg font-semibold"
                        >
                          {field.replace(/([A-Z])/g, " $1").toUpperCase()}
                        </label>
                        <select
                          name={field}
                          value={ratings[field]?.toFixed(1) || ""} // Ensure formatting here for value
                          onChange={handleInputChange}
                          className="w-full p-2 border border-gray-300 rounded-md"
                        >
                          <option value="">Select Rating</option>
                          {[...Array(9)].map((_, i) => {
                            const base = 5 - i * 0.5;
                            if (base > 5.0) return null; // Limit to 5.0
                            const formattedValue = base.toFixed(1); // Ensures values are like "1.0", "2.0"
                            return (
                              <option
                                key={`${field}-${formattedValue}`}
                                value={formattedValue}
                              >
                                {formattedValue}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {/* Checkbox for specific fields */}
                      {(field === "parkAppearance" ||
                        field === "bestCoaster") && (
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            name={field}
                            disabled={ratings[field] !== 5.0}
                            checked={checkboxState[field]}
                            onChange={handleCheckboxChange}
                          />
                          <span className="text-sm">
                            GOLDEN RATING
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              className="w-full p-3 bg-blue-500 text-white font-semibold rounded-md"
              disabled={!isFormValid()}
            >
              Submit Rating
            </button>
          </form>
        </div>
      </div>
    </Suspense>
  );
};

export default RatingModal;
