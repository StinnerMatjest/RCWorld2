"use client";

import React, { useState, useEffect } from "react";
import { Trip } from "./TripCard";

interface TripCreatorModalProps {
  trip?: Trip;
  onClose: () => void;
  onSaved: () => void;
}

export default function TripCreatorModal({ trip, onClose, onSaved }: TripCreatorModalProps) {
  const [countriesStr, setCountriesStr] = useState("");
  const [parksStr, setParksStr] = useState("");
  const [rcdbStr, setRcdbStr] = useState("");
  
  // Date and Undecided State
  const [isUndecided, setIsUndecided] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  const [status, setStatus] = useState<Trip["status"]>("planned");
  const [notes, setNotes] = useState("");
  const [mapLink, setMapLink] = useState("");
  const [tripLog, setTripLog] = useState<{ date: string; activity: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (trip) {
      setCountriesStr(Array.isArray(trip.country) ? trip.country.join(", ") : trip.country);
      setParksStr(trip.parks.join(", "));
      setRcdbStr(trip.rcdb ? trip.rcdb.join(", ") : "");
      setStatus(trip.status);
      setNotes(trip.notes || "");
      setMapLink(trip.mapLink || "");
      setTripLog(trip.tripLog || []);

      const datesAreTBD = trip.startDate === "undecided" || trip.endDate === "undecided";
      setIsUndecided(datesAreTBD);
      setStartDate(datesAreTBD ? "" : trip.startDate);
      setEndDate(datesAreTBD ? "" : trip.endDate);
    }
  }, [trip]);

  // Validation check & Limit Calculations
  const hasValidDatesForLogs = 
    isUndecided || 
    (startDate !== "" && endDate !== "" && new Date(endDate) >= new Date(startDate));

  let maxLogs = Infinity;
  let tripDays = 0;

  if (!isUndecided && hasValidDatesForLogs) {
    const startObj = new Date(startDate);
    const endObj = new Date(endDate);
    const diffTime = endObj.getTime() - startObj.getTime();
    tripDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
    maxLogs = tripDays + 1;
  }

  const canAddMoreLogs = hasValidDatesForLogs && tripLog.length < maxLogs;
  const isOverLogLimit = !isUndecided && hasValidDatesForLogs && tripLog.length > maxLogs;

  const addLogEntry = () => {
    if (canAddMoreLogs) {
      setTripLog([...tripLog, { date: "", activity: "" }]);
    }
  };

  const updateLogEntry = (index: number, field: "date" | "activity", value: string) => {
    const newLog = [...tripLog];
    newLog[index][field] = value;
    setTripLog(newLog);
  };

  const removeLogEntry = (index: number) => {
    setTripLog(tripLog.filter((_, i) => i !== index));
  };

  // Converts "Day X" into "Day X (DD.MM.YYYY)"
  const convertDayToDate = (inputVal: string) => {
    if (isUndecided || !startDate) return inputVal;
    
    // Check if they typed something like "Day 1" or "day 3"
    const dayMatch = inputVal.trim().match(/^day\s*(\d+)$/i);
    if (dayMatch) {
      const dayNum = parseInt(dayMatch[1], 10);
      if (dayNum > 0) {
        const d = new Date(startDate);
        // Add days (Day 1 means adding 0 days to start date, Day 2 means adding 1, etc.)
        d.setDate(d.getDate() + (dayNum - 1));
        
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        
        return `Day ${dayNum} (${day}.${month}.${year})`;
      }
    }
    return inputVal;
  };

  // Auto-fill when the user clicks out of the input
  const handleLogDateBlur = (index: number) => {
    const currentVal = tripLog[index].date;
    const convertedVal = convertDayToDate(currentVal);
    if (currentVal !== convertedVal) {
      updateLogEntry(index, "date", convertedVal);
    }
  };

  const handleDelete = async () => {
    if (!trip?.id) return;

    const confirmed = window.confirm("Are you sure you want to delete this trip? This cannot be undone.");
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const res = await fetch("/api/trips", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: trip.id }),
      });

      if (!res.ok) throw new Error("Failed to delete trip");
      onSaved();
      onClose();
    } catch (error) {
      console.error(error);
      alert("Something went wrong deleting the trip.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const finalTripLog = tripLog.map((log) => ({
      date: convertDayToDate(log.date).trim(),
      activity: log.activity.trim(),
    })).filter((log) => log.date || log.activity);

    const payload = {
      id: trip?.id,
      country: countriesStr.split(",").map((s) => s.trim()).filter(Boolean),
      parks: parksStr.split(",").map((s) => s.trim()).filter(Boolean),
      rcdb: rcdbStr.split(",").map((s) => s.trim()).filter(Boolean),
      startDate: isUndecided ? "undecided" : startDate,
      endDate: isUndecided ? "undecided" : endDate,
      status,
      notes: notes.trim() || null,
      mapLink: mapLink.trim() || null,
      tripLog: finalTripLog,
    };

    try {
      const res = await fetch("/api/trips", {
        method: trip ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save trip");
      onSaved();
      onClose();
    } catch (error) {
      console.error(error);
      alert("Something went wrong saving the trip.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-6">
        <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-4">
          <h2 className="text-2xl font-bold dark:text-white">
            {trip ? "Edit Trip" : "Create New Trip"}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-white text-2xl font-bold cursor-pointer">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-300">Countries (comma separated)</label>
              <input required type="text" value={countriesStr} onChange={(e) => setCountriesStr(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Denmark, Sweden" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-300">Parks (comma separated)</label>
              <input required type="text" value={parksStr} onChange={(e) => setParksStr(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Tivoli, Liseberg" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">RCDB Links (comma separated, matching park order)</label>
            <input type="text" value={rcdbStr} onChange={(e) => setRcdbStr(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="https://rcdb.com/..., ..." />
          </div>

          {/* Undecided Checkbox */}
          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="undecided-checkbox"
              checked={isUndecided}
              onChange={(e) => {
                setIsUndecided(e.target.checked);
                if (e.target.checked) {
                  setStartDate("");
                  setEndDate("");
                }
              }}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 cursor-pointer"
            />
            <label htmlFor="undecided-checkbox" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
              Dates are currently undecided (TBD / Backlog)
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-300">Start Date</label>
              <input 
                required={!isUndecided} 
                disabled={isUndecided}
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-300">End Date</label>
              <input 
                required={!isUndecided} 
                disabled={isUndecided}
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
                className={`w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed ${
                  startDate && endDate && new Date(endDate) < new Date(startDate) ? "border-red-500 focus:ring-red-500" : ""
                }`} 
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-300">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as Trip["status"])} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                <option value="booked">Booked</option>
                <option value="planned">Planned</option>
                <option value="backlog">Backlog</option>
                <option value="past">Past</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" rows={3} placeholder="Trip details..." />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">Google Maps Link</label>
            <input type="text" value={mapLink} onChange={(e) => setMapLink(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="http://maps.google.com/..." />
          </div>

          {/* Trip Logs */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold dark:text-white">
                Trip Log {tripDays > 0 && !isUndecided && <span className={`text-sm font-normal ${isOverLogLimit ? "text-red-500 font-bold" : "text-gray-500"}`}>({tripLog.length}/{maxLogs})</span>}
              </h3>
              <button 
                type="button" 
                onClick={addLogEntry} 
                disabled={!canAddMoreLogs}
                className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                + Add Entry
              </button>
            </div>

            {!hasValidDatesForLogs && (
              <p className="text-sm text-red-500 dark:text-red-400">
                ⚠️ Please select a valid Start and End date to add trip logs.
              </p>
            )}
            {hasValidDatesForLogs && !isUndecided && tripLog.length === maxLogs && (
              <p className="text-sm text-amber-500 dark:text-amber-400">
                ⚠️ Maximum of {maxLogs} logs reached for a {tripDays}-day trip.
              </p>
            )}
            {isOverLogLimit && (
              <p className="text-sm text-red-500 dark:text-red-400 font-bold">
                🚨 You have {tripLog.length} logs, but the maximum for a {tripDays}-day trip is {maxLogs}. Please remove {tripLog.length - maxLogs} log(s) to save.
              </p>
            )}

            {tripLog.map((log, i) => (
              <div key={i} className="flex gap-2 items-start">
                <input 
                  type="text" 
                  value={log.date} 
                  onChange={(e) => updateLogEntry(i, "date", e.target.value)} 
                  onBlur={() => handleLogDateBlur(i)}
                  disabled={!hasValidDatesForLogs}
                  className="w-1/3 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed" 
                  placeholder="Day 1" 
                />
                <input 
                  type="text" 
                  value={log.activity} 
                  onChange={(e) => updateLogEntry(i, "activity", e.target.value)} 
                  disabled={!hasValidDatesForLogs}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed" 
                  placeholder="Activity" 
                />
                <button 
                  type="button" 
                  onClick={() => removeLogEntry(i)} 
                  disabled={!hasValidDatesForLogs}
                  className="text-red-500 hover:text-red-700 p-2 font-bold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  ×
                </button>
              </div>
            ))}
            
            {hasValidDatesForLogs && !isUndecided && (
              <p className="text-xs text-gray-500 dark:text-gray-400 pt-1">
                💡 Tip: Type "Day 1", "Day 2", etc. and click away to automatically calculate the date.
              </p>
            )}
          </div>

          <div className="pt-4 flex justify-between items-center border-t border-gray-200 dark:border-gray-700 mt-4">
            {/* Delete Button */}
            <div>
              {trip?.id && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting || loading}
                  className="px-4 py-2 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isDeleting ? "Deleting..." : "Delete Trip"}
                </button>
              )}
            </div>

            {/* Cancel and Save Buttons */}
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 border rounded text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer cursor-pointer">
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={loading || isDeleting || !hasValidDatesForLogs || isOverLogLimit} 
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Saving..." : "Save Trip"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}