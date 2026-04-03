export default async function sitemap() {
  const baseUrl = "https://parkrating.com";

  const [parksRes, coastersRes] = await Promise.all([
    fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}api/parks`, { cache: "no-store" }),
    fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}api/coasters`, { cache: "no-store" }),
  ]);

  const parksData = await parksRes.json();
  const coastersData = await coastersRes.json();

  const parks = parksData.parks || [];
  const coasters = coastersData.coasters || [];

  const parkUrls = parks.map((park: any) => ({
    url: `${baseUrl}/park/${park.slug}`,
    lastModified: new Date(),
  }));

  const coasterUrls = coasters.map((coaster: any) => ({
    url: `${baseUrl}/coasters/${coaster.slug}`,
    lastModified: new Date(),
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
    },
    ...parkUrls,
    ...coasterUrls,
  ];
}