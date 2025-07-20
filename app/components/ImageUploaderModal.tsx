"use client";

import React, { useState } from "react";
import AuthenticationModal from "./AuthenticationModal";

type ImageUploaderModalProps = {
  parkId: number;
  onClose: () => void;
  onUploadSuccess?: () => void;
};

export default function ImageUploaderModal({
  parkId,
  onClose,
  onUploadSuccess,
}: ImageUploaderModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [postAuthAction, setPostAuthAction] = useState<"upload" | null>(null);

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

      const r2Response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!r2Response.ok) {
        throw new Error("Image upload failed.");
      }

      const r2Result = await r2Response.json();
      const imagePath = r2Result.imagePath;

      const galleryPayload = {
        title,
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

    if (!isAuthenticated) {
      setPostAuthAction("upload");
      setShowAuthModal(true);
      return;
    }
    uploadImage();
  };

  return (
    <>
      <div className="fixed inset-0 backdrop-blur-lg z-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg w-full max-w-md mx-4 p-6 relative">
          <h2 className="text-xl font-semibold mb-4">Add Gallery Image</h2>

          <form onSubmit={handleUploadClick} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Image File
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full border rounded px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Image title (optional)"
                className="block w-full border rounded px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Image description (optional)"
                rows={3}
                className="block w-full border rounded px-3 py-2 text-sm"
              />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className={`bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition ${
                  loading ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {loading ? "Uploading..." : "Upload"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-100 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>

      {showAuthModal && (
        <AuthenticationModal
          onClose={() => setShowAuthModal(false)}
          onAuthenticated={() => {
            setIsAuthenticated(true);
            setShowAuthModal(false);
            if (postAuthAction === "upload") {
              uploadImage();
              setPostAuthAction(null);
            }
          }}
        />
      )}
    </>
  );
}
