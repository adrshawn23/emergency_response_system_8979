/**
 * Resolve a report's incident coordinates to [lat, lng] with fallbacks:
 *  1. Dedicated latitude/longitude columns (newer schema).
 *  2. attachments.latitude/longitude (older reports).
 *  3. Parse "lat, lng" out of the location text — older reports only stored
 *     the coordinates inside the "GPS: 10.x, 123.y" address string because of
 *     the {lat,lng}-vs-array bug fixed in the report form.
 *
 * Returns null when no coordinates can be determined.
 */
export const reportCoords = (r) => {
  const lat = r?.latitude ?? r?.attachments?.latitude;
  const lng = r?.longitude ?? r?.attachments?.longitude;
  if (lat != null && lng != null && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng))) {
    return [Number(lat), Number(lng)];
  }
  const text = r?.attachments?.location || r?.location || '';
  const m = String(text).match(/(-?\d{1,3}\.\d{4,})\s*,\s*(-?\d{1,3}\.\d{4,})/);
  if (!m) return null;
  const pLat = Number(m[1]);
  const pLng = Number(m[2]);
  return Math.abs(pLat) <= 90 && Math.abs(pLng) <= 180 ? [pLat, pLng] : null;
};
