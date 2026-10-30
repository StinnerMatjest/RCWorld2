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
  /** Hero crops ("cx cy zoom"), set on the row that is the header. */
  focus_mobile?: string | null;
  focus_desktop?: string | null;
  /** Shown in the photo strip at the top of the page (none flagged = all shown). */
  featured?: boolean;
  /** Curated image framing on phones, in the park page's 4:5 deck card ("cx cy zoom"); null or absent = plain cover. */
  focus?: string | null;
  /** Curated image framing on desktop, in the 4:5 strip card (park page desktop, coaster page); null = use focus. */
  strip_focus?: string | null;
  /** Position of the photo in its gallery tile ("x y 1"); null = centred. */
  tile_focus?: string | null;
  /** Position as a photo break between review sections ("desktop|phone"); null = centred. */
  break_focus?: string | null;
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
