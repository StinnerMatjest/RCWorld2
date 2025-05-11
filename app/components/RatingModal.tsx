"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import RatingSuccessMessage from "./RatingSuccessMessage";
import Loading from "./Loading";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import AuthenticationModal from "./AuthenticationModal";

interface ModalProps {
  closeModal: () => void;
  fetchRatingsAndParks: () => void;
}

const continentCountries: Record<string, string[]> = {
  Europe: [
    "Austria",
    "Belgium",
    "Bulgaria",
    "Croatia",
    "Czech Republic",
    "Denmark",
    "Finland",
    "France",
    "Germany",
    "Greece",
    "Hunagry",
    "Italy",
    "Malta",
    "Netherlands",
    "Norway",
    "Poland",
    "Portugal",
    "Republic of Ireland",
    "Romania",
    "Russia",
    "Spain",
    "Sweden",
    "Switzerland",
    "Turkey",
    "United Kingdom",
  ],
  NorthAmerica: ["Canada", "Mexico", "Puerto Rico", "United States"],
  CentralAmerica: [
    "Costa Rica",
    "Cuba",
    "Dominican Republic",
    "El Salvador",
    "Guatemala",
    "Honduras",
    "Nicaragua",
    "Panama",
  ],
  SouthAmerica: [
    "Argentina",
    "Bolivia",
    "Brazil",
    "Chile",
    "Columbia",
    "Ecuador",
    "Paraguay",
    "Uruguay",
    "Venezuela",
  ],
  Asia: ["Japan", "China", "India", "South Korea", "Thailand"],
  Oceania: ["Australia", "New Zealand", "Fiji"],
  Africa: ["South Africa", "Egypt", "Kenya", "Nigeria", "Morocco"],
  "South America": ["Brazil", "Argentina", "Chile", "Colombia", "Peru"],
};

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
  const [isParkSectionExpanded, setParkSectionExpanded] = useState(false);
  const [isRatingSectionExpanded, setRatingSectionExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [shouldSubmitAfterAuth, setShouldSubmitAfterAuth] = useState(false);

  const [checkboxState, setCheckboxState] = useState<{
    parkAppearance: boolean;
    bestCoaster: boolean;
  }>({
    parkAppearance: false,
    bestCoaster: false,
  });

  useEffect(() => {
  if (isAuthenticated && shouldSubmitAfterAuth) {
    handleSubmit();
    setShouldSubmitAfterAuth(false);
  }
}, [isAuthenticated, shouldSubmitAfterAuth]);


  const getRatingColor = (rating: number | string) => {
    if (
      rating === "" ||
      rating === "Select Rating" ||
      typeof rating !== "number"
    ) {
      return "text-black";
    }

    if (rating >= 10.0) return "rainbow-animation"; // GOAT
    if (rating >= 9.0) return "text-blue-700 dark:text-blue-400"; // Excellent
    if (rating >= 7.5) return "text-green-600 dark:text-green-400"; // Great
    if (rating >= 6.5) return "text-green-400 dark:text-green-300"; // Good
    if (rating >= 5.5) return "text-yellow-400 dark:text-yellow-300"; // Average
    if (rating >= 4.5) return "text-yellow-600 dark:text-yellow-500"; // Mediocre
    if (rating >= 3.0) return "text-red-400 dark:text-red-300"; // Poor
    if (rating <= 2.9) return "text-red-600 dark:text-red-500"; // Bad
    return "text-black"; // Fallback
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    const numericValue = parseFloat(value);

    if (!isNaN(numericValue)) {
      setRatings((prev) => ({
        ...prev,
        [name]: numericValue,
      }));

      setCheckboxState((prev) => ({
        ...prev,
        [name as keyof typeof checkboxState]:
          numericValue === 10.0
            ? false
            : prev[name as keyof typeof checkboxState],
      }));
    }
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setCheckboxState((prev) => ({
      ...prev,
      [name as keyof typeof checkboxState]: checked,
    }));
  };

  const handleParkChange = (
    e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>
  ) => {
    const { name, value } = e.target;

    // If the continent changes, reset the country selection
    if (name === "continent") {
      setParkInfo((prev) => ({
        ...prev,
        continent: value,
        country: "",
      }));
    } else {
      setParkInfo((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const isFormValid = () => {
    const areParkFieldsFilled =
      parkInfo.name &&
      parkInfo.continent &&
      parkInfo.country &&
      parkInfo.city &&
      parkInfo.image &&
      selectedDate !== null;

    const areRatingFieldsFilled = [
      "parkAppearance",
      "bestCoaster",
      "waterRides",
      "rideLineup",
      "food",
      "snacksAndDrinks",
      "parkPracticality",
      "rideOperations",
      "parkManagement",
    ].every((key) => ratings[key] !== null && ratings[key] !== undefined);

    return areParkFieldsFilled && areRatingFieldsFilled;
  };

  const handleSubmit = () => {
    if (!isFormValid()) {
      alert("Please fill out all required fields.");
      return;
    }

    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    submitData();
  };

  const submitData = async () => {
    setLoading(true);
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
          imagePath = r2Result.imagePath;
        } else {
          console.error("Image upload failed");
          alert("Failed to upload image. Please try again.");
          return;
        }
      }

      const parkPayload = {
        name: parkInfo.name,
        continent: parkInfo.continent,
        country: parkInfo.country,
        city: parkInfo.city,
        imagepath: imagePath,
      };

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
      console.log(savedPark);

      const ratingPayload = {
        ...ratings,
        date: selectedDate ? selectedDate.toISOString().split("T")[0] : "",
        parkId: savedPark.parkId,
        overall:
          ((ratings.parkAppearance ?? 0) +
            (checkboxState.parkAppearance ? 1 : 0) +
            (ratings.bestCoaster ?? 0) +
            (checkboxState.bestCoaster ? 1 : 0) +
            (ratings.waterRides ?? 0) +
            (ratings.rideLineup ?? 0) +
            (ratings.food ?? 0) +
            (ratings.snacksAndDrinks ?? 0) +
            (ratings.parkPracticality ?? 0) +
            (ratings.rideOperations ?? 0) +
            (ratings.parkManagement ?? 0)) /
          9,
        parkAppearance:
          (ratings.parkAppearance ?? 0) +
          (checkboxState.parkAppearance ? 1 : 0),
        bestCoaster:
          (ratings.bestCoaster ?? 0) + (checkboxState.bestCoaster ? 1 : 0),
      };

      const ratingResponse = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ratingPayload),
      });

      if (ratingResponse.ok) {
        setMessage(`${savedPark.message}`);
        setTimeout(() => closeModal(), 2000);
      } else {
        console.error("Failed to save rating");
      }
    } catch (error) {
      console.error("Submission error:", error);
      alert("Failed to submit. Please try again.");
    } finally {
      setLoading(false);
    }

    fetchRatingsAndParks();
  };

  if (!isOpen) return null;

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <div
        className="fixed inset-0 backdrop-blur-lg flex justify-center items-center"
        onClick={closeModal}
      >
        <div
          className="bg-white p-8 rounded-lg shadow-lg max-w-lg w-full max-h-[80vh] overflow-y-auto relative flex flex-col"
          onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
        >
          {/* Close button */}
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
          <div
            className="flex-1 overflow-y-auto px-3"
            style={{ maxHeight: "60vh" }}
          >
            <form className="space-y-4">
              {/* Park Section */}
              <div className="cursor-pointer">
                <div
                  className="flex justify-between items-center"
                  onClick={() => setParkSectionExpanded(!isParkSectionExpanded)}
                >
                  {/* Left arrow */}
                  <span className="mr-2">
                    {isParkSectionExpanded ? "▲" : "▼"}
                  </span>

                  {/* Text in the middle */}
                  <div className="flex-1 flex justify-center">
                    <h3 className="text-lg font-semibold">Park</h3>
                  </div>

                  {/* Right arrow */}
                  <span className="ml-2">
                    {isParkSectionExpanded ? "▲" : "▼"}
                  </span>
                </div>

                {isParkSectionExpanded && (
                  <div className="space-y-2 mt-2">
                    <div>
                      <label
                        htmlFor="visitDate"
                        className="block text-lg font-semibold"
                      >
                        Visit Date
                      </label>
                      <DatePicker
                        selected={selectedDate}
                        onChange={(date: Date | null) => setSelectedDate(date)}
                        className="w-96 p-2 border border-gray-300 rounded-md"
                        dateFormat="yyyy-MM-dd"
                        placeholderText="Select visit date"
                      />
                    </div>

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
                        className="w-96 p-2 border border-gray-300 rounded-md"
                        placeholder="Enter park name"
                        disabled={loading}
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
                        {Object.keys(continentCountries).map((continent) => (
                          <option key={continent} value={continent}>
                            {continent.replace(/([a-z])([A-Z])/g, "$1 $2")}{" "}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="country"
                        className="block text-lg font-semibold"
                      >
                        Country
                      </label>
                      <select
                        name="country"
                        value={parkInfo.country}
                        onChange={handleParkChange}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        disabled={!parkInfo.continent}
                      >
                        <option value="">Select Country</option>
                        {parkInfo.continent &&
                          continentCountries[parkInfo.continent].map(
                            (country) => (
                              <option key={country} value={country}>
                                {country}
                              </option>
                            )
                          )}
                      </select>
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
                        className="w-96 p-2 border border-gray-300 rounded-md"
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
                  {/* Left arrow */}
                  <span className="mr-2">
                    {isParkSectionExpanded ? "▲" : "▼"}
                  </span>

                  {/* Text in the middle */}
                  <div className="flex-1 flex justify-center">
                    <h3 className="text-lg font-semibold">Rating</h3>
                  </div>

                  {/* Right arrow */}
                  <span className="ml-2">
                    {isParkSectionExpanded ? "▲" : "▼"}
                  </span>
                </div>
                {isRatingSectionExpanded && (
                  <div className="space-y-4 mt-2">
                    {[
                      "parkAppearance",
                      "bestCoaster",
                      "waterRides",
                      "rideLineup",
                      "food",
                      "snacksAndDrinks",
                      "parkPracticality",
                      "rideOperations",
                      "parkManagement",
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
                            value={ratings[field]?.toFixed(1) || ""}
                            onChange={handleInputChange}
                            className={`w-full p-2 border border-gray-300 rounded-md ${getRatingColor(
                              ratings[field] ?? ""
                            )}`}
                          >
                            <option value="">Select Rating</option>
                            {[...Array(21)].map((_, i) => {
                              const base = 10 - i * 0.5;
                              if (base > 10) return null;
                              const formattedValue = base.toFixed(1);
                              const colorClass = getRatingColor(base);

                              return (
                                <option
                                  key={`${field}-${formattedValue}`}
                                  value={formattedValue}
                                  className={colorClass}
                                >
                                  {formattedValue}
                                </option>
                              );
                            })}
                          </select>

                          {/* GOLDEN RATINGS */}
                          {(field === "parkAppearance" ||
                            field === "bestCoaster") &&
                            ratings[field] === 10.0 && (
                              <div className="flex flex-col justify-center items-start h-full mt-2">
                                <label className="flex items-center space-x-2 select-none">
                                  <input
                                    type="checkbox"
                                    name={field}
                                    checked={checkboxState[field]}
                                    onChange={handleCheckboxChange}
                                    className="h-5 w-5 rounded border-gray-300 text-yellow-400 focus:ring-yellow-400 cursor-pointer"
                                  />
                                  <span className="text-sm font-medium text-gray-700">
                                    GOLDEN RATING
                                  </span>
                                </label>
                              </div>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="button"
                onClick={handleSubmit}
                className={`w-full p-3 text-white font-semibold rounded-md transition duration-300 cursor-pointer
        ${
          isFormValid()
            ? "bg-blue-500 hover:bg-blue-700"
            : "bg-gray-400 cursor-not-allowed"
        }`}
                disabled={!isFormValid() || loading}
              >
                {loading ? <Loading /> : "Submit Rating"}
              </button>
            </form>
          </div>
          {showAuthModal && (
            <AuthenticationModal
              onClose={() => setShowAuthModal(false)}
              onAuthenticated={() => {
                setIsAuthenticated(true);
                setShowAuthModal(false);
                setShouldSubmitAfterAuth(true);
              }}
            />
          )}
        </div>
      </div>
    </Suspense>
  );
};

export default RatingModal;
