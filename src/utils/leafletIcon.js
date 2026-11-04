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
