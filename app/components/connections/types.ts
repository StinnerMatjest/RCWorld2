import { Park } from "@/app/types"
import { RollerCoaster } from "@/app/types"

export type Category = {
  id: string
  label: string
  difficulty: "yellow" | "green" | "blue" | "purple"
  getCoasterIds: (coasters: RollerCoaster[], parks: Park[]) => number[]
}

export type PuzzleGroup = {
  categoryId: string
  label: string
  difficulty: "yellow" | "green" | "blue" | "purple"
  coasterIds: number[]
}

export type DailyPuzzle = {
  seed: string
  groups: PuzzleGroup[]
}

export type ConnectionsStats = {
  played: number;
  won: number;
  currentStreak: number;
  maxStreak: number;
  guessDistribution: [number, number, number, number, number];
};