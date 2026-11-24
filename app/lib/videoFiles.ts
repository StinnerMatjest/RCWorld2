/**
 * A clip on R2 is three files since 2026-11-24 (made by the upload route):
 * the clip itself at its full size, H.264 so every browser plays it (the stored
 * path; the viewers play this); `<name>-w1080.mp4`, at most 1920 px on the long
 * side, for playing inside a page; and `<name>-poster.webp`, a frame that lists,
 * tiles and pages show instead of loading the clip. Clips from before may lack
 * the two extra files: VideoThumb then decodes a frame, LazyVideo plays the clip.
 */
export const isVideoFile = (src: string) => /\.(mp4|webm|ogg|mov)(\?|$)/i.test(src);

const EXT = /\.(mp4|webm|ogg|mov)$/i;

/** The poster frame's URL for a clip's URL. */
export const posterUrl = (src: string) => src.replace(EXT, "-poster.webp");

/** The 1080 px copy's URL for a clip's URL. */
export const inlineUrl = (src: string) => src.replace(EXT, "-w1080.mp4");
