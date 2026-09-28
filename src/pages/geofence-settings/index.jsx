import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Icon from '../../components/AppIcon';
import { geofenceService } from '../../services/geofenceService';
import { useAuth } from '../../contexts/AuthContext';

const GeofenceSettings = () => {
  const navigate = useNavigate();
  const { user: authUser, profile } = useAuth();
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const user = { id: authUser?.id, name: profile?.full_name || authUser?.email || 'Administrator', role: profile?.role || 'admin' };

  useEffect(() => {
    geofenceService.getSettings().then(({ data, error }) => {
      setSettings(data);
      if (error) setMessage({ type: 'error', text: 'Unable to load saved geofence settings.' });
    });
  }, []);

  const updateField = (field, value) => setSettings(current => ({ ...current, [field]: value }));

  const useCurrentLocation = () => {
    navigator.geolocation.getCurrentPosition(
      position => setSettings(current => ({
        ...current,
        center_latitude: Number(position.coords.latitude.toFixed(6)),
        center_longitude: Number(position.coords.longitude.toFixed(6))
      })),
      () => setMessage({ type: 'error', text: 'Current location could not be detected.' }),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const save = async event => {
    event.preventDefault();
    setMessage(null);
    const latitude = Number(settings.center_latitude);
    const longitude = Number(settings.center_longitude);
    const radius = Number(settings.radius_km);
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 || radius <= 0 || radius > 1000) {
      setMessage({ type: 'error', text: 'Enter valid coordinates and a radius between 0.1 and 1,000 km.' });
      return;
    }
    setSaving(true);
    const { data, error } = await geofenceService.updateSettings(settings);
    setSaving(false);
    if (error) {
      setMessage({ type: 'error', text: error.message || 'The geofence could not be saved.' });
    } else {
      setSettings(data);
      setMessage({ type: 'success', text: 'Service area updated. New access checks use this radius immediately.' });
    }
  };

  if (!settings) return <div className="min-h-screen flex items-center justify-center">Loading service area…</div>;

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} onNavigate={navigate} />
      <Sidebar user={user} onNavigate={navigate} />
      <main className="pt-16 pl-64">
        <div className="p-6 max-w-4xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">Service Area Geofence</h1>
            <p className="text-muted-foreground mt-1">Change where non-admin users can access the response system.</p>
          </div>
          <form onSubmit={save} className="bg-card border border-border rounded-lg p-6 space-y-6">
            <div className="flex items-start gap-3 rounded-md bg-primary/10 p-4">
              <Icon name="MapPin" size={22} className="text-primary mt-0.5" />
              <p className="text-sm text-foreground">The allowed area is a circle centered on the coordinates below. Administrators remain able to access this page from outside the area.</p>
            </div>
            {message && <div className={`rounded-md p-3 text-sm ${message.type === 'success' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>{message.text}</div>}
            <Input label="Area name" value={settings.name} onChange={e => updateField('name', e.target.value)} required />
            <div className="grid md:grid-cols-2 gap-4">
              <Input label="Center latitude" type="number" step="0.000001" value={settings.center_latitude} onChange={e => updateField('center_latitude', e.target.value)} required />
              <Input label="Center longitude" type="number" step="0.000001" value={settings.center_longitude} onChange={e => updateField('center_longitude', e.target.value)} required />
            </div>
            <Button type="button" variant="outline" onClick={useCurrentLocation} iconName="Crosshair">Use my current location as center</Button>
            <Input label="Allowed radius (kilometers)" type="number" min="0.1" max="1000" step="0.1" value={settings.radius_km} onChange={e => updateField('radius_km', e.target.value)} required description="Users at or inside this distance can access the system." />
            <label className="flex items-center gap-3 text-sm font-medium text-foreground">
              <input type="checkbox" checked={settings.is_enabled} onChange={e => updateField('is_enabled', e.target.checked)} />
              Enable location restriction
            </label>
            <div className="flex gap-3 pt-2">
              <Button type="submit" loading={saving} iconName="Save">Save service area</Button>
              <Button type="button" variant="outline" onClick={() => navigate('/department-management')}>Cancel</Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default GeofenceSettings;
