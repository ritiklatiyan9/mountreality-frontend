import { useCallback, useEffect, useState } from 'react';
import api from '../api/api';
import eventBus from '../utils/eventBus';

/* ── Company KYC state ────────────────────────────────────────────────
   Both the Settings timeline and the reminder modal read from here, and
   both must agree the moment one of them changes something — otherwise
   the modal keeps nagging about a step the user just finished. The
   existing eventBus is the sync channel; no new store. ── */

export const KYC_STEPS = [
  { id: 'company', label: 'Company details', fields: ['company_name'] },
  { id: 'registered', label: 'Registered address', fields: ['registered_address'] },
  { id: 'communication', label: 'Communication address', fields: ['communication_address'] },
  { id: 'director', label: 'Director details', fields: ['director_name', 'director_phone'] },
];

const filled = (kyc, field) => String(kyc?.[field] ?? '').trim().length > 0;

/** Which wizard steps are satisfied — same rule the server applies. */
export const stepDone = (kyc, step) => step.fields.every((f) => filled(kyc, f));

export function useOrgKyc() {
  const [kyc, setKyc] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/org/kyc');
      setKyc(data.kyc);
    } catch {
      // A failed read must not imply "incomplete" — that would pop the
      // reminder at people whose KYC is already done.
      setKyc(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onChanged = (next) => (next ? setKyc(next) : load());
    eventBus.on('kyc-updated', onChanged);
    return () => eventBus.off('kyc-updated', onChanged);
  }, [load]);

  const publish = useCallback((next) => {
    setKyc(next);
    eventBus.emit('kyc-updated', next);
  }, []);

  const save = useCallback(async (patch) => {
    const { data } = await api.put('/org/kyc', patch);
    publish(data.kyc);
    return data.kyc;
  }, [publish]);

  const submit = useCallback(async () => {
    const { data } = await api.post('/org/kyc/submit');
    publish(data.kyc);
    return data.kyc;
  }, [publish]);

  return { kyc, loading, reload: load, save, submit };
}
