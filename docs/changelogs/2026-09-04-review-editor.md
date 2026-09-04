# The review editor got a rebuild (4 September 2026)

Writing a review now happens in a full-screen editor with the finished section rendered live beside your text.

## Try this first

1. Open any park in admin mode and click the wrench next to the "Review" heading, same as before.
2. Pick a section on the left and start typing. The right side shows the section exactly as the park page will render it.
3. Press Ctrl+S to save. Only the sections you touched are saved. The blue button tells you how many are waiting.
4. Press Esc or the X to close. If something is unsaved it asks first.

There is no draft backup. If you close the tab or refresh without saving, the text is gone. Save often with Ctrl+S.

## Full-screen editor with live preview (new)

- Three columns on desktop: sections on the left, your text and images in the middle, the rendered result on the right.
- The preview is the real thing. It runs through the same code as the park page, so spacing, image crops, bold, bullets and spoilers look identical.
- "As admin" and "As visitor" toggle above the preview. Visitor view shows spoiler blur the way readers see it.
- Click an image in the preview to open its position dialog.
- On mobile the editor switches between Write and Preview with a toggle at the top.

## Saving (new)

- Only changed sections are saved. Edited sections show an amber "edited" tag in the left list until saved.
- The save button counts: "Save 2" means two sections are waiting. "Saved" means everything is on the server.
- Closing with unsaved work asks for confirmation and names the sections involved.
- Unpublish only appears when the review is actually published.

## Image positioning now matches the page (fixed)

When you picked two images for a section, the position dialog showed the wide one-image frame, but the page rendered the two images side by side in a squarer frame. So the focus point you set looked different after saving.

The dialog now uses the exact frame the page will use for that layout and image count. Switch layout and the frame follows. In two-image mode the first image is already cropped against the two-image frame, even before you pick the second.

| Layout | Frame |
| --- | --- |
| Left / Right | 3:2 |
| Above / Below, one image | 16:7 on desktop |
| Above / Below, two images | 3:2 each, side by side |
| Double | 16:7 each, image / text / image |

## The description gets images like every other section (new)

- One or two images, any layout. Left, Right, Above, Below and Double now all work for the introduction text too.
- Existing descriptions look the same. Their default is "Below", which is how they rendered before. Nothing moves until you pick a layout.

## Writing feels less odd (improved)

- The text box grows with your text. No more scrolling inside a small box while the panel also scrolls.
- Same text size as the page, so what you write looks like what readers get.
- Undo works after toolbar buttons. Bold, italic and spoiler no longer break Ctrl+Z.
- Bullets continue on Enter. Start a line with "- ", press Enter, and the next line is a bullet. Press Enter on an empty bullet to stop.
- Bold and italic toggle. Select bold text and press the button again to remove it.
- No more pop-up alerts. Picking one image in two-image mode shows a small notice instead of blocking you.

## Images (improved)

- "Used" badge on gallery photos already placed in another section. Hover to see which one.
- Swap order button when two images are picked.
- Picked images sit in a strip above the gallery, each with Position and Remove.
- "1 image / 2 images" switch replaces the old toggle button. Same idea, clearer state.
- Videos are marked as videos. Gallery clips carry a "Video" badge, and a picked clip says so in the strip. Pick one like a photo. It plays muted and looping in the section, and readers click it to open with sound. Videos fill the frame automatically, so there is no Position dialog for them.

## Coaster texts too (improved)

The coaster text editor uses the same text tools and gets a live preview beside it, plus Ctrl+S to save.

## Keyboard shortcuts

| Keys | Does |
| --- | --- |
| Ctrl+S | Save changed sections |
| Ctrl+B | Bold on or off |
| Ctrl+I | Italic on or off |
| Ctrl+Shift+S | Inline spoiler on or off |
| Ctrl+Shift+L | Bullet the current line or selection |
| Enter in a bullet | Next bullet. On an empty bullet, ends the list |
| Esc | Close the position dialog, or close the editor |

On a Mac, use Cmd instead of Ctrl.

## Good to know

- Old sections without a chosen layout still alternate left and right down the page. The editor highlights the side they land on. Click any layout button to pin one.
- Clicking a picked video in the gallery removes it again, since there is nothing to position.

## Also fixed today

- Rankle round 2 "Could not load the coaster pool". About half the coasters have no photo the game can find, and the game gave up after twelve random pairs. It now skips coasters it already knows have no photo and tries much longer. Today's puzzle plays all five rounds again.
- Coaster photos with long names. Gallery titles are often shorter than the coaster name, like "Colossos: Kampf der Giganten" against "Colossos - Kampf der Giganten". The lookup now also tries the part before the dash, so Colossos, Eurosat and Storm find their photos.
- Discord link previews showed the old logo. The share image was still the old green mountains logo. Links now preview with the current orange logo on the dark ground. Discord caches previews, so old links may keep the old image for a while.
