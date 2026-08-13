import { ArrowLeft, Building2, ReceiptText, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import ReceiptSettings from '@/components/settings/ReceiptSettings';

export default function ReceiptDesigner() {
  const navigate = useNavigate();
  const { currentSite, isAdmin } = useAuth();

  return (
    <div className="mx-auto w-full max-w-[1800px] pb-8">
      <header className="mb-5 rounded-2xl border border-mr-line bg-mr-surface px-4 py-4 shadow-sm shadow-mr-ink/[0.035] sm:px-5 lg:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <Button type="button" variant="ghost" size="icon" className="mt-0.5 shrink-0 rounded-full" onClick={() => navigate('/settings')} aria-label="Back to Settings"><ArrowLeft className="h-4 w-4" /></Button>
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.15em] text-mr-blue"><Sparkles className="h-3.5 w-3.5" />Document studio</p>
              <h1 className="mt-1 text-[clamp(1.45rem,3vw,2rem)] font-semibold tracking-[-.04em] text-mr-text">Receipt designer</h1>
              <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-mr-muted">Arrange reusable receipt blocks, edit their content, and see the final Site document update in real time.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <span className="inline-flex h-9 items-center gap-2 rounded-full border border-mr-line bg-mr-surface-2 px-3 text-[11px] font-semibold text-mr-text"><Building2 className="h-3.5 w-3.5 text-mr-blue" />{currentSite?.name || 'No Site selected'}</span>
            <span className={`inline-flex h-9 items-center gap-2 rounded-full px-3 text-[11px] font-semibold ${isAdmin ? 'bg-mr-ink text-white' : 'border border-mr-line bg-mr-surface-2 text-mr-muted'}`}><ReceiptText className="h-3.5 w-3.5" />{isAdmin ? 'Site admin editor' : 'Read-only Site design'}</span>
          </div>
        </div>
      </header>
      <ReceiptSettings />
    </div>
  );
}
