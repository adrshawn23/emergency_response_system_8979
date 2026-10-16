import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import { useMockData } from '../../../contexts/MockDataContext';
import { mockServiceBoundary } from '../../../data/mockData';

const LocationInput = ({ 
  location, 
  onLocationChange, 
  onLocationMetadataChange = () => {},
  error = null 
}) => {
  const { useMock } = useMockData();
  const [isDetecting, setIsDetecting] = useState(false);
  const [coordinates, setCoordinates] = useState(null);

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

  const insideServiceArea = coordinates ? isInsideBoundary(coordinates, mockServiceBoundary.points) : null;

  // Mock GPS locations for testing
  const mockLocations = [
    { lat: 14.6091, lng: 121.0225, address: '123 Main Street, Downtown Manila' },
    { lat: 14.6100, lng: 121.0230, address: '456 Oak Avenue, Residential Area' },
    { lat: 14.6110, lng: 121.0240, address: '789 Highway 1, Intersection' },
    { lat: 14.6080, lng: 121.0210, address: '321 Riverside Drive, Flood Zone' },
    { lat: 14.6095, lng: 121.0228, address: '654 Commercial Street, Business District' }
  ];

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
          serviceArea: isInsideBoundary(positionCoordinates, mockServiceBoundary.points) ? 'inside' : 'outside'
        });
        
        // Mock reverse geocoding - in real app, use Google Maps API
        const mockAddress = `${latitude?.toFixed(4)}, ${longitude?.toFixed(4)} (GPS Coordinates)`;
        onLocationChange(mockAddress);
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
          <div className={`mt-3 rounded-md p-3 text-sm ${insideServiceArea ? 'bg-success/10 text-success' : 'bg-warning/15 text-amber-800'}`}>
            <Icon name={insideServiceArea ? 'ShieldCheck' : 'TriangleAlert'} size={16} className="mr-2 inline" />
            {insideServiceArea
              ? 'Inside the configured Barangay Kalubihan service boundary.'
              : 'Outside the configured service boundary. Your report will still be submitted as Outside Service Area for dispatcher triage.'}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Boundary: {mockServiceBoundary.name}. This demo polygon is replaced by the Administrator-managed GIS boundary in production.</p>
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
