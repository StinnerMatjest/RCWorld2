// Render at request time, not build time: the Docker build has no env vars and
// no running API to fetch from. The tagged data cache below keeps this fast.
export const dynamic = "force-dynamic";

export default async function sitemap() {
  const baseUrl = "https://parkrating.com";
  const API = process.env.NEXT_PUBLIC_API_BASE_URL;

  const [rankedRes, coastersRes] = await Promise.all([
    fetch(`${API}api/parks/ranked`, { cache: "force-cache", next: { tags: ["content"] } }),
    fetch(`${API}api/coasters`, { cache: "force-cache", next: { tags: ["content"] } }),
  ]);

  const rankedData = await rankedRes.json();
  const coastersData = await coastersRes.json();

  const parks: { slug: string; lastVisitDate?: string }[] = rankedData.parks || [];
  const coasters: { slug: string }[] = coastersData.coasters || [];

  const parkUrls = parks.map((park) => ({
    url: `${baseUrl}/park/${park.slug}`,
    lastModified: park.lastVisitDate ? new Date(park.lastVisitDate) : new Date("2024-01-01"),
  }));

  const coasterUrls = coasters.map((coaster) => ({
    url: `${baseUrl}/coasters/${coaster.slug}`,
  }));

  return [
    { url: baseUrl,                      lastModified: new Date() },
    { url: `${baseUrl}/parks`,           lastModified: new Date() },
    { url: `${baseUrl}/coasterratings`,  lastModified: new Date() },
    { url: `${baseUrl}/manufacturers`,   lastModified: new Date() },
    { url: `${baseUrl}/info` },
    { url: `${baseUrl}/about` },
    { url: `${baseUrl}/games` },
    { url: `${baseUrl}/games/coastle` },
    { url: `${baseUrl}/games/zoomle` },
    { url: `${baseUrl}/games/connections` },
    ...parkUrls,
    ...coasterUrls,
  ];
}
