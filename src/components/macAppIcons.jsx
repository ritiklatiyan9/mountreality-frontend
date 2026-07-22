/* Hand-crafted macOS Big Sur/Sonoma-style app icons for the Home launcher.
   Each icon is a complete artwork: its own squircle background gradient +
   detailed foreground, muted Apple-like palette so the set reads cohesive.
   ponytail: fixed per-icon SVG ids — duplicates in the DOM (grid + dock) are
   identical defs, browsers resolve to the first and render correctly. */

/* ── Shared scaffold: 120×120 squircle, top-lit vertical gradient, clip, rim light. ── */
function Base({ id, from, mid, to, className, children }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={from} />
          {mid ? <stop offset="0.5" stopColor={mid} /> : null}
          <stop offset="1" stopColor={to} />
        </linearGradient>
        <clipPath id={`${id}-clip`}><rect width="120" height="120" rx="27" /></clipPath>
      </defs>
      <g clipPath={`url(#${id}-clip)`}>
        <rect width="120" height="120" fill={`url(#${id}-bg)`} />
        {children}
      </g>
      <rect x="0.75" y="0.75" width="118.5" height="118.5" rx="26.25" fill="none" stroke="#fff" strokeOpacity="0.14" strokeWidth="1.5" />
    </svg>
  );
}

/* Simple 8-tooth gear used by the Settings-style icons. */
function Gear({ cx, cy, r, tooth, fill, holeFill }) {
  return (
    <g fill={fill}>
      {Array.from({ length: 8 }).map((_, i) => (
        <rect
          key={i}
          x={cx - tooth / 2}
          y={cy - r - tooth * 0.55}
          width={tooth}
          height={tooth * 1.25}
          rx={tooth * 0.3}
          transform={`rotate(${i * 45} ${cx} ${cy})`}
        />
      ))}
      <circle cx={cx} cy={cy} r={r} />
      <circle cx={cx} cy={cy} r={r * 0.42} fill={holeFill} />
    </g>
  );
}

/* ── dashboard → white gauge dial on blue (brand-neutral, no Finder face) ── */
const GaugeIcon = (p) => (
  <Base id="mai-gauge" from="#7FB3E3" to="#3B79BE" {...p}>
    <ellipse cx="60" cy="94" rx="30" ry="4.5" fill="#000" opacity="0.12" />
    <circle cx="60" cy="62" r="34" fill="#F4F8FC" />
    <circle cx="60" cy="62" r="34" fill="none" stroke="#27506F" strokeOpacity="0.18" strokeWidth="2" />
    {Array.from({ length: 9 }).map((_, i) => {
      const a = ((-210 + i * 30) * Math.PI) / 180;
      return (
        <line
          key={i}
          x1={60 + 26 * Math.cos(a)} y1={62 + 26 * Math.sin(a)}
          x2={60 + 30 * Math.cos(a)} y2={62 + 30 * Math.sin(a)}
          stroke="#5B87B0" strokeWidth={i % 4 === 0 ? 3 : 2} strokeLinecap="round"
        />
      );
    })}
    <path d="M60 62 L42 46" stroke="#DB5B4F" strokeWidth="5" strokeLinecap="round" />
    <circle cx="60" cy="62" r="6" fill="#27506F" />
    <circle cx="60" cy="62" r="2.5" fill="#F4F8FC" />
  </Base>
);

/* ── daybook → Notes ── */
const NotesIcon = (p) => (
  <Base id="mai-notes" from="#FDFDFB" to="#E9E8E1" {...p}>
    <defs>
      <linearGradient id="mai-notes-t" x1="0" y1="0" x2="0" y2="34" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#F1D25C" /><stop offset="1" stopColor="#E1B342" />
      </linearGradient>
    </defs>
    <rect width="120" height="34" fill="url(#mai-notes-t)" />
    {Array.from({ length: 8 }).map((_, i) => (
      <circle key={i} cx={18 + i * 12} cy="27" r="2.2" fill="#FBFAF4" opacity="0.85" />
    ))}
    <rect x="22" y="48" width="76" height="4.5" rx="2.25" fill="#B7B5AA" />
    <rect x="22" y="62" width="64" height="4.5" rx="2.25" fill="#C8C6BB" />
    <rect x="22" y="76" width="70" height="4.5" rx="2.25" fill="#C8C6BB" />
    <rect x="22" y="90" width="52" height="4.5" rx="2.25" fill="#D3D1C6" />
  </Base>
);

