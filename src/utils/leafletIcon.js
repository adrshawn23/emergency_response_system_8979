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
