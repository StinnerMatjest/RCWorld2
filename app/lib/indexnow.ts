// IndexNow: tells Bing (and Yandex, Seznam, Naver) that content changed. Bing's
// index feeds ChatGPT search and Copilot, so this is the fastest path from a
// published review to an AI answer. The key is public by design; the matching
// file lives at public/${KEY}.txt.
const KEY = "06b3e8b42223ab347e20d6dad2146741";
const HOST = "parkrating.com";
const HUB_URLS = [
  "https://parkrating.com",
  "https://parkrating.com/parks",
  "https://parkrating.com/coasterLibrary",
  "https://parkrating.com/manufacturers",
];

let lastPing = 0;
const MIN_INTERVAL_MS = 10 * 60 * 1000;

// Fire-and-forget; never throws, never blocks the admin mutation that called it.
export function pingIndexNow(urls: string[] = HUB_URLS) {
  const now = Date.now();
  if (now - lastPing < MIN_INTERVAL_MS) return;
  lastPing = now;
  fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls }),
  }).catch((err) => console.error("IndexNow ping failed:", err));
}
