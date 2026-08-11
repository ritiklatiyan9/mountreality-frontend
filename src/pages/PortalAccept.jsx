import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import api from '../api/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export default function PortalAccept() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => params.get('token') || '', [params]);
  const [form, setForm] = useState({ name: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!token) return toast.error('This invitation link is incomplete.');
    setSaving(true);
    try {
      await api.post('/auth/portal-invitations/accept', { token, ...form });
      setAccepted(true);
      toast.success('Invitation accepted');
    } catch (error) {
      toast.error(error.response?.data?.message || 'The invitation could not be accepted.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#eef2f8] px-5 py-10 text-mr-text sm:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[48rem] bg-[radial-gradient(circle_at_18%_5%,rgba(47,107,255,0.18),transparent_34%),radial-gradient(circle_at_82%_16%,rgba(80,221,235,0.2),transparent_31%)]" />
      <div className="relative mx-auto flex w-full max-w-6xl items-center justify-between">
        <Link to="/" className="text-[15px] font-semibold tracking-[-0.02em]">Mount Reality</Link>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/60 px-3 py-1.5 text-[11px] font-semibold text-mr-muted shadow-sm">
          <ShieldCheck className="h-3.5 w-3.5 text-mr-blue" /> Invite-only access
        </span>
      </div>

      <div className="relative mx-auto grid min-h-[calc(100vh-7rem)] w-full max-w-6xl items-center gap-12 py-12 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="max-w-xl">
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-mr-blue">Controlled workspace invitation</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.055em] sm:text-6xl">Only the records assigned to you.</h1>
          <p className="mt-5 max-w-lg text-[15px] leading-7 text-mr-muted">
            Your portal is a secure view into the organization’s existing project records. It does not create a separate copy of bookings, payments, commissions, certifications, or documents.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              ['Scoped identity', 'Your invitation is tied to a specific organization, Site, project, and domain record.'],
              ['Audience releases', 'Documents and updates appear only after an internal release decision.'],
            ].map(([title, copy]) => (
              <div key={title} className="border-l border-mr-line-strong pl-4">
                <p className="text-[13px] font-semibold">{title}</p>
                <p className="mt-1 text-[12px] leading-5 text-mr-muted">{copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[30px] border border-white/80 bg-white/82 p-6 shadow-[0_30px_80px_-36px_rgba(31,42,68,0.35)] backdrop-blur-xl sm:p-9">
          {accepted ? (
            <div className="py-8 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-mr-lime-soft text-mr-lime-ink"><CheckCircle2 className="h-6 w-6" /></span>
              <h2 className="mt-5 text-2xl font-semibold tracking-[-0.035em]">Your portal is ready</h2>
              <p className="mx-auto mt-2 max-w-sm text-[13px] leading-6 text-mr-muted">Sign in with this email. If you already had an account, its password was not changed.</p>
              <Button className="mt-7 h-11 rounded-full bg-mr-ink px-6" onClick={() => navigate('/login')}>Continue to sign in <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <div>
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-mr-blue-soft text-mr-blue"><KeyRound className="h-5 w-5" /></span>
                <h2 className="mt-5 text-2xl font-semibold tracking-[-0.035em]">Accept your invitation</h2>
                <p className="mt-1.5 text-[13px] leading-5 text-mr-muted">New users create credentials below. Existing users can leave both fields blank and keep their current sign-in.</p>
              </div>
              {!token && <div className="rounded-control border border-mr-coral/20 bg-mr-coral-soft px-4 py-3 text-[12px] text-mr-coral-ink">No invitation token was found in this link.</div>}
              <div className="space-y-2">
                <Label htmlFor="portal-name">Your name</Label>
                <Input id="portal-name" autoComplete="name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="h-12 rounded-control border-transparent bg-mr-surface-2" placeholder="Required for a new account" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="portal-password">Create password</Label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mr-faint" />
                  <Input id="portal-password" type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} className="h-12 rounded-control border-transparent bg-mr-surface-2 pl-11" placeholder="10+ characters for a new account" />
                </div>
              </div>
              <Button disabled={saving || !token} className="h-12 w-full rounded-full bg-mr-ink text-[13px] font-semibold text-white">
                {saving ? 'Securing your access…' : 'Accept invitation'} {!saving && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
              <p className="text-center text-[11px] leading-5 text-mr-faint">By continuing, you confirm you are the intended recipient. Access can be revoked by the organization at any time.</p>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

