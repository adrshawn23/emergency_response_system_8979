import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import { supabase } from '../../../lib/supabase';

const LocationInput = ({ 
  location, 
  onLocationChange, 
  onLocationMetadataChange = () => {},
  error = null 
}) => {
  const [isDetecting, setIsDetecting] = useState(false);
  const [coordinates, setCoordinates] = useState(null);
  const [boundaryPoints, setBoundaryPoints] = useState(null);
  const [boundaryName, setBoundaryName] = useState(null);

  // Load the administrator-managed service boundary from Supabase.
  useEffect(() => {
    supabase
      .from('geofence_boundaries')
      .select('name, points')
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.points?.length >= 3) {
          setBoundaryPoints(data.points);
          setBoundaryName(data.name ?? 'configured service boundary');
        }
      });
  }, []);

  const isInsideBoundary = (point, polygon) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i], b = polygon[j];
      const intersects = ((a.lng > point.lng) !== (b.lng > point.lng)) &&
        (point.lat < (b.lat - a.lat) * (point.lng - a.lng) / (b.lng - a.lng) + a.lat);
      if (intersects) inside = !inside;
    }
    return inside;
  };

  const insideServiceArea = coordinates && boundaryPoints
    ? isInsideBoundary(coordinates, boundaryPoints.map(p => ({ lat: p.latitude ?? p.lat, lng: p.longitude ?? p.lng })))
    : null;

  const detectLocation = () => {
    setIsDetecting(true);
    
    // Always use real GPS regardless of mock mode
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by this browser.');
      setIsDetecting(false);
      return;
    }

    navigator.geolocation?.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position?.coords;
        const positionCoordinates = { lat: latitude, lng: longitude };
        setCoordinates(positionCoordinates);
        onLocationMetadataChange({
          source: 'gps',
          accuracy: position.coords.accuracy,
          coordinates: positionCoordinates,
          serviceArea: boundaryPoints
            ? (isInsideBoundary(positionCoordinates, boundaryPoints.map(p => ({ lat: p.latitude ?? p.lat, lng: p.longitude ?? p.lng }))) ? 'inside' : 'outside')
            : 'unverified'
        });

        const gpsAddress = `${latitude?.toFixed(4)}, ${longitude?.toFixed(4)} (GPS Coordinates)`;
        onLocationChange(gpsAddress);
        setIsDetecting(false);
      },
      (error) => {
        console.error('Error detecting location:', error);
        setIsDetecting(false);
        alert('Unable to detect location. Please enter manually.');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Location <span className="text-destructive">*</span>
        </label>
        <div className="flex space-x-2">
          <div className="flex-1">
            <Input
              type="text"
              placeholder="Enter address or description of location"
              value={location}
              onChange={(e) => {
                onLocationChange(e?.target?.value);
                onLocationMetadataChange({ source: 'manual', accuracy: null, coordinates: null, serviceArea: 'unverified' });
              }}
              error={error}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={detectLocation}
            disabled={isDetecting}
            loading={isDetecting}
            iconName="MapPin"
            className="flex-shrink-0"
          >
            {isDetecting ? 'Detecting...' : 'GPS'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Provide specific address, landmarks, or use GPS for current location
        </p>
      </div>
      {coordinates && (
        <div className="bg-muted rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Icon name="MapPin" size={16} className="text-success" />
            <span className="text-sm font-medium text-foreground">GPS Location Detected</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Latitude: {coordinates?.lat?.toFixed(6)}, Longitude: {coordinates?.lng?.toFixed(6)}
          </p>
          <div className={`mt-3 rounded-md p-3 text-sm ${insideServiceArea === null ? 'bg-muted text-muted-foreground' : insideServiceArea ? 'bg-success/10 text-success' : 'bg-warning/15 text-amber-800'}`}>
            <Icon name={insideServiceArea === null ? 'MapPin' : insideServiceArea ? 'ShieldCheck' : 'TriangleAlert'} size={16} className="mr-2 inline" />
            {insideServiceArea === null
              ? 'Service-area verification unavailable — no active boundary is configured in Supabase. Dispatch will triage this report.'
              : insideServiceArea
                ? 'Inside the configured Barangay Kalubihan service boundary.'
                : 'Outside the configured service boundary. Your report will still be submitted as Outside Service Area for dispatcher triage.'}
          </div>
          {boundaryName && <p className="mt-2 text-xs text-muted-foreground">Boundary: {boundaryName} (administrator-managed in Supabase).</p>}
          <div className="mt-3">
            <iframe
              width="100%"
              height="200"
              loading="lazy"
              title="Emergency Location"
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://www.google.com/maps?q=${coordinates?.lat},${coordinates?.lng}&z=16&output=embed`}
              className="rounded-md border border-border"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationInput;
