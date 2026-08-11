import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, Loader2, MapPin, Search, X } from 'lucide-react';

/* ── Location picker ─────────────────────────────────────────────────
   Leaflet, deliberately on a single light vector-styled basemap. No
   satellite layer and no layer switcher at all: this is picking a
   postal address, and imagery adds visual noise while making the label
   you are actually reading harder to see.

   CARTO Positron is the tile source — muted greys, strong labels, free,
   no API key, and it is what most modern product maps look like.

   Nominatim does search and reverse-geocoding. It is best-effort by
   design: every failure path here leaves the pin (and therefore the
   saved coordinates) intact and simply skips the text suggestion, so a
   rate-limited geocoder can never block someone finishing KYC. ── */

const TILES = {
  url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
};

// Centre of India — a neutral start when nothing is saved yet.
const FALLBACK = { lat: 22.9734, lng: 78.6569, zoom: 4 };
const PICKED_ZOOM = 16;

/* Leaflet's default marker resolves its icon from a relative image path
   that a bundler rewrites, which is the classic "marker is invisible"
   bug. An inline SVG divIcon has no asset to lose. */
const PIN_ICON = L.divIcon({
  className: '',
  iconSize: [30, 40],
  iconAnchor: [15, 38],
  html: `
    <svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="15" cy="37" rx="6" ry="2.2" fill="rgba(16,17,20,0.22)"/>
      <path d="M15 1c-6.6 0-12 5.3-12 11.9 0 8.7 10.6 20 11.1 20.5a1.3 1.3 0 0 0 1.9 0C16.4 32.9 27 21.6 27 12.9 27 6.3 21.6 1 15 1z" fill="#2154dd"/>
      <circle cx="15" cy="12.9" r="4.6" fill="#fff"/>
    </svg>`,
});

/** Keeps the map centred on the pin when it moves from outside the map. */
function Recentre({ position, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo([position.lat, position.lng], zoom ?? map.getZoom(), { duration: 0.6 });
  }, [map, position, zoom]);
  return null;
}

/** Click anywhere to drop the pin. */
function ClickToPlace({ onPick }) {
  useMapEvents({ click: (event) => onPick({ lat: event.latlng.lat, lng: event.latlng.lng }) });
  return null;
}