/* ── cashflow → Books-style ledger (white open book on muted amber) ── */
const LedgerIcon = (p) => (
  <Base id="mai-ledger" from="#E9A34F" to="#CE6F2C" {...p}>
    <ellipse cx="60" cy="90" rx="32" ry="5" fill="#000" opacity="0.12" />
    <path d="M58 44 C50 37 38 34.5 28 36.5 L28 82 C38 80 50 82.5 58 89 Z" fill="#FBF8F2" />
    <path d="M62 44 C70 37 82 34.5 92 36.5 L92 82 C82 80 70 82.5 62 89 Z" fill="#F2EDE3" />
    <path d="M35 46 h14 M35 54 h14 M35 62 h14" stroke="#D9B98C" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M71 46 h14 M71 54 h14 M71 62 h14" stroke="#D3B384" strokeWidth="2.5" strokeLinecap="round" />
  </Base>
);

/* ── chat → Messages ── */
const MessagesIcon = (p) => (
  <Base id="mai-msg" from="#69C965" to="#37A24F" {...p}>
    <path
      d="M60 27 C39.5 27 23 40.4 23 57 C23 66.6 28.5 75.2 37 80.6 C36.2 85.4 33.4 90.3 28.8 94 C28.1 94.6 28.6 95.7 29.5 95.6 C37.8 94.8 44.7 91.3 49.1 87.2 C52.6 87.9 56.2 88.3 60 88.3 C80.5 88.3 97 74.6 97 58 C97 40.9 80.5 27 60 27 Z"
      fill="#FFFFFF"
    />
  </Base>
);

/* ── clients → Contacts (grey address book, colored tabs, silhouette) ── */
const ContactsIcon = (p) => (
  <Base id="mai-contacts" from="#DEDEE2" to="#B2B2BA" {...p}>
    <rect x="24" y="22" width="64" height="76" rx="8" fill="#F8F8FA" />
    <rect x="24" y="22" width="12" height="76" rx="6" fill="#C6C6CE" />
    <rect x="30" y="22" width="6" height="76" fill="#F8F8FA" />
    <rect x="34" y="22" width="2" height="76" fill="#CDCDD4" />
    <circle cx="30" cy="38" r="2.5" fill="#8E8E96" />
    <circle cx="30" cy="82" r="2.5" fill="#8E8E96" />
    <rect x="86" y="30" width="9" height="11" rx="2.5" fill="#D9756B" />
    <rect x="86" y="45" width="9" height="11" rx="2.5" fill="#E2B04E" />
    <rect x="86" y="60" width="9" height="11" rx="2.5" fill="#7FB77E" />
    <rect x="86" y="75" width="9" height="11" rx="2.5" fill="#6F9FD8" />
    <circle cx="61" cy="49" r="9.5" fill="#A2A2AA" />
    <path d="M44 80 C44 67 51 61.5 61 61.5 C71 61.5 78 67 78 80 Z" fill="#A2A2AA" />
  </Base>
);

/* ── excel → Numbers (white sheet, green bar chart) ── */
const NumbersIcon = (p) => (
  <Base id="mai-numbers" from="#FCFCFA" to="#EAEAE4" {...p}>
    <rect x="30" y="62" width="11" height="26" rx="2" fill="#7CC47C" />
    <rect x="45" y="44" width="11" height="44" rx="2" fill="#3D9A4E" />
    <rect x="60" y="54" width="11" height="34" rx="2" fill="#8CCB8C" />
    <rect x="75" y="34" width="11" height="54" rx="2" fill="#2F8442" />
    <rect x="24" y="88" width="70" height="2.5" rx="1.25" fill="#B9B9B0" />
    <rect x="24" y="30" width="2.5" height="60" rx="1.25" fill="#D5D5CC" />
  </Base>
);

