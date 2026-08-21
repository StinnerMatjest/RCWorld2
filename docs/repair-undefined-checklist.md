# One-off repair: checklist with "undefined" coasters

Repairs a checklist created by the new-park wizard before the manufacturerId
bug was fixed, **without losing notes, sessions, park time, or checked items**.

## Prerequisites

1. **Deploy the fix first** (`app/api/park/[id]/coasters/route.ts` +
   `CreateChecklistModal.tsx`) — the script creates coasters through the fixed API.
2. Find the values below:
   - `SLUG` — from the checklist URL: `/checklists/<slug>`
   - `PARK_ID` — from the park page URL of the park you're keeping
   - `COASTER_NAMES` — retype the coaster names (the originals were never saved)

## Run

Open the deployed site, press F12 → Console, paste this (edit the CONFIG block):

```js
(async () => {
  // ------------ CONFIG ------------
  const SLUG = "disneyland-paris-visit-1234567890"; // <-- your checklist slug
  const PARK_ID = 42;                               // <-- park you are KEEPING
  const COASTER_NAMES = [                           // <-- retype coaster names
    "Big Thunder Mountain",
    "Hyperspace Mountain",
  ];
  // --------------------------------

  // 1. Fetch the current checklist row (we must echo ALL fields back,
  //    because PATCH overwrites visit_start/visit_end/duration/is_finished).
  const res = await fetch(`/api/checklists/${SLUG}`);
  if (!res.ok) throw new Error(`Checklist not found: ${SLUG}`);
  const { checklist } = await res.json();
  console.log("BEFORE:", JSON.parse(JSON.stringify(checklist)));

  // 2. Create the real coasters in the DB.
  const created = [];
  for (const name of COASTER_NAMES) {
    const r = await fetch(`/api/park/${PARK_ID}/coasters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        year: new Date().getFullYear(),
        model: "Unknown",
        scale: "Unknown",
        haveridden: false,
        isbestcoaster: false,
        rating: 0,
        rideCount: 0,
      }),
    });
    const data = await r.json();
    if (!r.ok || data?.id == null) throw new Error(`Failed to create "${name}": ${data?.error}`);
    created.push({ id: data.id, name: data.name });
    console.log(`Created coaster ${data.name} (id ${data.id})`);
  }

  // 3. Rebuild items: drop the broken "undefined" entries, keep everything
  //    else exactly as-is, insert the real coasters after the entrance item.
  const kept = checklist.items.filter((i) => i.id !== "pic-coaster-undefined");
  const newCoasterItems = created.map((c) => ({
    id: `pic-coaster-${c.id}`,
    label: `Take picture of ${c.name}`,
    checked: false,
    isPhotoTask: true,
    isCoaster: true,
    rideCount: 0,
  }));
  const entranceIdx = kept.findIndex((i) => i.id === "pic-entrance");
  const items = [
    ...kept.slice(0, entranceIdx + 1),
    ...newCoasterItems,
    ...kept.slice(entranceIdx + 1),
  ];

  // 4. Write back — full payload so nothing gets zeroed.
  if (!confirm(`Replace ${checklist.items.length - kept.length} broken items with ${created.length} real coasters on "${checklist.title}"?`)) return;
  const patch = await fetch(`/api/checklists/${SLUG}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items,
      visit_start: checklist.visit_start,
      visit_end: checklist.visit_end,
      duration: checklist.duration,
      is_finished: checklist.is_finished,
      sessions: checklist.sessions,
      notes: checklist.notes,
    }),
  });
  console.log(patch.ok ? "✅ Repaired. Reload the checklist page." : "❌ PATCH failed", await patch.json());
})();
```

## Afterwards

- Reload the checklist — notes, sessions, and park time are intact; re-enter
  ride counts on the coasters (their old counts were collided and meaningless).
- Delete the **unused** duplicate Disney park and its checklist via the normal
  UI delete buttons (checklist card → delete; park page admin → delete park).
- Delete this file.
