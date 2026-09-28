import { supabase } from '../lib/supabase';

export const DEFAULT_GEOFENCE = {
  id: 1,
  name: 'Primary service area',
  center_latitude: 25.033,
  center_longitude: 121.5654,
  radius_km: 25,
  is_enabled: true
};

export const geofenceService = {
  async getSettings() {
    const { data, error } = await supabase
      .from('geofence_settings')
      .select('*')
      .eq('id', 1)
      .single();

    return { data: data || DEFAULT_GEOFENCE, error };
  },

  async updateSettings(settings) {
    return await supabase
      .from('geofence_settings')
      .update({
        name: settings.name,
        center_latitude: Number(settings.center_latitude),
        center_longitude: Number(settings.center_longitude),
        radius_km: Number(settings.radius_km),
        is_enabled: Boolean(settings.is_enabled),
        updated_at: new Date().toISOString()
      })
      .eq('id', 1)
      .select()
      .single();
  }
};

export const distanceInKm = (latitude, longitude, settings) => {
  const toRadians = value => value * Math.PI / 180;
  const earthRadiusKm = 6371;
  const latDelta = toRadians(settings.center_latitude - latitude);
  const lngDelta = toRadians(settings.center_longitude - longitude);
  const a = Math.sin(latDelta / 2) ** 2
    + Math.cos(toRadians(latitude)) * Math.cos(toRadians(settings.center_latitude))
    * Math.sin(lngDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
