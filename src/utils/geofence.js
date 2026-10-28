// Ray-casting check for the administrator-managed service-boundary polygon.
// The polygon is demo data in mock mode; production reads the active boundary
// version from Supabase and preserves the resulting status on each incident.
export function isPointInBoundary({ latitude, longitude }, points = []) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || points.length < 3) return null;

  // Stored boundaries use {latitude, longitude}; map-derived points use {lat, lng}
  const latOf = p => p.lat ?? p.latitude;
  const lngOf = p => p.lng ?? p.longitude;

  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const cLat = latOf(points[index]);
    const cLng = lngOf(points[index]);
    const pLat = latOf(points[previous]);
    const pLng = lngOf(points[previous]);
    const intersects = (cLat > latitude) !== (pLat > latitude)
      && longitude < ((pLng - cLng) * (latitude - cLat)) / (pLat - cLat) + cLng;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Text-based service-area check for addresses. The app has no geocoding
 * provider, so a resident's declared address must explicitly sit inside
 * Barangay Kalubihan. The address is normalized (case, punctuation, diacritics
 * and extra spaces removed), so any format written on an ID or document is
 * accepted: "Kalubihan", "Calubihan", "Brgy. Kalubihan", "Purok 4, Kalubihan,
 * Cebu City", etc.
 */
export function isAddressInServiceArea(address) {
  if (typeof address !== 'string' || !address.trim()) return false;
  const normalized = address
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return /\b[kc]alubihan\b/.test(normalized);
}
