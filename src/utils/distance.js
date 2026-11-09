/**
 * Haversine distance in meters between two points.
 * Accepts {latitude, longitude}, {lat, lng}, or [lat, lng] — reportCoords
 * returns arrays while hooks return objects, so normalize both shapes here.
 * Returns null when either point is missing/invalid/out of range.
 */
const toLatLng = (p) => {
  if (!p) return null;
  const lat = Array.isArray(p) ? p[0] : (p.latitude ?? p.lat);
  const lng = Array.isArray(p) ? p[1] : (p.longitude ?? p.lng);
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return null;
  if (Math.abs(nLat) > 90 || Math.abs(nLng) > 180) return null;
  return [nLat, nLng];
};

export function haversineMeters(a, b) {
  const pa = toLatLng(a);
  const pb = toLatLng(b);
  if (!pa || !pb) return null;

  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const [lat1, lng1] = pa;
  const [lat2, lng2] = pb;

  const c = Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lng2) - rad(lng1))
    + Math.sin(rad(lat1)) * Math.sin(rad(lat2));
  return R * Math.acos(Math.min(1, Math.max(-1, c)));
}