/* ── expenses → Wallet (dark, layered cards) ── */
const WalletIcon = (p) => (
  <Base id="mai-wallet" from="#3E3E45" to="#1E1E23" {...p}>
    <rect x="24" y="26" width="72" height="56" rx="9" fill="#5E8FD4" />
    <rect x="24" y="38" width="72" height="56" rx="9" fill="#57A96A" />
    <rect x="24" y="50" width="72" height="56" rx="9" fill="#D9AC55" />
    <defs>
      <linearGradient id="mai-wallet-f" x1="0" y1="62" x2="0" y2="106" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#F0F0F3" /><stop offset="1" stopColor="#D6D6DD" />
      </linearGradient>
    </defs>
    <rect x="24" y="62" width="72" height="44" rx="9" fill="url(#mai-wallet-f)" />
    <circle cx="86" cy="74" r="4" fill="#B4B4BC" />
    <rect x="32" y="70" width="28" height="4.5" rx="2.25" fill="#AEAEB6" />
    <rect x="32" y="80" width="40" height="4.5" rx="2.25" fill="#C2C2C9" />
  </Base>
);

/* ── plot_payments → green-tinted plot grid (Maps-ish parcels + roads) ── */
const PlotGridIcon = (p) => (
  <Base id="mai-plots" from="#93B583" to="#5F8A54" {...p}>
    <g stroke="#F3F0E3" strokeWidth="1.5" strokeOpacity="0.75">
      <rect x="6" y="8" width="42" height="22" rx="3" fill="#A9C69B" />
      <rect x="6" y="36" width="42" height="21" rx="3" fill="#9CBD8C" />
      <rect x="70" y="8" width="46" height="49" rx="3" fill="#B3CBA4" />
      <rect x="6" y="80" width="42" height="34" rx="3" fill="#9FBF90" />
      <rect x="70" y="80" width="19" height="34" rx="3" fill="#AFC8A0" />
      <rect x="95" y="80" width="21" height="34" rx="3" fill="#E0C578" />
    </g>
    <path d="M93 8 v49" stroke="#F3F0E3" strokeWidth="1.5" strokeOpacity="0.55" />
    <rect x="54" width="10" height="120" fill="#EFECDE" opacity="0.92" />
    <rect y="63" width="120" height="11" fill="#EFECDE" opacity="0.92" />
    <path d="M59 4 v112" stroke="#C9C4A8" strokeWidth="1.5" strokeDasharray="6 6" opacity="0.8" />
  </Base>
);

/* ── payment_management → Calendar ── */
const CalendarIcon = (p) => (
  <Base id="mai-cal" from="#FCFCFC" to="#ECECEE" {...p}>
    <defs>
      <linearGradient id="mai-cal-h" x1="0" y1="0" x2="0" y2="32" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#EA6A5E" /><stop offset="1" stopColor="#D84B3E" />
      </linearGradient>
    </defs>
    <rect width="120" height="32" fill="url(#mai-cal-h)" />
    <text
      x="60" y="22" textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="600" letterSpacing="3"
      fontFamily="-apple-system, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
    >
      JUL
    </text>
    <text
      x="60" y="92" textAnchor="middle" fill="#3B3B40" fontSize="54" fontWeight="300"
      fontFamily="-apple-system, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
    >
      13
    </text>
  </Base>
);

/* ── payment_analytics → Stocks (dark, white line chart) ── */
const StocksIcon = (p) => (
  <Base id="mai-stocks" from="#303037" to="#131317" {...p}>
    <defs>
      <linearGradient id="mai-stocks-a" x1="0" y1="32" x2="0" y2="96" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.18" /><stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
      </linearGradient>
    </defs>
    <path d="M22 82 L38 62 L50 70 L66 44 L78 52 L96 32 L96 96 L22 96 Z" fill="url(#mai-stocks-a)" />
    <path
      d="M22 82 L38 62 L50 70 L66 44 L78 52 L96 32"
      fill="none" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
    />
    <circle cx="96" cy="32" r="4.5" fill="#6FC787" />
  </Base>
);

