import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';

const LocationInput = ({ 
  location, 
  onLocationChange, 
  error = null 
}) => {
  const [isDetecting, setIsDetecting] = useState(false);
  const [coordinates, setCoordinates] = useState(null);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by this browser.');
      return;
    }

    setIsDetecting(true);
    navigator.geolocation?.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position?.coords;
        setCoordinates({ lat: latitude, lng: longitude });
        
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
              onChange={(e) => onLocationChange(e?.target?.value)}
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