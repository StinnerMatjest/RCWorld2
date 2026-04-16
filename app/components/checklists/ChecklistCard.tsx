"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { Checklist } from "@/app/types";

function formatDuration(totalSeconds: number): string {
    if (!totalSeconds || totalSeconds <= 0) return "0m";
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours === 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
}

export default function ChecklistCard({ checklist }: { checklist: Checklist }) {
    const router = useRouter();
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const isCompleted = checklist.is_finished;
    const isInProgress = checklist.visit_start && !checklist.is_finished;
    const taskCount = checklist.items?.length || 0;
    const completedCount = checklist.items?.filter((i) => i.checked).length || 0;

    // Calculate accurate duration for the dashboard
    let displayDuration = checklist.duration || 0;
    if (isInProgress && checklist.visit_start) {
        const startMs = new Date(checklist.visit_start).getTime();
        displayDuration = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
    }

    // Format the visiting date
    const visitDate = checklist.visit_start
        ? new Date(checklist.visit_start).toLocaleDateString('en-GB', {
            month: "short",
            day: "numeric",
            year: "numeric",
        })
        : null;

    // Format the start and end times
    const startTime = checklist.visit_start
        ? new Date(checklist.visit_start).toLocaleTimeString('en-GB', {
            hour: "2-digit",
            minute: "2-digit",
        })
        : null;

    const endTime = checklist.visit_end
        ? new Date(checklist.visit_end).toLocaleTimeString('en-GB', {
            hour: "2-digit",
            minute: "2-digit",
        })
        : null;

    async function handleDelete() {
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/checklists/${checklist.slug}`, {
                method: "DELETE",
            });
            if (res.ok) {
                setShowDeleteModal(false);
                router.refresh();
            } else {
                console.error("Failed to delete checklist");
            }
        } catch (err) {
            console.error("Delete error:", err);
        } finally {
            setIsDeleting(false);
        }
    }

    return (
        <>
            <div className="group relative block overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 transition-colors hover:border-emerald-500/50 hover:bg-slate-800/80 active:scale-[0.98]">

                {/* Delete Button */}
                <button
                    onClick={() => setShowDeleteModal(true)}
                    className="absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded-full text-slate-400 transition-all hover:bg-rose-500/20 hover:text-rose-400 sm:right-4 sm:top-4 sm:h-8 sm:w-8 sm:bg-slate-950/80 sm:opacity-0 sm:group-hover:opacity-100"
                    title="Delete Checklist"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:h-4 sm:w-4">
                        <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                </button>

                {/* Card Link Wrapper */}
                <Link href={`/checklists/${checklist.slug}`} className="block p-5 sm:pr-8">
                    <div className="mb-2 flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-slate-100 transition-colors group-hover:text-emerald-400 pr-8 sm:pr-0">
                            {checklist.title}
                        </h2>
                    </div>
                    <p className="mb-4 text-sm text-slate-400">{checklist.description}</p>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Status Badge */}
                        {isCompleted ? (
                            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                Completed
                            </span>
                        ) : isInProgress ? (
                            <span className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
                                <span className="relative flex h-1.5 w-1.5">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
                                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                                </span>
                                In Progress
                            </span>
                        ) : (
                            <span className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                                Not Started
                            </span>
                        )}

                        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-400">
                            <span>{completedCount} / {taskCount} Tasks</span>

                            {(isInProgress || isCompleted) && (
                                <>
                                    <span className="text-slate-700">•</span>
                                    {visitDate && <span>{visitDate}</span>}

                                    {/* NEW: Time range rendering */}
                                    {startTime && (
                                        <>
                                            <span className="text-slate-700">•</span>
                                            <span>
                                                {startTime} - {endTime ? endTime : "Now"}
                                            </span>
                                        </>
                                    )}

                                    {displayDuration > 0 && (
                                        <>
                                            <span className="text-slate-700">•</span>
                                            <span className="text-emerald-500/80">{formatDuration(displayDuration)}</span>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </Link>
            </div>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {showDeleteModal && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-4 backdrop-blur-sm sm:items-center"
                    >
                        <motion.div
                            initial={{ y: "100%", opacity: 0, scale: 1 }}
                            animate={{ y: 0, opacity: 1, scale: 1 }}
                            exit={{ y: "100%", opacity: 0 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="w-full max-w-sm rounded-3xl bg-slate-900 p-6 shadow-2xl sm:border sm:border-rose-500/20 sm:scale-[0.98]"
                        >
                            <h2 className="mb-2 text-xl font-bold text-slate-50">Delete Checklist?</h2>
                            <p className="mb-6 text-sm text-slate-300">
                                Are you sure you want to permanently delete your <span className="font-semibold text-emerald-400">{checklist.title}</span> checklist? This cannot be undone.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowDeleteModal(false)}
                                    disabled={isDeleting}
                                    className="flex-1 rounded-xl bg-slate-800 py-3.5 text-sm font-semibold text-slate-300 hover:bg-slate-700 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                    className="flex-1 rounded-xl bg-rose-500 py-3.5 text-sm font-semibold text-slate-950 hover:bg-rose-400 disabled:opacity-50"
                                >
                                    {isDeleting ? "Deleting..." : "Delete"}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}