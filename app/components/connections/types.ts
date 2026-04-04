export type Park = {
  id: number
  name: string
  continent: string
  country: string
  city: string
  imagepath: string
  slug: string
}

export type Coaster = {
  id: number
  name: string
  year: number
  manufacturer: string
  model: string
  scale: string
  haveridden: boolean
  isbestcoaster: boolean
  rcdbpath: string
  rideCount: number
  ridecount: number
  rating: string | null
  parkId: number
  slug: string
  parkSlug: string
  parkName: string
  lastVisitDate: string
  visitCount: number
  specs: {
    type: string | null
    classification: string | null
    length: number | null
    height: number | null
    drop: number | null
    speed: number | null
    inversions: number | null
    verticalAngle: number | null
    gforce: number | null
    duration: number | null
    notes: string | null
  }
}

export type Category = {
  id: string
  label: string
  difficulty: "yellow" | "green" | "blue" | "purple"
  getCoasterIds: (coasters: Coaster[], parks: Park[]) => number[]
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