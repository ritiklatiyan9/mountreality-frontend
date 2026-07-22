import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ScanLine, Loader2, ChevronDown, RefreshCw, PowerOff, Check } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// Reusable "scan from device" button. Talks to the DG Scan Bridge, a tiny local
// service (see <repo>/Bookings/scan-bridge/) that drives any connected scanner
// via NAPS2. Same component as the booking app's ScanButton — one bridge serves
// both apps; keep the two copies in sync when editing.
//
// Visibility rules (important for non-technical users):
//  - Bridge never seen on this computer → renders NOTHING (no clutter).
//  - Bridge seen before but unreachable now → renders a "Scanner offline" button
//    that retries on click (bridge crashed / PC just rebooted / permission lost).
//
// Browser notes: on first use Chrome/Edge/Firefox show an "allow this site to
// access your local network" prompt — the probe waits long enough for the user
// to click Allow. Safari blocks HTTPS→http://127.0.0.1 entirely; use Chrome.
//
// Usage: <ScanButton onScanned={(files) => handleFiles(files)} />
// `files` is an array of File objects — JPEGs (one per page), or a single
// multi-page PDF when format="pdf".

const BRIDGE = import.meta.env.VITE_SCAN_BRIDGE_URL || 'http://127.0.0.1:9111';
const DEVICE_KEY = 'dg.scanner.device';
const SOURCE_KEY = 'dg.scanner.source'; // user's explicit paper-source choice, wins over the page default
const SEEN_KEY = 'dg.scanbridge.seen'; // bridge worked on this computer before

// Where the scanner takes the paper from. MFPs (printer+scanner combos) have
// both a flatbed glass and a top document feeder — the user picks in the menu.
const SOURCES = [
  { v: 'glass', label: 'Flatbed glass (under the lid)' },
  { v: 'feeder', label: 'Top feeder (ADF)' },
  { v: 'duplex', label: 'Top feeder — both sides' },
];

// One probe shared by every ScanButton instance. Success is cached for the page
// lifetime; FAILURE IS NOT — Chrome's local-network permission prompt or a
// just-installed bridge must be able to succeed on a later attempt.
let probePromise = null;
function probeBridge() {
  probePromise ??= fetch(`${BRIDGE}/health`, { signal: AbortSignal.timeout(30_000) })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => (j?.ok && j.naps2 ? j : null))
    .catch(() => null)
    .then((j) => {
      if (!j) probePromise = null;
      else localStorage.setItem(SEEN_KEY, '1');
      return j;
    });
  return probePromise;
}

// Device list shared across instances — the first probe of the drivers can take
// tens of seconds, so all buttons reuse one in-flight request.
let devicesPromise = null;
function getDevices(refresh = false) {
  if (refresh || !devicesPromise) {
    devicesPromise = fetch(`${BRIDGE}/devices${refresh ? '?refresh=1' : ''}`, {
      signal: AbortSignal.timeout(120_000),
    })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.message || 'Could not list scanners');
        return j.devices;
      })
      .catch((e) => {
        devicesPromise = null;
        throw e;
      });
  }
  return devicesPromise;
}

function friendlyFetchError(e) {
  if (e?.name === 'TimeoutError' || /timed? ?out/i.test(e?.message || '')) {
    return 'The scanner took too long to respond — check it is on and try again.';
  }
  if (e?.name === 'TypeError') {
    // fetch network failure → the bridge itself is down, not the scanner
    return 'Scanner service is not running on this computer — restart the computer or contact support.';
  }
  return e?.message || 'Something went wrong';
}

function b64ToFile(b64, name, mime) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}

const rememberedDevice = () => {
  try { return JSON.parse(localStorage.getItem(DEVICE_KEY)); } catch { return null; }
};

