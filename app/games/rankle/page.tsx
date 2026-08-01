import { Metadata } from "next";
import RankleClient from "./RankleClient";

export const metadata: Metadata = {
  title: "Rankle | ParkRating",
  description:
    "Spin the reel, place your bet and pick the right coaster. Stat duels that get harder every round.",
  alternates: { canonical: "https://parkrating.com/games/rankle" },
};

export default RankleClient;
