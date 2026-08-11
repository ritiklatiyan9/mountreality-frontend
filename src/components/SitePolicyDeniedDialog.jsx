import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Settings2, ShieldAlert } from 'lucide-react';
import eventBus from '../utils/eventBus';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from './ui/dialog';

const fallbackMessage = 'This module is not available for the selected Site operating profile.';

export function SitePolicyDeniedDialog({ open, onOpenChange, message }) {
  const navigate = useNavigate();
  const { currentSite, isAdmin, hasPermission } = useAuth();
  const canConfigure = isAdmin || hasPermission('operating_profile', 'read');

  const configure = () => {
    onOpenChange(false);
    navigate('/settings?tab=operating-profile');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden rounded-2xl border-mr-line p-0 sm:max-w-lg">
        <div className="bg-mr-ink px-6 py-6 text-white">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
            <ShieldAlert className="h-5 w-5" aria-hidden="true" />
          </div>
          <DialogHeader className="mt-4 text-left">
            <DialogTitle className="text-[20px] tracking-[-0.025em] text-white">Set up this Site to continue</DialogTitle>
            <DialogDescription className="mt-1 text-[13px] leading-relaxed text-white/70">
              The selected Site profile controls which workflows are available. This is a configuration restriction, not a sign-out or data error.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="space-y-4 px-6 py-5">
          <p className="text-[14px] leading-relaxed text-mr-text">{message || fallbackMessage}</p>
          {currentSite?.name && (
            <div className="rounded-xl border border-mr-line bg-mr-surface-2/60 px-3.5 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mr-faint">Selected Site</p>
              <p className="mt-0.5 text-[14px] font-semibold text-mr-text">{currentSite.name}</p>
            </div>
          )}
          <p className="text-[12px] leading-relaxed text-mr-muted">
            Open the operating profile, choose the matching operating model and project shape, then review and publish the revision. The module becomes available after the published policy refreshes.
          </p>
        </div>
        <DialogFooter className="border-t border-mr-line bg-mr-surface px-6 py-4 sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-full">Not now</Button>
          {canConfigure ? (
            <Button onClick={configure} className="rounded-full bg-mr-ink text-white">
              <Settings2 className="mr-1.5 h-4 w-4" /> Make this module available <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          ) : (
            <span className="text-[12px] text-mr-muted">Ask a Site administrator to update this profile.</span>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SitePolicyBlockedRoute({ message }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const close = (nextOpen) => {
    setOpen(nextOpen);
    if (!nextOpen) navigate('/dashboard', { replace: true });
  };
  return <SitePolicyDeniedDialog open={open} message={message} onOpenChange={close} />;
}

export default function SitePolicyDeniedNotifier() {
  const [state, setState] = useState({ open: false, message: '' });

  useEffect(() => {
    const show = (payload = {}) => setState({ open: true, message: payload.message || fallbackMessage });
    eventBus.on('site-policy-denied', show);
    return () => eventBus.off('site-policy-denied', show);
  }, []);

  return <SitePolicyDeniedDialog open={state.open} message={state.message} onOpenChange={(open) => setState((current) => ({ ...current, open }))} />;
}
