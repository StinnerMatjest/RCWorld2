export interface Park {
  id: number;
  name: string;
  continent: string;
  country: string;
  city: string;
  imagepath: string;
  cardImagepath?: string;
  slug: string;
  imageFocus?: string;
  headerFocus?: string;
  cardImages?: {
    coasters?: { src: string; focus: string };
    rides?: { src: string; focus: string };
    park?: { src: string; focus: string };
    food?: { src: string; focus: string };
    mgmt?: { src: string; focus: string };
  };
}

export interface Rating {
  id: number;
  date: string;
  parkAppearance: number;
  bestCoaster: number;
  coasterDepth: number;
  waterRides: number;
  flatridesAndDarkrides: number;
  food: number;
  snacksAndDrinks: number;
  parkPracticality: number;
  rideOperations: number;
  parkManagement: number;
  overall: number;
  parkId: number;
  published: boolean;
  warnings?: RatingWarningType[];
}

export interface RatingWarningType {
  id: number;
  ratingId: number;
  ride: string;
  note: string;
  category: string;
  severity: "Minor" | "Moderate" | "Major";
}

// NEW: Ride Types
export interface RideType {
  id: number;
  name: string;
  history: string | null;
  note: string | null;
}

// NEW: Ride Models
export interface RideModel {
  id: number;
  name: string;
  rideTypeId: number;
  rideType?: RideType;
  manufacturerId: number;
  manufacturer?: Manufacturer;
  year: string | null;
  inProduction: boolean;
  history: string | null;
  note: string | null;
}

export interface RollerCoaster {
  id: number;
  name: string;
  year: number;
  manufacturerId: number;
  manufacturerName?: string;
  manufacturer?: Manufacturer;

  // Backward compatibility: keep string model for now
  model: string;
  // Expand Phase: new relational columns
  rideModelId?: number | null;
  rideModel?: RideModel | null;

  scale: string;
  haveridden: boolean;
  isbestcoaster: boolean;
  ridecount: number;
  rating: number;
  parkId: number;
  slug: string;
  parkSlug?: string;
  isDefunct?: boolean; // NEW
  specs?: RollerCoasterSpecs | null;
  highlights?: RollerCoasterHighlights[] | null;
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

export interface RollerCoasterHighlights {
  category: string;
  severity: string;
}

export const MAJOR_MANUFACTURERS = [
  "Arrow Dynamics",
  "B&M",
  "GCI",
  "Gerstlauer",
  "Gravity Group",
  "Intamin",
  "Mack Rides",
  "Maurer",
  "Premier Rides",
  "RMC",
  "S&S Worldwide",
  "Schwarzkopf",
  "Vekoma",
  "Zamperla",
  "Zierer",
];

export const MINOR_MANUFACTURERS = [
  "abc rides",
  "Allan Herschell Company",
  "ART Engineering",
  "Barbisan",
  "Beijing Shibaolai",
  "BHS",
  "Chance Rides",
  "CCI",
  "Dinn Corporation",
  "Dynamic Attractions",
  "E&F Miler",
  "EOS Rides",
  "Extreme Engineering",
  "Fabbri",
  "Giovanola",
  "Gosetto",
  "Güven",
  "Hoei Sangyo",
  "Hopkins",
  "I.E. Park",
  "Interpark",
  "Jinma Rides",
  "L.A. Thompson",
  "L&T Systems",
  "Martin & Vleminckx",
  "Meisho",
  "Molina & Son's",
  "Morgan",
  "Pax Company",
  "Pinfari",
  "Preston & Barbieri",
  "PTC",
  "RCCA",
  "Reverchon",
  "RES Rides AG",
  "Sansei Technologies",
  "SBF Visa",
  "S.D.C.",
  "Senyo Kogyo",
  "Skyline Attractions",
  "Soquet",
  "Technical Park",
  "Togo",
  "Walther Queenland",
  "Wisdom Rides",
  "Zhipao",
];

export const ALL_MANUFACTURERS = [...MAJOR_MANUFACTURERS, ...MINOR_MANUFACTURERS].sort((a, b) =>
  a.localeCompare(b)
);

export type ApiCoaster = {
  id: number;
  name: string;
  manufacturerId: number;
  manufacturerName: string;

  // Backward compatibility
  model: string;
  // Expand Phase
  rideModelId?: number | null;
  rideModelName?: string;
  rideTypeName?: string;
  isDefunct?: boolean;

  scale: string;
  haveRidden: boolean;
  isBestCoaster: boolean;
  rideCount: number;
  rating: number | string | null;
  parkId: number;
  parkName: string;
  country: string;
  year: number | null;
  lastVisitDate: string | null;
  slug: string;
  parkSlug?: string;
  specs?: RollerCoasterSpecs | null;
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
  slug: string;
  countryName?: string;
  length?: number | null;      // ft
  height?: number | null;      // ft
  speed?: number | null;       // mph
  inversions?: number | null;  // count
};

export interface ManufacturerCoaster {
  id: number;
  name: string;
  model: string;
  year: number;
  slug: string;
  rating: number;
}

export interface Manufacturer {
  id: number;
  name: string;
  country: string | null;
  established: string | null;
  inBusiness: boolean;
  history: string | null;
  notes: string | null;
  rollercoasters: ManufacturerCoaster[];
}

export type MatchStatus = "correct" | "close" | "wrong";

export type GuessMatches = {
  manufacturer: MatchStatus;
  country: MatchStatus;
  length: MatchStatus;
  height: MatchStatus;
  speed: MatchStatus;
  inversions: MatchStatus;
};

export type Guess = {
  coaster: CoastleCoaster;
  matches: GuessMatches;
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

export interface RankingList {
  id: number;
  slug: string; // e.g., "top-15-waterrides-europe"
  title: string;
  introText: string;
  items: RankingListItem[];
}

export interface RankingListItem {
  id: number;
  rank: number;
  title: string;
  subtitle: string; // e.g., "Urayasu, Japan"
  textBlock1: string; // The first paragraph of text
  image1: string;     // The first image URL
  textBlock2?: string; // Optional second paragraph
  image2?: string;     // Optional second image URL
}

export type ChecklistItem = {
  id: string;
  label: string;
  checked: boolean;
  isPhotoTask?: boolean;
  imageUrl?: string | null;
  skipped?: boolean;
  isCoaster?: boolean;
  rideCount?: number;
  rideCountLastModified?: string;
  isExtra?: boolean;
};

export type ChecklistSession = {
  start: string;
  end: string | null;
};

export type Checklist = {
  id: number;
  title: string;
  slug: string;
  description: string;
  items: ChecklistItem[];
  visit_start?: string | null;
  visit_end?: string | null;
  duration?: number;
  is_finished?: boolean;
  park_id?: number;
  // Active tracking segments — pause/resume and multiday visits create several
  sessions?: ChecklistSession[] | null;
  // Per-rating-category notes, keyed like RatingModal's CATEGORIES (camelCase)
  notes?: Record<string, string> | null;
};