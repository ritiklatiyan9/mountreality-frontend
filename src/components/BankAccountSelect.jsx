import { useCallback, useEffect, useMemo, useState } from 'react';
import { Landmark, Loader2, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { classifyPaymentMode } from '../utils/paymentMode';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { cn } from '../lib/utils';

const CACHE_TTL_MS = 120_000;
const optionCache = new Map();

const bankAccountOptionLabel = (account) => {
  const name = account.bank_name || account.label || 'Bank account';
  const suffix = account.account_last4 ? ` •••• ${account.account_last4}` : '';
  return `${name}${suffix}`;
};

export default function BankAccountSelect({
  value,
  onChange,
  paymentMode,
  required = true,
  disabled = false,
  className,
  label = 'Bank account',
}) {
  const { currentSite } = useAuth();
  const siteId = currentSite?.id;
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const hasPaymentMode = String(paymentMode ?? '').trim().length > 0;
  const nonCash = hasPaymentMode && classifyPaymentMode(paymentMode) !== 'cash';

  const load = useCallback(async ({ force = false } = {}) => {
    if (!siteId || !nonCash) return;
    const cached = optionCache.get(String(siteId));
    if (!force && cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
      setAccounts(cached.accounts);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/bank-accounts/options', { params: { site_id: siteId } });
      const next = data.accounts || [];
      optionCache.set(String(siteId), { accounts: next, loadedAt: Date.now() });
      setAccounts(next);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Bank accounts could not be loaded');
    } finally {
      setLoading(false);
    }
  }, [nonCash, siteId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const refresh = () => void load({ force: true });
    window.addEventListener('bank-accounts:changed', refresh);
    return () => window.removeEventListener('bank-accounts:changed', refresh);
  }, [load]);

  const selectedExists = useMemo(
    () => accounts.some((account) => String(account.id) === String(value)),
    [accounts, value],
  );

  useEffect(() => {
    if (!nonCash && value) onChange?.('');
    if (nonCash && value && !loading && accounts.length > 0 && !selectedExists) onChange?.('');
  }, [accounts.length, loading, nonCash, onChange, selectedExists, value]);

  if (!nonCash) return null;

  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      <div className="flex items-center justify-between gap-3">
        <Label className="flex items-center gap-1.5 text-[12px] font-medium text-mr-muted">
          <Landmark className="h-3.5 w-3.5" /> {label}{required ? <span className="text-mr-coral">*</span> : null}
        </Label>
        <Link to="/bank-configs" className="inline-flex items-center gap-1 text-[11px] font-medium text-mr-blue hover:underline">
          <Plus className="h-3 w-3" /> Configure
        </Link>
      </div>
      <Select value={value ? String(value) : undefined} onValueChange={onChange} disabled={disabled || loading}>
        <SelectTrigger className="h-10 rounded-control border-mr-line bg-mr-surface">
          {loading ? (
            <span className="flex items-center gap-2 text-mr-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading accounts…</span>
          ) : <SelectValue placeholder="Select account" />}
        </SelectTrigger>
        <SelectContent>
          {accounts.map((account) => (
            <SelectItem key={account.id} value={String(account.id)}>
              <span className="font-medium">{bankAccountOptionLabel(account)}</span>
              {account.label && account.label !== account.bank_name ? <span className="ml-1.5 text-mr-faint">· {account.label}</span> : null}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? <p className="text-[11px] text-mr-coral-ink">{error}</p> : null}
      {!loading && !error && accounts.length === 0 ? (
        <p className="text-[11px] text-mr-faint">No active account. Create one in Bank Configs before posting a non-cash entry.</p>
      ) : null}
    </div>
  );
}
