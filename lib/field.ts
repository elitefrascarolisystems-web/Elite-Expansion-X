/**
 * Em campo (mapa): contas feitas no próprio aparelho. A posição de quem mapeia serve só para centralizar o mapa,
 * achar os locais por perto e ordenar a rota; nunca é enviada ao servidor nem guardada.
 */
export type LatLng = { latitude: number; longitude: number };
export type FieldSpot = LatLng & { key: string; name: string; cityId: number; type: string; sector: string };

/** Distância em metros (haversine). */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const r = 6371000, rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad, dLng = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "120 m" ou "1,4 km". */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(1, Math.round(meters / 10) * 10)} m`;
  return `${(meters / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
}

/** Locais até `radius` metros, do mais perto ao mais longe; sem nenhum no raio, os `fallback` mais perto. */
export function nearby<T extends LatLng>(spots: T[], here: LatLng, radius = 300, fallback = 5): { within: boolean; items: (T & { distance: number })[] } {
  const all = spots.map((spot) => ({ ...spot, distance: distanceMeters(here, spot) })).sort((x, y) => x.distance - y.distance);
  const inside = all.filter((spot) => spot.distance <= radius);
  return inside.length ? { within: true, items: inside } : { within: false, items: all.slice(0, fallback) };
}

/** Ordem da rota: sempre o próximo mais perto, a partir de onde a pessoa está (ou do primeiro local). */
export function routeOrder<T extends LatLng>(stops: T[], start?: LatLng | null): T[] {
  const left = [...stops], out: T[] = [];
  let at: LatLng | null = start ?? null;
  while (left.length) {
    let best = 0;
    if (at) for (let i = 1; i < left.length; i++) if (distanceMeters(at, left[i]) < distanceMeters(at, left[best])) best = i;
    const next = left.splice(best, 1)[0];
    out.push(next); at = next;
  }
  return out;
}

/** Distância total da rota (metros), contando a partir de onde a pessoa está, quando houver. */
export function routeLength(stops: LatLng[], start?: LatLng | null): number {
  let total = 0, at = start ?? null;
  for (const stop of stops) { if (at) total += distanceMeters(at, stop); at = stop; }
  return total;
}

const point = (p: LatLng) => `${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}`;
/** Google Maps com várias paradas (até 9 no caminho + o destino). Sem origem, o app usa a posição do aparelho. */
export const MAX_GOOGLE_STOPS = 10;
export function googleMapsRoute(stops: LatLng[]): string {
  const list = stops.slice(0, MAX_GOOGLE_STOPS);
  if (!list.length) return "https://www.google.com/maps";
  const destination = list[list.length - 1], waypoints = list.slice(0, -1);
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("destination", point(destination));
  if (waypoints.length) url.searchParams.set("waypoints", waypoints.map(point).join("|"));
  url.searchParams.set("travelmode", "driving");
  return url.toString();
}
/** Waze até a próxima parada. */
export function wazeTo(stop: LatLng): string {
  return `https://waze.com/ul?ll=${encodeURIComponent(point(stop))}&navigate=yes`;
}

/** Cidade mais perto do ponto, entre os centros de cidade conhecidos. */
export function nearestCity<T extends LatLng & { cityId: number }>(centers: T[], here: LatLng): number | null {
  let best: { id: number; d: number } | null = null;
  for (const c of centers) { const d = distanceMeters(here, c); if (!best || d < best.d) best = { id: c.cityId, d }; }
  return best?.id ?? null;
}
