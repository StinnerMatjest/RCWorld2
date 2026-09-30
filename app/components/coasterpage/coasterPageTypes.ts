// Shapes shared by the coaster page and its editors.

export interface CoasterTextEntry {
  id: number;
  coaster_id?: number;
  headline: string | null;
  text: string | null;
  order: number;
  isSpoiler?: boolean;
  /** Up to three gallery media entries in the stored "url|cx cy zoom,…" form. */
  imageUrl?: string | null;
  /** One of SECTION_LAYOUTS, or null for the default (alternating sides). */
  imageLayout?: string | null;
}

export interface CoasterGalleryImage {
  id: number;
  title: string;
  path: string;
  description: string;
  is_header?: boolean;
}

/** A neighbour in a ranking list or a sibling coaster at the same park. */
export type CoasterMini = {
  id: number;
  name: string;
  slug: string;
  parkName?: string;
  manufacturerName?: string;
  year?: number | null;
  rating: number | null;
  rank?: number;
  isBest?: boolean;
};
