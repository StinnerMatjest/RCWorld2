export interface Park {
  id: number;
  name: string;
  continent: string;
  country: string;
  city: string;
  imagepath: string;
}

export interface Rating {
  id: number;
  date: string;
  parkAppearance: number;
  bestCoaster: number;
  waterRides: number;
  flatridesAndDarkrides: number;
  food: number;
  snacksAndDrinks: number;
  parkPracticality: number;
  rideOperations: number;
  parkManagement: number;
  overall: number;
  parkId: number;
  warnings?: RatingWarningType[];
}

export interface RatingWarningType {
  ratingId: number;
  ride: string;
  note: string;
  category: string;
}

export interface RollerCoaster {
  id: number;
  name: string;
  year: number;
  manufacturer: string;
  model: string;
  scale: string;
  haveridden: boolean;
  isbestcoaster: boolean;
  rcdbpath: string;
  ridecount: number;
  rating: number;
  parkId: number;
  specs?: RollerCoasterSpecs | null;
}

export interface RollerCoasterSpecs {
  type: string | null;
  classification: string | null;
  length: number | null;
  height: number | null;
  drop: number | null;
  speed: number | null;
  inversions: number | null;
  verticalAngle: number | null;
  gforce: number | null;
  duration: number | null;
  notes: string | null;
}


export type ApiCoaster = {
  id: number;
  name: string;
  manufacturer: string;
  model: string;
  scale: string;
  haveRidden: boolean;
  isBestCoaster: boolean;
  rcdbPath: string;
  rideCount: number;
  rating: number | string | null;
  parkId: number;
  parkName: string;
  year: number | null;
  lastVisitDate: string | null;
};

export type CoastleCoaster = {
  id: string;
  name: string;
  rating: number;
  manufacturer: string;
  park: string;
  rideCount: number;
  lastRidden: string | null;
  year: number;
  parkId: number;
  rcdbPath: string;
  countryName?: string;
};

export type MatchStatus = "correct" | "wrong";

export type Guess = {
  coaster: CoastleCoaster;
  matches: {
    park: MatchStatus;
    manufacturer: MatchStatus;
    rating: MatchStatus;
    year: MatchStatus;
    country: MatchStatus;
    rideCount: MatchStatus;
  };
};

export type Cell = {
  key: string;
  content: React.ReactNode;
  status: MatchStatus;
  noColor?: boolean;
  isArrow?: boolean;
  diff?: number;
  hiddenOnMobile?: boolean;
};

export type GameStats = {
  played: number;
  won: number;
  currentStreak: number;
  maxStreak: number;
  guessDistribution: number[];
};