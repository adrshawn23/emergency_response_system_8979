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
 * Barangay Kalubihan. Accepts common spellings ("Kalubihan", "Brgy Kalubihan",
 * "Barangay Kalubihan", "Calubihan").
 */
export function isAddressInServiceArea(address) {
  if (typeof address !== 'string' || !address.trim()) return false;
  return /\b(k|barangay\s+k|brgy\.?\s+k)alubihan\b/i.test(address);
}
