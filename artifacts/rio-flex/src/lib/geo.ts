import { POPULAR_LOCATIONS } from '@/data/locations';

export function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function resolveAddress(lat: number, lng: number): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
      headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const road = addr.road || addr.street;
      const neighborhood = addr.suburb || addr.neighbourhood || addr.city_district;
      if (road && neighborhood) return `${road}, ${neighborhood}`;
      if (neighborhood) return `${neighborhood}, Rio de Janeiro`;
      if (data.display_name) return data.display_name.split(',').slice(0, 2).join(',').trim();
    }
  } catch {
    // fallback gracefully
  }
  return `Rio de Janeiro (${lat.toFixed(3)}, ${lng.toFixed(3)})`;
}

export async function geocodeAddress(text: string): Promise<{ lat: number; lng: number; name: string } | null> {
  const clean = text.trim().toLowerCase();
  if (!clean) return null;

  const match = POPULAR_LOCATIONS.find((loc) =>
    loc.match.some((m) => clean.includes(m)) || loc.name.toLowerCase().includes(clean)
  );
  if (match) return { lat: match.lat, lng: match.lng, name: match.name };

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text + ', Rio de Janeiro')}&limit=1`,
      { headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' } }
    );
    if (res.ok) {
      const results = await res.json();
      if (results.length > 0) {
        return {
          lat: parseFloat(results[0].lat),
          lng: parseFloat(results[0].lon),
          name: results[0].display_name.split(',').slice(0, 2).join(',').trim(),
        };
      }
    }
  } catch {
    // ignore
  }
  return null;
}
