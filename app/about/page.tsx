import type { Metadata } from "next";
import AboutClient from "./AboutClient";

export const metadata: Metadata = {
  title: "About Us | ParkRating",
  description:
    "Two brothers passionate about theme parks and roller coasters. We share honest, first-hand reviews, ratings and insights from parks across the world.",
};

export default function Page() {
  return <AboutClient />;
}