export default function ScanButton({
  onScanned,
  source = 'glass', // 'glass' | 'feeder' | 'duplex'
  format = 'jpeg', // 'jpeg' (one File per page) | 'pdf' (single multi-page File)
  dpi,
  label = 'Scan from device',
  disabled = false,
  className,
}) {
  // 'probing' | 'yes' | 'no' — 'no' still renders an offline hint if the bridge
  // ever worked on this computer.
  const [available, setAvailable] = useState('probing');
  const [scanning, setScanning] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [devices, setDevices] = useState(null); // null = not fetched yet
  const [loadingDevices, setLoadingDevices] = useState(false);
  // Paper source: page default (prop) unless the user ever picked one explicitly.
  const [src, setSrc] = useState(() => localStorage.getItem(SOURCE_KEY) || source);

  useEffect(() => {
    let mounted = true;
    probeBridge().then((ok) => {
      if (!mounted) return;
      setAvailable(ok ? 'yes' : 'no');
      if (ok) getDevices().catch(() => {}); // warm the (slow) first device scan
    });
    return () => { mounted = false; };
  }, []);

  if (available === 'probing') return null;
  if (available === 'no' && !localStorage.getItem(SEEN_KEY)) return null;

  const retryProbe = async () => {
    setAvailable('probing');
    const ok = await probeBridge();
    setAvailable(ok ? 'yes' : 'no');
    if (!ok) toast.error('Scanner service is still not reachable — restart this computer or contact support.');
  };

  // null return = listing failed (bridge/driver problem, already toasted) —
  // distinct from [] which genuinely means "no scanner found".
  const loadDevices = async (refresh = false) => {
    setLoadingDevices(true);
    try {
      const list = await getDevices(refresh);
      setDevices(list);
      return list;
    } catch (e) {
      toast.error(friendlyFetchError(e));
      return null;
    } finally {
      setLoadingDevices(false);
    }
  };

  const doScan = async (device) => {
    setScanning(true);
    try {
      localStorage.setItem(DEVICE_KEY, JSON.stringify(device));
      if (device.driver === 'inbox') {
        // ScanSnap has no driver NAPS2 can use — the bridge waits for the file
        // ScanSnap Home saves when the hardware button is pressed.
        toast.info('Load the paper into the ScanSnap and press its Scan button.', { duration: 10_000 });
      }
      const r = await fetch(`${BRIDGE}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device: device.name, driver: device.driver, source: src, dpi, format }),
        signal: AbortSignal.timeout(300_000),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || 'Scan failed');
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const ext = j.mime === 'application/pdf' ? 'pdf' : 'jpg';
      onScanned?.(j.pages.map((p, i) => b64ToFile(p, `scan-${stamp}-p${i + 1}.${ext}`, j.mime)));
      toast.success(ext === 'pdf' ? 'Scanned to PDF' : `Scanned ${j.pages.length} page${j.pages.length > 1 ? 's' : ''}`);
    } catch (e) {
      toast.error(friendlyFetchError(e));
    } finally {
      setScanning(false);
    }
  };

  // Main click: use the remembered scanner; auto-pick if there's exactly one;
  // otherwise open the picker.
  const onMainClick = async () => {
    const list = devices ?? (await loadDevices());
    if (list === null) return; // listing failed — already explained in a toast
    if (!list.length) {
      toast.error('No scanner found. Check it is on and connected, then try "Refresh scanner list".');
      setMenuOpen(true);
      return;
    }
    const saved = rememberedDevice();
    // Match name AND driver — the same physical scanner can be listed under
    // several drivers with different capabilities (WIA vs TWAIN feeder support).
    const device = list.find((d) => d.name === saved?.name && d.driver === saved?.driver)
      || (list.length === 1 ? list[0] : null);
    if (device) doScan(device);
    else setMenuOpen(true);
  };

  const busy = scanning || loadingDevices;
  const btnCls = 'inline-flex items-center justify-center gap-1.5 border border-fuchsia-200 bg-white text-xs font-medium text-fuchsia-700 transition-colors hover:bg-fuchsia-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-fuchsia-900 dark:bg-slate-900 dark:text-fuchsia-400 dark:hover:bg-fuchsia-950/30';

  // Bridge worked here before but is unreachable now → visible, actionable state
  // instead of a mysteriously vanished button.
  if (available === 'no') {
    return (
      <button
        type="button"
        onClick={retryProbe}
        title="The scanner service on this computer is not responding. Click to retry; if it keeps failing, restart the computer."
        className={cn(btnCls, 'rounded-xl px-3 py-1.5 border-slate-200 text-slate-400 dark:border-slate-700 dark:text-slate-500', className)}
      >
        <PowerOff className="h-3.5 w-3.5" /> Scanner offline — click to retry
      </button>
    );
  }

  return (
    <div className={cn('flex items-stretch', className)}>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={onMainClick}
        className={cn(btnCls, 'flex-1 rounded-l-xl border-r-0 px-3 py-1.5')}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanLine className="h-3.5 w-3.5" />}
        {scanning ? 'Scanning…' : loadingDevices ? 'Finding scanner…' : label}
      </button>
      <DropdownMenu open={menuOpen} onOpenChange={(o) => { setMenuOpen(o); if (o && devices === null) loadDevices(); }}>
        <DropdownMenuTrigger asChild>
          <button type="button" disabled={disabled || scanning} aria-label="Choose scanner" className={cn(btnCls, 'rounded-r-xl border-l px-1.5')}>
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Choose scanner</DropdownMenuLabel>
          {loadingDevices && (
            <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Looking for scanners…
            </div>
          )}
          {!loadingDevices && devices?.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">No scanner found</div>
          )}
          {!loadingDevices && devices?.map((d) => (
            <DropdownMenuItem key={`${d.driver}:${d.name}`} onSelect={() => doScan(d)}>
              <ScanLine className="mr-2 h-3.5 w-3.5 text-fuchsia-500" />
              <span className="truncate" title={d.name}>{d.name}</span>
              <span className="ml-auto pl-2 text-[10px] uppercase text-muted-foreground">
                {rememberedDevice()?.name === d.name && rememberedDevice()?.driver === d.driver ? 'default · ' : ''}{d.driver}
              </span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Paper source</DropdownMenuLabel>
          {SOURCES.map((s) => (
            <DropdownMenuItem
              key={s.v}
              onSelect={(e) => { e.preventDefault(); setSrc(s.v); localStorage.setItem(SOURCE_KEY, s.v); }}
            >
              <Check className={cn('mr-2 h-3.5 w-3.5', src === s.v ? 'text-fuchsia-500' : 'invisible')} />
              {s.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); loadDevices(true); }}>
            <RefreshCw className={cn('mr-2 h-3.5 w-3.5', loadingDevices && 'animate-spin')} /> Refresh scanner list
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