/* ── upi_collect → QR tile on App-Store blue ── */
const QrIcon = (p) => (
  <Base id="mai-qr" from="#55A5E6" to="#2273CE" {...p}>
    {[[30, 30], [72, 30], [30, 72]].map(([x, y]) => (
      <g key={`${x}-${y}`}>
        <rect x={x} y={y} width="18" height="18" rx="4" fill="#FFFFFF" />
        <rect x={x + 3.5} y={y + 3.5} width="11" height="11" rx="2.5" fill="#2E7ED2" />
        <rect x={x + 6.5} y={y + 6.5} width="5" height="5" rx="1" fill="#FFFFFF" />
      </g>
    ))}
    {[[56, 30], [64, 40], [56, 48], [64, 56], [30, 56], [40, 60], [56, 64], [72, 56], [80, 64], [72, 72], [82, 78], [60, 76], [56, 86], [66, 86], [76, 86], [86, 72], [86, 86]].map(([x, y], i) => (
      <rect key={i} x={x} y={y} width="5.5" height="5.5" rx="1" fill="#FFFFFF" opacity={i % 4 === 3 ? 0.8 : 1} />
    ))}
  </Base>
);

/* ── macOS blue folder + embossed badge, shared by the four folder modules ── */
function FolderIcon({ id, badge, ...p }) {
  return (
    <Base id={id} from="#F1F3F6" to="#D6DCE4" {...p}>
      <ellipse cx="60" cy="92" rx="38" ry="4.5" fill="#000" opacity="0.10" />
      <path
        d="M22 42 a7 7 0 0 1 7-7 h19 c2.8 0 5.4 1.3 7.2 3.5 l4.4 5.3 H91 a7 7 0 0 1 7 7 v6 H22 Z"
        fill="#5B92CE"
      />
      <defs>
        <linearGradient id={`${id}-fr`} x1="0" y1="50" x2="0" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#82B3E3" /><stop offset="1" stopColor="#548CC7" />
        </linearGradient>
      </defs>
      <rect x="22" y="50" width="76" height="40" rx="7" fill={`url(#${id}-fr)`} />
      <rect x="22" y="50" width="76" height="3" fill="#FFFFFF" opacity="0.25" />
      <g fill="#33699F" opacity="0.9">{badge}</g>
    </Base>
  );
}

const PlotRegistryIcon = (p) => (
  <FolderIcon
    id="mai-registry"
    badge={
      <>
        {Array.from({ length: 10 }).map((_, i) => {
          const a = (i * 36 * Math.PI) / 180;
          return <circle key={i} cx={60 + 10.5 * Math.cos(a)} cy={70 + 10.5 * Math.sin(a)} r="3.4" />;
        })}
        <circle cx="60" cy="70" r="11" />
        <path d="M55.5 70 l3.2 3.2 6-6.4" fill="none" stroke="#82B3E3" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </>
    }
    {...p}
  />
);

const RegistryDocsIcon = (p) => (
  <FolderIcon
    id="mai-regdocs"
    badge={
      <>
        <path d="M51 58 h13 l6 6 v18 a2.5 2.5 0 0 1 -2.5 2.5 h-16.5 a2.5 2.5 0 0 1 -2.5 -2.5 v-21.5 a2.5 2.5 0 0 1 2.5 -2.5 Z" />
        <path d="M54 68 h12 M54 73.5 h12 M54 79 h8" stroke="#82B3E3" strokeWidth="2.2" strokeLinecap="round" />
      </>
    }
    {...p}
  />
);

