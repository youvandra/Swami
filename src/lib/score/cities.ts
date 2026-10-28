// City coordinates for routing distances and map framing. Metro centres, rounded to 2 decimals.

export type City = { name: string; region: string; lat: number; lng: number; aliases?: string[] };

export const CITIES: City[] = [
  { name: "New York", region: "NY", lat: 40.71, lng: -74.01, aliases: ["NYC", "Manhattan"] },
  { name: "Brooklyn", region: "NY", lat: 40.68, lng: -73.94 },
  { name: "Los Angeles", region: "CA", lat: 34.05, lng: -118.24, aliases: ["LA"] },
  { name: "Chicago", region: "IL", lat: 41.88, lng: -87.63 },
  { name: "Houston", region: "TX", lat: 29.76, lng: -95.37 },
  { name: "Phoenix", region: "AZ", lat: 33.45, lng: -112.07 },
  { name: "Philadelphia", region: "PA", lat: 39.95, lng: -75.17, aliases: ["Philly"] },
  { name: "San Antonio", region: "TX", lat: 29.42, lng: -98.49 },
  { name: "San Diego", region: "CA", lat: 32.72, lng: -117.16 },
  { name: "Dallas", region: "TX", lat: 32.78, lng: -96.8 },
  { name: "Austin", region: "TX", lat: 30.27, lng: -97.74 },
  { name: "San Jose", region: "CA", lat: 37.34, lng: -121.89 },
  { name: "San Francisco", region: "CA", lat: 37.77, lng: -122.42, aliases: ["SF"] },
  { name: "Oakland", region: "CA", lat: 37.8, lng: -122.27 },
  { name: "Sacramento", region: "CA", lat: 38.58, lng: -121.49 },
  { name: "Seattle", region: "WA", lat: 47.61, lng: -122.33 },
  { name: "Portland", region: "OR", lat: 45.52, lng: -122.68 },
  { name: "Denver", region: "CO", lat: 39.74, lng: -104.99 },
  { name: "Salt Lake City", region: "UT", lat: 40.76, lng: -111.89 },
  { name: "Las Vegas", region: "NV", lat: 36.17, lng: -115.14 },
  { name: "Albuquerque", region: "NM", lat: 35.08, lng: -106.65 },
  { name: "Boise", region: "ID", lat: 43.62, lng: -116.2 },
  { name: "Minneapolis", region: "MN", lat: 44.98, lng: -93.27 },
  { name: "Milwaukee", region: "WI", lat: 43.04, lng: -87.91 },
  { name: "Madison", region: "WI", lat: 43.07, lng: -89.4 },
  { name: "Detroit", region: "MI", lat: 42.33, lng: -83.05 },
  { name: "Grand Rapids", region: "MI", lat: 42.96, lng: -85.67 },
  { name: "Columbus", region: "OH", lat: 39.96, lng: -83.0 },
  { name: "Cleveland", region: "OH", lat: 41.5, lng: -81.69 },
  { name: "Cincinnati", region: "OH", lat: 39.1, lng: -84.51 },
  { name: "Indianapolis", region: "IN", lat: 39.77, lng: -86.16 },
  { name: "St. Louis", region: "MO", lat: 38.63, lng: -90.2, aliases: ["Saint Louis"] },
  { name: "Kansas City", region: "MO", lat: 39.1, lng: -94.58 },
  { name: "Omaha", region: "NE", lat: 41.26, lng: -95.93 },
  { name: "Des Moines", region: "IA", lat: 41.59, lng: -93.62 },
  { name: "Louisville", region: "KY", lat: 38.25, lng: -85.76 },
  { name: "Nashville", region: "TN", lat: 36.16, lng: -86.78 },
  { name: "Memphis", region: "TN", lat: 35.15, lng: -90.05 },
  { name: "Atlanta", region: "GA", lat: 33.75, lng: -84.39 },
  { name: "Charlotte", region: "NC", lat: 35.23, lng: -80.84 },
  { name: "Raleigh", region: "NC", lat: 35.78, lng: -78.64 },
  { name: "Asheville", region: "NC", lat: 35.6, lng: -82.55 },
  { name: "Richmond", region: "VA", lat: 37.54, lng: -77.44 },
  { name: "Washington", region: "DC", lat: 38.91, lng: -77.04, aliases: ["DC", "Washington DC"] },
  { name: "Baltimore", region: "MD", lat: 39.29, lng: -76.61 },
  { name: "Pittsburgh", region: "PA", lat: 40.44, lng: -79.99 },
  { name: "Boston", region: "MA", lat: 42.36, lng: -71.06 },
  { name: "Providence", region: "RI", lat: 41.82, lng: -71.41 },
  { name: "Buffalo", region: "NY", lat: 42.89, lng: -78.88 },
  { name: "Miami", region: "FL", lat: 25.76, lng: -80.19 },
  { name: "Orlando", region: "FL", lat: 28.54, lng: -81.38 },
  { name: "Tampa", region: "FL", lat: 27.95, lng: -82.46 },
  { name: "Jacksonville", region: "FL", lat: 30.33, lng: -81.66 },
  { name: "New Orleans", region: "LA", lat: 29.95, lng: -90.07 },
  { name: "Birmingham", region: "AL", lat: 33.52, lng: -86.8 },
  { name: "Oklahoma City", region: "OK", lat: 35.47, lng: -97.52 },
  { name: "Tulsa", region: "OK", lat: 36.15, lng: -95.99 },
  { name: "Toronto", region: "ON", lat: 43.65, lng: -79.38 },
  { name: "Montreal", region: "QC", lat: 45.5, lng: -73.57 },
  { name: "Vancouver", region: "BC", lat: 49.28, lng: -123.12 },
  { name: "London", region: "UK", lat: 51.51, lng: -0.13 },
  { name: "Jakarta", region: "ID", lat: -6.21, lng: 106.85 },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

export function findCity(name: string): City | undefined {
  const match = (raw: string) => {
    const n = norm(raw);
    return CITIES.find((c) => norm(c.name) === n || c.aliases?.some((a) => norm(a) === n));
  };
  // "Chicago, IL", "Austin, Texas, United States": the first part names the city; a region that disagrees rules it out
  const [head, region] = name.split(",").map((x) => x.trim());
  const hit = match(name) ?? match(head);
  if (hit && region && /^[A-Z]{2}$/.test(region) && hit.region !== region) return undefined;
  return hit;
}

/** First city named in free text, longest name first so "Kansas City" beats nothing and "New York" beats "York". */
export function cityIn(text: string): City | undefined {
  const t = ` ${text.toLowerCase()} `;
  const names = CITIES.flatMap((c) => [c.name, ...(c.aliases ?? [])].map((n) => ({ n, c })));
  names.sort((a, b) => b.n.length - a.n.length);
  return names.find(({ n }) => new RegExp(`[^a-z]${n.toLowerCase().replace(/[.]/g, "\\.")}[^a-z]`).test(t))?.c;
}

/** Great-circle distance in miles. */
export function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 3958.8;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Map frames per city: [north, south, west, east]. Cities without one are framed from their heat cells. */
export const CITY_BOX: Record<string, [number, number, number, number]> = {
  Chicago: [42.02, 41.64, -87.94, -87.52],
};
