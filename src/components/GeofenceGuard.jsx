import React, { useCallback, useEffect, useState } from 'react';
import Icon from './AppIcon';
import Button from './ui/Button';
import { distanceInKm, geofenceService } from '../services/geofenceService';
import { useAuth } from '../contexts/AuthContext';

const GeofenceGuard = ({ children }) => {
  const { profile } = useAuth();
  const [state, setState] = useState({ status: 'checking', message: '' });

  const checkAccess = useCallback(async () => {
    if (profile?.role === 'admin') {
      setState({ status: 'allowed', message: '' });
      return;
    }

    setState({ status: 'checking', message: '' });
    const { data: settings, error } = await geofenceService.getSettings();
    if (error) {
      setState({ status: 'blocked', message: 'The service area could not be verified. Please try again.' });
      return;
    }
    if (!settings.is_enabled) {
      setState({ status: 'allowed', message: '' });
      return;
    }
    if (!navigator.geolocation) {
      setState({ status: 'blocked', message: 'This device does not support location verification.' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        const distance = distanceInKm(
          position.coords.latitude,
          position.coords.longitude,
          settings
        );
        if (distance <= settings.radius_km) {
          sessionStorage.setItem('verifiedLocation', JSON.stringify({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            checkedAt: new Date().toISOString()
          }));
          setState({ status: 'allowed', message: '' });
        } else {
          setState({
            status: 'blocked',
            message: `You are ${distance.toFixed(1)} km from the service center and outside the ${settings.radius_km} km coverage radius.`
          });
        }
      },
      () => setState({
        status: 'blocked',
        message: 'Location permission is required to access this emergency response area.'
      }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }, [profile?.role]);

  useEffect(() => { checkAccess(); }, [checkAccess]);

  if (state.status === 'allowed') return children;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-card border border-border rounded-lg p-8 text-center shadow-emergency-lg">
        <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-5">
          <Icon name={state.status === 'checking' ? 'MapPin' : 'ShieldAlert'} size={28} className="text-primary" />
        </div>
        <h1 className="text-xl font-semibold text-foreground">
          {state.status === 'checking' ? 'Checking service area' : 'Access outside service area'}
        </h1>
        <p className="text-sm text-muted-foreground mt-3">
          {state.status === 'checking' ? 'Please allow location access when prompted.' : state.message}
        </p>
        {state.status === 'blocked' && (
          <Button onClick={checkAccess} className="mt-6" iconName="RefreshCw">Check location again</Button>
        )}
        <p className="text-xs text-muted-foreground mt-6">For an immediate emergency, contact your local emergency number.</p>
      </div>
    </div>
  );
};

export default GeofenceGuard;
