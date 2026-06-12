import { Metadata } from "next";
import ZoomleClient from "./ZoomleGame";

export const metadata: Metadata = {
  title: "Zoomle | ParkRating",
  description: "Guess the coaster as the image slowly reveals itself. Daily coaster spotting game.",
  alternates: { canonical: "https://parkrating.com/games/zoomle" },
};

export default ZoomleClient;
