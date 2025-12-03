"use client";

import React, { useState } from "react";

type ImageUploaderModalProps = {
  parkId: number;
  parkName: string;
  onClose: () => void;
  onUploadSuccess?: () => void;
};

export default function ImageUploaderModal({
  parkId,
  parkName,
  onClose,
  onUploadSuccess,
}: ImageUploaderModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const uploadImage = async () => {
    if (!file) {
      setError("Please select an image file to upload.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", `${parkName} - ${description}`);

      const r2Response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!r2Response.ok) {
        throw new Error("Image upload failed.");
      }

      const r2Result = await r2Response.json();
      const imagePath = r2Result.imagePath;
      const title = `${parkName} - ${description}`;

      const galleryPayload = {
        title: title,
        description: description || "",
        path: imagePath,
        parkId,
      };

      const galleryResponse = await fetch(`/api/park/${parkId}/gallery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(galleryPayload),
      });

      if (!galleryResponse.ok) {
        const errorText = await galleryResponse.text();
        throw new Error("Failed to save gallery image: " + errorText);
      }

      if (onUploadSuccess) onUploadSuccess();
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error(err);
        setError(err.message || "Something went wrong.");
      } else {
        console.error("Unexpected error:", err);
        setError("An unexpected error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUploadClick = (e: React.FormEvent) => {
    e.preventDefault();
    uploadImage();
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center">
      <div className="relative bg-white dark:bg-gray-800 dark:text-gray-100 border border-transparent dark:border-white/10 rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
          Add Gallery Image
        </h2>

        <form onSubmit={handleUploadClick} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
              Image File
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full p-2 rounded-md border border-gray-300 bg-white text-gray-900 file:mr-4 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white
                         dark:bg-gray-900 dark:text-gray-100 dark:border-white/10 dark:file:bg-gray-800 dark:file:text-gray-100 dark:focus-visible:ring-offset-gray-800"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Image description (optional)"
              rows={3}
              className="block w-full p-3 rounded-md border border-gray-300 bg-white text-gray-900 placeholder-gray-400
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white
                         dark:bg-gray-900 dark:text-gray-100 dark:border-white/10 dark:placeholder-gray-500 dark:focus-visible:ring-offset-gray-800"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className={`px-4 py-2 rounded-md text-white transition cursor-pointer
                          focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white
                          dark:focus-visible:ring-offset-gray-800
                          ${
                            loading
                              ? "bg-blue-300 dark:bg-blue-400 cursor-not-allowed"
                              : "bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
                          }`}
            >
              {loading ? "Uploading..." : "Upload"}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-gray-300 text-gray-800 hover:bg-gray-100 cursor-pointer
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white
                         dark:border-white/10 dark:text-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 dark:focus-visible:ring-offset-gray-800"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
