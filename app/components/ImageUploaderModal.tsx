"use client";

import React, { useState } from "react";
import { useScrollLock } from "@/app/hooks/useScrollLock";

type ImageUploaderModalProps = {
  visitId: number;
  parkName: string;
  onCloseAction: () => void;
  onUploadSuccessAction?: () => void;
};

export default function ImageUploaderModal({
  visitId,
  parkName,
  onCloseAction,
  onUploadSuccessAction,
}: ImageUploaderModalProps) {
  useScrollLock();
  const [files, setFiles] = useState<File[]>([]);
  const [description, setDescription] = useState("");
  const [isHeader, setIsHeader] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New state for tracking upload progress
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadImage = async () => {
    if (files.length === 0) {
      setError("Please select at least one image file to upload.");
      return;
    }

    setError(null);
    setLoading(true);
    setUploadProgress(0);

    const isBulk = files.length > 1;
    const finalDescription = isBulk ? "" : description;
    const finalIsHeader = isBulk ? false : isHeader;

    try {
      await Promise.all(
        files.map(async (file, index) => {
          const formData = new FormData();
          formData.append("file", file);

          const fileSuffix = isBulk ? ` (${index + 1})` : "";
          const r2Title = finalDescription
            ? `${parkName} - ${finalDescription}${fileSuffix}`
            : `${parkName}${fileSuffix}`;

          formData.append("title", r2Title);

          // Upload to R2
          const r2Response = await fetch("/api/upload", { method: "POST", body: formData });
          if (!r2Response.ok) throw new Error(`Image upload failed for ${file.name}.`);

          const r2Result = await r2Response.json();
          const imagePath = r2Result.imagePath;

          // Build backend title automatically
          const backendTitle = `${parkName} - ${finalDescription || "untitled"}${fileSuffix}${finalIsHeader ? " - HEADER" : ""}`;

          const galleryPayload = {
            title: backendTitle,
            description: finalDescription,
            path: imagePath,
          };

          // Save to visit gallery
          const galleryResponse = await fetch(`/api/visits/${visitId}/gallery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(galleryPayload),
          });

          if (!galleryResponse.ok) {
            const errorText = await galleryResponse.text();
            throw new Error(`Failed to save gallery image ${file.name}: ` + errorText);
          }

          // Increment progress safely for concurrent promises
          setUploadProgress((prev) => prev + 1);
        })
      );

      if (onUploadSuccessAction) onUploadSuccessAction();
      onCloseAction();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message || "Something went wrong.");
      else setError("An unexpected error occurred");
      setLoading(false); // Only set to false on error so they can read it, otherwise modal closes
    }
  };

  const handleUploadClick = (e: React.FormEvent) => {
    e.preventDefault();
    uploadImage();
  };

  // Calculate percentage for the progress bar
  const progressPercentage = files.length > 0 ? Math.round((uploadProgress / files.length) * 100) : 0;

  return (
    // Removed backdrop-blur-sm, increased opacity to bg-black/80 for better performance
    <div className="fixed inset-0 z-[1000] bg-black/80 flex items-center justify-center">
      <div className="relative bg-gray-800 dark:text-gray-100 border border-white/10 rounded-lg shadow-xl w-full max-w-md mx-4 p-6">

        {loading ? (
          // --- UPLOADING STATE ---
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-6 animate-fadeIn">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>

            <div className="space-y-2 w-full px-4">
              <h3 className="text-xl font-bold text-white">Uploading Images...</h3>
              <p className="text-sm text-gray-400">
                {uploadProgress} of {files.length} completed
              </p>

              {/* Progress Bar */}
              <div className="w-full bg-gray-900 rounded-full h-2 mt-4 overflow-hidden border border-white/10">
                <div
                  className="bg-blue-500 h-2 transition-all duration-300 ease-out"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
            </div>
          </div>
        ) : (
          // --- FORM STATE ---
          <>
            <h2 className="text-xl font-semibold mb-4 text-white">
              Add Gallery Image
            </h2>

            <form onSubmit={handleUploadClick} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-300">
                  Image Files
                </label>
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={(e) => setFiles(Array.from(e.target.files || []))}
                  className="block w-full p-2 rounded-md border border-gray-300 bg-white text-gray-900 file:mr-4 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2
                             focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white
                             dark:bg-gray-900 dark:text-gray-100 dark:border-white/10 dark:file:bg-gray-800 dark:file:text-gray-100 dark:focus-visible:ring-offset-gray-800"
                />
                {files.length > 0 && (
                  <p className="mt-2 text-sm text-gray-400">
                    {files.length} file{files.length > 1 ? "s" : ""} selected.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-300">
                  Description
                </label>
                <textarea
                  value={files.length > 1 ? "" : description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={files.length > 1}
                  placeholder={files.length > 1 ? "Descriptions are disabled for bulk uploads" : "Image description (optional)"}
                  rows={3}
                  className={`block w-full p-3 rounded-md border 
 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 
 bg-gray-900 text-gray-100 border-white/10 placeholder-gray-500 focus-visible:ring-offset-gray-800
 ${files.length > 1 ? "opacity-50 cursor-not-allowed bg-gray-800/50" : ""}`}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isHeader"
                  checked={files.length > 1 ? false : isHeader}
                  onChange={(e) => setIsHeader(e.target.checked)}
                  disabled={files.length > 1}
                  className={`w-4 h-4 accent-blue-600 ${files.length > 1 ? "opacity-50 cursor-not-allowed" : ""}`}
                />
                <label
                  htmlFor="isHeader"
                  className={`text-sm ${files.length > 1 ? " text-gray-500" : " text-gray-300"}`}
                >
                  Header image {files.length > 1 && "(Disabled for bulk uploads)"}
                </label>
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md text-white transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800 bg-blue-500 hover:bg-blue-400"
                >
                  Upload
                </button>

                <button
                  type="button"
                  onClick={onCloseAction}
                  className="px-4 py-2 rounded-md border border-gray-300 text-gray-800 hover:bg-gray-100 cursor-pointer
                             focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white
                             dark:border-white/10 dark:text-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 dark:focus-visible:ring-offset-gray-800"
                >
                  Cancel
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}