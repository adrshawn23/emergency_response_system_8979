/**
 * Barangay Kalubihan incident-response guide — mirrors the response table:
 * which barangay group answers each incident type and which outside agency
 * the dispatcher should coordinate with (BFP/PNP/DRRMO are outside agencies,
 * not departments in the system).
 */
export const RESPONSE_GUIDE = {
  flood: {
    label: 'Flood',
    responders: 'Disaster Response Team (BDRRMC)',
    coordinate: 'Cebu City DRRMO — rescue or additional assistance',
  },
  fire: {
    label: 'Fire',
    responders: 'Disaster Response Team (evacuation, on-site coordination)',
    coordinate: 'Bureau of Fire Protection (BFP) — leads firefighting; contact immediately',
  },
  theft: {
    label: 'Theft / Pickpocketing',
    responders: 'Barangay Tanod / Peace and Order Team',
    coordinate: 'Philippine National Police (PNP) — response and investigation',
  },
  medical: {
    label: 'Medical Emergency',
    responders: 'Health and First Aid Team',
    coordinate: 'Cebu City DRRMO Ambulance Service — medical response and transport',
  },
  accident: {
    label: 'Road Accident',
    responders: 'Health and First Aid Team + Barangay Tanod (scene assistance)',
    coordinate: 'DRRMO Ambulance for injuries; PNP / city traffic personnel as needed',
  },
  assault: {
    label: 'Assault / Robbery / Active Fight',
    responders: 'Barangay Tanod / Peace and Order Team',
    coordinate: 'PNP — police response; ambulance assistance if anyone is injured',
  },
  structural: {
    label: 'Fallen Tree / Structural Damage / Trapped',
    responders: 'Disaster Response Team',
    coordinate: 'Cebu City DRRMO — rescue coordination or additional resources',
  },
};

/** Guide for a report's type, tolerating field-name and legacy-type drift. */
export function responseGuideFor(report) {
  const type = report?.report_type || report?.emergency_type || report?.incident_type;
  return type ? RESPONSE_GUIDE[type] ?? null : null;
}
