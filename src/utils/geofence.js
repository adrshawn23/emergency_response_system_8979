// Ray-casting check for the administrator-managed service-boundary polygon.
// The polygon is demo data in mock mode; production reads the active boundary
// version from Supabase and preserves the resulting status on each incident.
export function isPointInBoundary({ latitude, longitude }, points = []) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || points.length < 3) return null;

  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const currentPoint = points[index];
    const previousPoint = points[previous];
    const intersects = (currentPoint.lat > latitude) !== (previousPoint.lat > latitude)
      && longitude < ((previousPoint.lng - currentPoint.lng) * (latitude - currentPoint.lat))
        / (previousPoint.lat - currentPoint.lat) + currentPoint.lng;
    if (intersects) inside = !inside;
  }
  return inside;
}
