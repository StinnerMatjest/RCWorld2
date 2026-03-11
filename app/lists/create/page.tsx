// app/lists/create/page.tsx
"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAdminMode } from "@/app/context/AdminModeContext";
import ImageSelectorModal from "@/app/components/listpage/ImageSelectorModal";

function ListEditorForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const editSlug = searchParams.get("edit"); // e.g., ?edit=my-list-slug
    const isEditing = !!editSlug;

    const { isAdminMode } = useAdminMode();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(isEditing);

    const [title, setTitle] = useState("");
    const [slug, setSlug] = useState("");
    const [introText, setIntroText] = useState("");
    const [items, setItems] = useState<any[]>([]);
    
    const [activeImageTarget, setActiveImageTarget] = useState<{ index: number; field: "image1" | "image2" } | null>(null);

    // Redirect if not admin
    useEffect(() => {
        if (!isAdminMode) router.push("/lists");
    }, [isAdminMode, router]);

    // If editing, fetch existing data
    useEffect(() => {
        if (isEditing && editSlug) {
            const fetchList = async () => {
                try {
                    const res = await fetch(`/api/lists/${editSlug}`);
                    if (!res.ok) throw new Error("Failed to fetch list");
                    const data = await res.json();

                    setTitle(data.rankingList.title);
                    setSlug(data.rankingList.slug);
                    setIntroText(data.rankingList.introText);
                    setItems(data.rankingList.items.sort((a: any, b: any) => a.rank - b.rank));
                } catch (error) {
                    console.error(error);
                    alert("Could not load the list for editing.");
                } finally {
                    setIsLoading(false);
                }
            };
            fetchList();
        }
    }, [isEditing, editSlug]);

    // Auto-generate slug from title ONLY when creating a new list
    useEffect(() => {
        if (!isEditing && !isLoading) {
            setSlug(title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, ""));
        }
    }, [title, isEditing, isLoading]);

    const handleAddItem = () => {
        setItems([
            ...items,
            {
                id: Date.now(),
                rank: items.length + 1,
                title: "",
                subtitle: "",
                textBlock1: "",
                image1: "",
                textBlock2: "",
                image2: "",
            },
        ]);
    };

    const updateItem = (index: number, field: string, value: string | number) => {
        const newItems = [...items];
        newItems[index][field] = value;
        setItems(newItems);
    };

    const removeItem = (index: number) => {
        const newItems = items.filter((_, i) => i !== index);
        newItems.forEach((item, i) => (item.rank = i + 1));
        setItems(newItems);
    };

    const handleDeleteList = async () => {
        if (!isEditing || !editSlug) return;
        if (!confirm(`Are you sure you want to delete "${title}"? This cannot be undone.`)) return;

        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/lists/${editSlug}`, { method: "DELETE" });
            if (res.ok) {
                router.push("/lists");
                router.refresh();
            } else {
                alert("Failed to delete list.");
            }
        } catch (err) {
            console.error(err);
            alert("An error occurred during deletion.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const method = isEditing ? "PUT" : "POST";
            const url = isEditing ? `/api/lists/${editSlug}` : `/api/lists`;

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, slug, introText, items }),
            });

            const contentType = res.headers.get("content-type");
            let data = null;
            if (contentType && contentType.includes("application/json")) {
                data = await res.json();
            }

            if (res.ok) {
                const finalSlug = isEditing ? (data?.newSlug || slug) : slug;
                router.push(`/lists/${finalSlug}`);
                router.refresh();
            } else {
                const errorMsg = data?.error || `Server returned ${res.status}`;
                alert("Error: " + errorMsg);
            }
        } catch (err) {
            console.error("Fetch error:", err);
            alert("Something went wrong! Check the console for details.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isAdminMode) return null;
    if (isLoading) return <div className="p-20 text-center dark:text-white">Loading editor...</div>;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-10 px-4 sm:px-6">
            {activeImageTarget && (
                <ImageSelectorModal
                    onClose={() => setActiveImageTarget(null)}
                    onSelect={(url) => {
                        updateItem(activeImageTarget.index, activeImageTarget.field, url);
                        setActiveImageTarget(null);
                    }}
                />
            )}

            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-black mb-8 dark:text-white uppercase tracking-tight">
                    {isEditing ? "Edit List" : "Create New List"}
                </h1>

                <form onSubmit={handleSubmit} className="space-y-12">
                    {/* Main List Info */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
                        <h2 className="text-xl font-bold dark:text-white mb-4 border-b pb-2">List Details</h2>

                        <div>
                            <label className="block text-sm font-semibold mb-1 dark:text-gray-300">Title</label>
                            <input required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold mb-1 dark:text-gray-300">Slug (URL)</label>
                            <input required value={slug} onChange={(e) => setSlug(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold mb-1 dark:text-gray-300">Introductory Text</label>
                            <textarea required value={introText} onChange={(e) => setIntroText(e.target.value)} rows={4} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                    </div>

                    {/* Dynamic Items Array */}
                    <div className="space-y-8">
                        <h2 className="text-2xl font-bold dark:text-white">List Items (Sections)</h2>

                        {items.map((item, index) => (
                            <div key={item.id} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border-l-4 border-teal-500 relative">
                                <button type="button" onClick={() => removeItem(index)} className="absolute top-4 right-4 text-red-500 hover:text-red-700 font-bold cursor-pointer">
                                    Remove
                                </button>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                                    <div className="md:col-span-1">
                                        <label className="block text-sm font-semibold mb-1 dark:text-gray-300">Rank #</label>
                                        <input type="number" required value={item.rank} onChange={(e) => updateItem(index, "rank", Number(e.target.value))} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className="block text-sm font-semibold mb-1 dark:text-gray-300">Item Title</label>
                                        <input required value={item.title} onChange={(e) => updateItem(index, "title", e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                    </div>
                                    <div className="md:col-span-4">
                                        <label className="block text-sm font-semibold mb-1 dark:text-gray-300">Subtitle (Optional)</label>
                                        <input value={item.subtitle || ""} onChange={(e) => updateItem(index, "subtitle", e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                    </div>
                                </div>

                                {/* Item Content Block */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg mb-4 border border-gray-200 dark:border-gray-700">
                                    <div>
                                        <label className="block text-sm font-semibold mb-1 dark:text-gray-300">Text Block 1</label>
                                        <textarea required value={item.textBlock1} onChange={(e) => updateItem(index, "textBlock1", e.target.value)} rows={6} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                    </div>
                                    <div className="flex flex-col">
                                        <label className="block text-sm font-semibold mb-1 dark:text-gray-300">Image 1</label>
                                        <div className="flex-grow min-h-[160px] border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center p-4 bg-white dark:bg-gray-800 relative overflow-hidden group">
                                            {item.image1 ? (
                                                <>
                                                    <img src={item.image1} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                        <button type="button" onClick={() => setActiveImageTarget({ index, field: "image1" })} className="px-3 py-1 bg-white text-black text-sm font-bold rounded shadow cursor-pointer">Change</button>
                                                        <button type="button" onClick={() => updateItem(index, "image1", "")} className="px-3 py-1 bg-red-600 text-white text-sm font-bold rounded shadow cursor-pointer">Clear</button>
                                                    </div>
                                                </>
                                            ) : (
                                                <button type="button" onClick={() => setActiveImageTarget({ index, field: "image1" })} className="text-blue-500 hover:text-blue-600 font-semibold flex items-center gap-2 cursor-pointer">
                                                    Select Image
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Optional Content Block */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                                    <div className="flex flex-col">
                                        <label className="block text-sm font-semibold mb-1 dark:text-gray-300">Image 2 (Optional)</label>
                                        <div className="flex-grow min-h-[160px] border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center p-4 bg-white dark:bg-gray-800 relative overflow-hidden group">
                                            {item.image2 ? (
                                                <>
                                                    <img src={item.image2} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                        <button type="button" onClick={() => setActiveImageTarget({ index, field: "image2" })} className="px-3 py-1 bg-white text-black text-sm font-bold rounded shadow cursor-pointer">Change</button>
                                                        <button type="button" onClick={() => updateItem(index, "image2", "")} className="px-3 py-1 bg-red-600 text-white text-sm font-bold rounded shadow cursor-pointer">Clear</button>
                                                    </div>
                                                </>
                                            ) : (
                                                <button type="button" onClick={() => setActiveImageTarget({ index, field: "image2" })} className="text-blue-500 hover:text-blue-600 font-semibold flex items-center gap-2 cursor-pointer">
                                                    Select Image
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold mb-1 dark:text-gray-300">Text Block 2 (Optional)</label>
                                        <textarea value={item.textBlock2 || ""} onChange={(e) => updateItem(index, "textBlock2", e.target.value)} rows={6} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                    </div>
                                </div>
                            </div>
                        ))}

                        <button type="button" onClick={handleAddItem} className="w-full py-4 border-2 border-dashed border-teal-500 text-teal-600 dark:text-teal-400 font-bold rounded-xl hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors cursor-pointer">
                            + Add New Section (Item)
                        </button>
                    </div>

                    {/* Bottom Action Bar */}
                    <div className="sticky bottom-0 bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-md py-4 border-t border-gray-200 dark:border-gray-800 flex justify-between gap-4">
                        {isEditing && (
                            <button
                                type="button"
                                onClick={handleDeleteList}
                                disabled={isSubmitting}
                                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg transition-all disabled:opacity-50 cursor-pointer"
                            >
                                Delete List
                            </button>
                        )}
                        <div className="flex gap-4 ml-auto">
                            <button type="button" onClick={() => router.back()} className="px-6 py-3 font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors cursor-pointer">
                                Cancel
                            </button>
                            <button type="submit" disabled={isSubmitting} className="w-full md:w-auto px-10 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-lg rounded-xl shadow-lg transition-all disabled:opacity-50 cursor-pointer">
                                {isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Publish List"}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function CreateListPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center dark:text-white">Loading...</div>}>
            <ListEditorForm />
        </Suspense>
    );
}