const PlotDocsIcon = (p) => (
  <FolderIcon
    id="mai-plotdocs"
    badge={
      <>
        <rect x="46" y="58" width="18" height="23" rx="2.5" opacity="0.55" />
        <rect x="54" y="62" width="19" height="24" rx="2.5" />
        <path d="M58 69 h11 M58 74.5 h11 M58 80 h7" stroke="#82B3E3" strokeWidth="2.2" strokeLinecap="round" />
      </>
    }
    {...p}
  />
);

const DocImprestIcon = (p) => (
  <FolderIcon
    id="mai-docimp"
    badge={
      <>
        <rect x="44" y="62" width="32" height="17" rx="3" />
        <circle cx="60" cy="70.5" r="5.5" fill="#82B3E3" />
        <text
          x="60" y="74" textAnchor="middle" fill="#33699F" fontSize="8.5" fontWeight="700"
          fontFamily="-apple-system, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
        >
          ₹
        </text>
      </>
    }
    {...p}
  />
);

/* ── farmers → sprout on soft green ── */
const SproutIcon = (p) => (
  <Base id="mai-sprout" from="#C3DBAF" to="#8FB87A" {...p}>
    <ellipse cx="60" cy="90" rx="22" ry="4.5" fill="#6E9A5C" opacity="0.55" />
    <path d="M60 88 C60 76 60 68 60 58" fill="none" stroke="#3F7A3B" strokeWidth="5" strokeLinecap="round" />
    <path d="M60 68 C46 68 37.5 59.5 35.5 45.5 C49 45.5 58 55 60 68 Z" fill="#4E8A46" />
    <path d="M60 58 C74 58 82.5 49.5 84.5 35.5 C71 35.5 62 45 60 58 Z" fill="#5E9C54" />
    <path d="M42 51 C50 55 56 60 59 66 M78 41 C70 45 64 50 61 56" fill="none" stroke="#FFFFFF" strokeWidth="1.6" strokeOpacity="0.35" strokeLinecap="round" />
  </Base>
);

/* ── firm_transactions → graphite briefcase ── */
const BriefcaseIcon = (p) => (
  <Base id="mai-brief" from="#75757C" to="#3C3C42" {...p}>
    <path d="M49 38 v-5 a5 5 0 0 1 5-5 h12 a5 5 0 0 1 5 5 v5" fill="none" stroke="#E6E6EB" strokeWidth="5" />
    <defs>
      <linearGradient id="mai-brief-b" x1="0" y1="38" x2="0" y2="84" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#EDEDF1" /><stop offset="1" stopColor="#CACAD2" />
      </linearGradient>
    </defs>
    <rect x="24" y="38" width="72" height="46" rx="8" fill="url(#mai-brief-b)" />
    <rect x="24" y="55" width="72" height="2.5" fill="#9A9AA2" />
    <rect x="54" y="51" width="12" height="10" rx="2.5" fill="#84848C" />
  </Base>
);

/* ── imprest → single banknote on subtle green ── */
const BanknoteIcon = (p) => (
  <Base id="mai-note" from="#86A98E" to="#587F62" {...p}>
    <ellipse cx="60" cy="84" rx="36" ry="4.5" fill="#000" opacity="0.10" />
    <rect x="22" y="40" width="76" height="40" rx="6" fill="#F0F5EC" />
    <rect x="27" y="45" width="66" height="30" rx="3" fill="none" stroke="#7FA98A" strokeWidth="1.6" />
    <circle cx="60" cy="60" r="11.5" fill="#DFE9DA" stroke="#7FA98A" strokeWidth="1.6" />
    <text
      x="60" y="65.5" textAnchor="middle" fill="#4E7A58" fontSize="16" fontWeight="600"
      fontFamily="-apple-system, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
    >
      ₹
    </text>
    <circle cx="34" cy="60" r="3" fill="#BCCFB6" />
    <circle cx="86" cy="60" r="3" fill="#BCCFB6" />
  </Base>
);

