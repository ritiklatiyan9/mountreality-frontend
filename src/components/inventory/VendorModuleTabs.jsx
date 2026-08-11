import { useNavigate } from 'react-router-dom';
import { PageTabs } from '../ui/page';

/* ── Vendor module tabs ──────────────────────────────────────────────
   The same four tabs render identically on /vendors, both tabs of the
   Inventory page, and /vendors/categories, so switching between them
   never drops or swaps chrome underneath the user. ── */
const TABS = [
  { id: 'commitments', label: 'Commitments', to: '/vendors' },
  { id: 'procurement', label: 'Procurement', to: '/inventory?tab=procurement' },
  { id: 'stocks', label: 'Stocks', to: '/inventory' },
  { id: 'categories', label: 'Categories', to: '/vendors/categories' },
];

export default function VendorModuleTabs({ active, className }) {
  const navigate = useNavigate();
  return (
    <PageTabs
      label="Vendor module"
      className={`sticky top-0 z-10 bg-mr-canvas ${className || ''}`}
      items={TABS.map(({ id, label }) => ({ id, label }))}
      value={active}
      onChange={(id) => {
        const tab = TABS.find((t) => t.id === id);
        if (tab) navigate(tab.to);
      }}
    />
  );
}
