import type { Metadata } from "next";
import RatingEvaluationClient from "./RatingEvaluationClient";

export const metadata: Metadata = {
  title: "Rating Evaluation | ParkRating",
  description:
    "Understand how we rate theme parks across 10 criteria, including coasters, rides, park quality, food and management. Transparent scoring based on real experiences.",
};

export default function Page() {
  return <RatingEvaluationClient />;
}