/* ── imprest_management → stacked banknotes ── */
const BanknotesIcon = (p) => (
  <Base id="mai-notes2" from="#7A9E82" to="#4C7355" {...p}>
    <g transform="rotate(-7 60 54)">
      <rect x="26" y="34" width="68" height="34" rx="5" fill="#DDE8D6" opacity="0.95" />
      <rect x="31" y="39" width="58" height="24" rx="2.5" fill="none" stroke="#8FAE93" strokeWidth="1.4" />
    </g>
    <rect x="26" y="52" width="68" height="36" rx="5" fill="#F0F5EC" />
    <rect x="31" y="57" width="58" height="26" rx="2.5" fill="none" stroke="#7FA98A" strokeWidth="1.5" />
    <circle cx="60" cy="70" r="10" fill="#DFE9DA" stroke="#7FA98A" strokeWidth="1.5" />
    <text
      x="60" y="75" textAnchor="middle" fill="#4E7A58" fontSize="14" fontWeight="600"
      fontFamily="-apple-system, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
    >
      ₹
    </text>
  </Base>
);

/* ── sites → Maps (land, water, roads, pin) ── */
const MapsIcon = (p) => (
  <Base id="mai-maps" from="#E4EBDA" to="#C4D4B8" {...p}>
    <path d="M62 0 C68 20 86 31 120 37 L120 0 Z" fill="#A3C6E4" />
    <path d="M-4 86 C30 74 48 52 58 20" fill="none" stroke="#FCFCF6" strokeWidth="9" strokeLinecap="round" />
    <path d="M10 124 C32 96 66 88 124 92" fill="none" stroke="#E5C466" strokeWidth="8" strokeLinecap="round" />
    <path d="M92 124 C86 96 96 62 122 46" fill="none" stroke="#FCFCF6" strokeWidth="4.5" strokeLinecap="round" />
    <ellipse cx="74" cy="84" rx="9" ry="3" fill="#000" opacity="0.15" />
    <path d="M74 40 C64.3 40 57 47.6 57 57 C57 68.5 74 84 74 84 C74 84 91 68.5 91 57 C91 47.6 83.7 40 74 40 Z" fill="#DB5B4F" />
    <circle cx="74" cy="57" r="6.5" fill="#FFFFFF" />
  </Base>
);

/* ── sub_admins → two grey gears ── */
const GearsIcon = (p) => (
  <Base id="mai-gears" from="#DFDFE3" to="#ABABB4" {...p}>
    <Gear cx={52} cy={54} r={20} tooth={11} fill="#84848D" holeFill="#D2D2D8" />
    <Gear cx={84} cy={80} r={12} tooth={7} fill="#6E6E77" holeFill="#C6C6CD" />
  </Base>
);

/* ── permissions → System Settings single big gear ── */
const SettingsGearIcon = (p) => (
  <Base id="mai-gear" from="#DFDFE3" to="#A7A7B0" {...p}>
    <Gear cx={60} cy={60} r={26} tooth={13.5} fill="#7E7E88" holeFill="#D2D2D8" />
    <circle cx="60" cy="60" r="17" fill="none" stroke="#6A6A73" strokeWidth="2" opacity="0.6" />
  </Base>
);

/* ── pending_approvals → white checkmark rosette on blue ── */
const ApprovalSealIcon = (p) => (
  <Base id="mai-seal" from="#5E9AD3" to="#2E6AA6" {...p}>
    {Array.from({ length: 12 }).map((_, i) => {
      const a = (i * 30 * Math.PI) / 180;
      return <circle key={i} cx={60 + 27 * Math.cos(a)} cy={59 + 27 * Math.sin(a)} r="6.8" fill="#FFFFFF" />;
    })}
    <circle cx="60" cy="59" r="28.5" fill="#FFFFFF" />
    <path d="M47.5 59.5 L57 69 L74 49" fill="none" stroke="#3B78B4" strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round" />
  </Base>
);

