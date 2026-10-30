// The clean-up tool shows every framing on the real page: it loads the page
// in an iframe named "framing-preview" and moves the photo inside its real
// frame, so the overlays (navbar, gradients, names, scores, captions) are the
// page's own. Pages mark each framed photo for it:
//   data-framing="<key>"           on the frame (the box the photo fills)
//   data-framing-math="<how>"      how the page places the photo in it:
//     focused  - FocusedImage: cover x zoom, focus point at the centre, edges clamped
//     card     - the front page card: cover x zoom, focus point at the centre
//     cover    - placeCover: object-position from the focus point, no zoom
//     position - object-position percentages
//   class "framing-photo"          on the photo itself
// Frames the tool only shows as the page draws them carry just the marker:
// review-section photos (section:<url>) and gallery tiles (tile:<url>).
// Inside the preview a page turns off admin mode and analytics (and leaves the
// stored admin preference alone: the iframe shares storage with the tool).

export const FRAMING_PREVIEW = "framing-preview";

/** True inside the clean-up tool's preview iframe. Client only. */
export function isFramingPreview(): boolean {
  try {
    return typeof window !== "undefined" && window.name === FRAMING_PREVIEW;
  } catch {
    return false;
  }
}
