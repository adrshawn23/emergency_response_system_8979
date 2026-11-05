import L from 'leaflet';

// Vite does not reliably emit Leaflet's default marker PNGs, so <Marker>
// renders an invisible <img>. Instead of depending on bundled image assets,
// every default marker gets a pure-CSS pin — guaranteed to render regardless
// of how the bundler treats the PNG files.
L.Marker.prototype.options.icon = L.divIcon({
  className: 'ers-pin',
  html: '<div class="ers-pin__body"></div>',
  iconSize: [28, 36],
  iconAnchor: [14, 36],
  popupAnchor: [0, -34],
});

// Blue variant for live responder positions — visually distinct from the
// red incident pin on shared maps.
export const RESPONDER_ICON = L.divIcon({
  className: 'ers-pin ers-pin--responder',
  html: '<div class="ers-pin__body"></div>',
  iconSize: [28, 36],
  iconAnchor: [14, 36],
  popupAnchor: [0, -34],
});

// Department badge variants for responder pins — a small colored letter
// chip pinned to the teardrop so a pin reads as "police responder" etc.
const DEPT_BADGES = [
  [/fire/i, 'F', '#dc2626'],
  [/police|security|safety/i, 'P', '#2563eb'],
  [/medic|ems|ambulance|health/i, 'M', '#db2777'],
  [/disaster|management|rescue/i, 'R', '#ea580c'],
  [/utility/i, 'U', '#ca8a04'],
];
const responderIconCache = {};
export const responderDeptIcon = (deptName) => {
  if (!deptName) return RESPONDER_ICON;
  if (responderIconCache[deptName]) return responderIconCache[deptName];
  const match = DEPT_BADGES.find(([re]) => re.test(deptName));
  const letter = match ? match[1] : deptName.trim().charAt(0).toUpperCase() || '?';
  const color = match ? match[2] : '#475569';
  const icon = L.divIcon({
    className: 'ers-pin ers-pin--responder',
    html: `<div class="ers-pin__body"></div><div class="ers-pin__badge" style="background:${color}">${letter}</div>`,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -34],
  });
  responderIconCache[deptName] = icon;
  return icon;
};

// Colored letter-badge dots for incident types on the command map.
const INCIDENT_COLORS = {
  fire: '#dc2626', medical: '#db2777', police: '#2563eb', natural: '#16a34a',
  utility: '#ca8a04', traffic: '#ea580c', hazmat: '#9333ea', other: '#475569',
};
const INCIDENT_LETTERS = {
  fire: 'F', medical: 'M', police: 'P', natural: 'N',
  utility: 'U', traffic: 'T', hazmat: 'H', other: '?',
};
export const incidentIcon = (type) => {
  const t = INCIDENT_COLORS[type] ? type : 'other';
  return L.divIcon({
    className: 'ers-inc',
    html: `<div class="ers-inc__dot" style="background:${INCIDENT_COLORS[t]}">${INCIDENT_LETTERS[t]}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
};

// Inject the pin styles once. Teardrop shape: circle rotated 45deg with a
// square corner acting as the point.
if (typeof document !== 'undefined' && !document.getElementById('ers-pin-styles')) {
  const style = document.createElement('style');
  style.id = 'ers-pin-styles';
  style.textContent = `
    .ers-pin { background: none; border: none; }
    .ers-pin__body {
      width: 26px;
      height: 26px;
      margin: 0 auto;
      background: #dc2626;
      border: 3px solid #ffffff;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
    }
    .ers-pin--responder .ers-pin__body { background: #2563eb; }
    .ers-pin { position: relative; }
    .ers-pin__badge {
      position: absolute; top: -6px; right: -4px;
      width: 14px; height: 14px; border-radius: 50%;
      border: 1.5px solid #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.4);
      color: #ffffff; font: 700 9px/12px system-ui, sans-serif; text-align: center;
    }
    .ers-inc { background: none; border: none; }
    .ers-inc__dot {
      width: 22px; height: 22px; border-radius: 50%;
      border: 2px solid #ffffff; box-shadow: 0 1px 5px rgba(0,0,0,0.45);
      color: #ffffff; font: 700 11px/18px system-ui, sans-serif;
      text-align: center;
    }
    .ers-pin__body::after {
      content: '';
      display: block;
      width: 8px;
      height: 8px;
      margin: 6px;
      background: #ffffff;
      border-radius: 50%;
    }
  `;
  document.head.appendChild(style);
}