/* ── dashboard_management → sliders on graphite ── */
const SlidersIcon = (p) => (
  <Base id="mai-sliders" from="#5C5C64" to="#2C2C32" {...p}>
    {[
      [38, 46], [60, 78], [82, 54],
    ].map(([cy, knobX]) => (
      <g key={cy}>
        <rect x="26" y={cy - 3} width="68" height="6" rx="3" fill="#87878F" opacity="0.85" />
        <circle cx={knobX} cy={cy} r="8.5" fill="#F2F2F5" />
        <circle cx={knobX} cy={cy} r="8.5" fill="none" stroke="#000" strokeOpacity="0.15" />
      </g>
    ))}
  </Base>
);

/* ── plot_commission → stacked ₹ coins on muted gold ── */
const CoinsIcon = (p) => (
  <Base id="mai-coins" from="#D3B268" to="#A5822F" {...p}>
    <circle cx="47" cy="55" r="21" fill="#E7CE8B" stroke="#B69440" strokeWidth="2" />
    <circle cx="47" cy="55" r="14.5" fill="none" stroke="#C4A24E" strokeWidth="1.6" />
    <ellipse cx="69" cy="92" rx="26" ry="4" fill="#000" opacity="0.12" />
    <circle cx="69" cy="68" r="22.5" fill="#F2E2AC" stroke="#C4A24E" strokeWidth="2" />
    <circle cx="69" cy="68" r="15.5" fill="none" stroke="#C9A854" strokeWidth="1.6" />
    <text
      x="69" y="76" textAnchor="middle" fill="#8A6D22" fontSize="21" fontWeight="700"
      fontFamily="-apple-system, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
    >
      ₹
    </text>
  </Base>
);

/* ── vendors → white shopping bag on muted orange ── */
const BagIcon = (p) => (
  <Base id="mai-bag" from="#DFA35F" to="#BA7631" {...p}>
    <path d="M48 50 v-9 c0-6.6 5.4-12 12-12 s12 5.4 12 12 v9" fill="none" stroke="#F7F3EC" strokeWidth="5" strokeLinecap="round" />
    <path d="M37 46 h46 a4 4 0 0 1 4 4.3 l-3.4 40 a6 6 0 0 1 -6 5.7 H42.4 a6 6 0 0 1 -6 -5.7 L33 50.3 A4 4 0 0 1 37 46 Z" fill="#F7F3EC" />
    <circle cx="48" cy="56" r="2.8" fill="#C9995C" />
    <circle cx="72" cy="56" r="2.8" fill="#C9995C" />
  </Base>
);

/* ── Fallback for unmapped/future modules: grey squircle + the module's lucide glyph. ── */
export function DefaultAppIcon({ icon: Icon, className }) {
  return (
    <Base id="mai-default" from="#9C9CA5" to="#5C5C65" className={className}>
      {Icon ? (
        <Icon x="31" y="31" width="58" height="58" color="#FFFFFF" strokeWidth={1.6} />
      ) : (
        <circle cx="60" cy="60" r="22" fill="#FFFFFF" opacity="0.85" />
      )}
    </Base>
  );
}

export const MAC_APP_ICONS = {
  dashboard: GaugeIcon,
  daybook: NotesIcon,
  cashflow: LedgerIcon,
  chat: MessagesIcon,
  clients: ContactsIcon,
  excel: NumbersIcon,
  expenses: WalletIcon,
  plot_payments: PlotGridIcon,
  payment_management: CalendarIcon,
  payment_analytics: StocksIcon,
  upi_collect: QrIcon,
  plot_registry: PlotRegistryIcon,
  registry_documents: RegistryDocsIcon,
  plot_documents: PlotDocsIcon,
  document_imprest: DocImprestIcon,
  farmers: SproutIcon,
  firm_transactions: BriefcaseIcon,
  imprest: BanknoteIcon,
  imprest_management: BanknotesIcon,
  sites: MapsIcon,
  sub_admins: GearsIcon,
  permissions: SettingsGearIcon,
  pending_approvals: ApprovalSealIcon,
  dashboard_management: SlidersIcon,
  plot_commission: CoinsIcon,
  vendors: BagIcon,
};