export default function LocationPicker({ value, onChange, onResolveAddress, disabled }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [flyTo, setFlyTo] = useState(null);
  const boxRef = useRef(null);

  const position = value?.lat != null && value?.lng != null ? { lat: value.lat, lng: value.lng } : null;
  const initial = useMemo(
    () => position ?? { lat: FALLBACK.lat, lng: FALLBACK.lng },
    // Only the first render matters — afterwards Recentre drives the view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /* Reverse geocode is a suggestion, never a requirement: the caller
     decides whether to accept it, and any failure is swallowed so the
     coordinates still stand on their own. */
  const place = useCallback(async (next, { resolve = true } = {}) => {
    onChange(next);
    if (!resolve || !onResolveAddress) return;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${next.lat}&lon=${next.lng}`,
        { headers: { Accept: 'application/json' } },
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data?.display_name) onResolveAddress(data.display_name);
    } catch {
      /* offline or rate-limited — the pin is what actually matters */
    }
  }, [onChange, onResolveAddress]);

  const runSearch = async (event) => {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(q)}`,
        { headers: { Accept: 'application/json' } },
      );
      setResults(res.ok ? await res.json() : []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const chooseResult = (item) => {
    const next = { lat: Number(item.lat), lng: Number(item.lon) };
    setResults([]);
    setQuery('');
    setFlyTo({ ...next, at: Date.now() });
    // The search result already carries a formatted address — no need to
    // ask Nominatim again for what it just told us.
    onChange(next);
    if (onResolveAddress && item.display_name) onResolveAddress(item.display_name);
  };

  const locateMe = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setFlyTo({ ...next, at: Date.now() });
        place(next);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  // Close the results list on an outside click.
  useEffect(() => {
    if (!results.length) return undefined;
    const onDown = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setResults([]); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [results.length]);

  return (
    <div className="overflow-hidden rounded-panel-sm border border-mr-line bg-mr-surface">
      {/* ── Search + locate ── */}
      <div ref={boxRef} className="relative border-b border-mr-line p-2.5">
        <form onSubmit={runSearch} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mr-faint" strokeWidth={1.9} aria-hidden="true" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={disabled}
              placeholder="Search a place, street or landmark…"
              aria-label="Search for a location"
              className="h-10 w-full rounded-control border border-transparent bg-mr-shell pl-9 pr-8 text-[14px] text-mr-text outline-none transition-colors placeholder:text-mr-faint focus:border-mr-blue focus:bg-mr-surface"
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(''); setResults([]); }}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-mr-faint hover:text-mr-text"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={disabled || searching || !query.trim()}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-control bg-mr-blue-deep px-3.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-mr-blue disabled:opacity-50"
          >
            {searching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : 'Search'}
          </button>

          <button
            type="button"
            onClick={locateMe}
            disabled={disabled || locating}
            title="Use my current location"
            aria-label="Use my current location"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-mr-line bg-mr-surface text-mr-muted transition-colors hover:border-mr-line-strong hover:text-mr-text disabled:opacity-50"
          >
            {locating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Crosshair className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />}
          </button>
        </form>

        {results.length > 0 && (
          <ul className="absolute inset-x-2.5 top-[calc(100%-4px)] z-1000 max-h-56 overflow-y-auto rounded-panel-sm border border-mr-line bg-mr-surface py-1 shadow-lg shadow-black/10">
            {results.map((item) => (
              <li key={`${item.place_id}`}>
                <button
                  type="button"
                  onClick={() => chooseResult(item)}
                  className="flex w-full items-start gap-2.5 px-3 py-2 text-left text-[13px] text-mr-text transition-colors hover:bg-mr-shell"
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mr-blue" strokeWidth={1.9} aria-hidden="true" />
                  <span className="leading-snug">{item.display_name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Map ── */}
      <div className="relative h-[300px] w-full sm:h-[340px]">
        <MapContainer
          center={[initial.lat, initial.lng]}
          zoom={position ? PICKED_ZOOM : FALLBACK.zoom}
          scrollWheelZoom={false}
          zoomControl={false}
          attributionControl
          className="h-full w-full"
          style={{ background: '#eef3fa' }}
        >
          <TileLayer url={TILES.url} attribution={TILES.attribution} />
          <ClickToPlace onPick={(p) => !disabled && place(p)} />
          <Recentre position={flyTo} zoom={PICKED_ZOOM} />
          {position && (
            <Marker
              position={[position.lat, position.lng]}
              icon={PIN_ICON}
              draggable={!disabled}
              eventHandlers={{
                dragend: (e) => {
                  const { lat, lng } = e.target.getLatLng();
                  place({ lat, lng });
                },
              }}
            />
          )}
        </MapContainer>

        {!position && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-4">
            <p className="rounded-full bg-mr-ink/85 px-3.5 py-1.5 text-[12px] font-medium text-white">
              Tap the map to drop a pin, or search above
            </p>
          </div>
        )}
      </div>

      {/* ── Read-out ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-mr-line px-3 py-2.5">
        <p className="text-[12px] text-mr-muted">
          {position ? (
            <>
              <span className="font-medium text-mr-text">Pinned</span>{' '}
              <span className="tabular-nums">{position.lat.toFixed(5)}, {position.lng.toFixed(5)}</span>
            </>
          ) : 'No location pinned yet — optional, but it helps your team find the office.'}
        </p>
        {position && !disabled && (
          <button
            type="button"
            onClick={() => onChange({ lat: null, lng: null })}
            className="text-[12px] font-medium text-mr-coral-ink hover:underline"
          >
            Clear pin
          </button>
        )}
      </div>
    </div>
  );
}
