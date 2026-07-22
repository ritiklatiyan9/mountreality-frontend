import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { MemberKycDialog } from '../components/MemberKycDialog';
import { Button } from '../components/ui/button';
import { KYC_DOC_FIELDS } from '../components/memberKycFields';

const MemberKycPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentSite, sites, setCurrentSite } = useAuth();
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [kycForm, setKycForm] = useState({ full_name: '', phone: '' });

  useEffect(() => {
    let active = true;
    const loadMember = async () => {
      try {
        setLoading(true);
        setLoadError('');
        const response = await api.get(`/members/${id}`);
        if (!active) return;
        const nextMember = response.data.member;
        if (!nextMember) throw new Error('Member not found');
        setMember(nextMember);
        setKycForm({
          full_name: nextMember.full_name || '',
          phone: nextMember.phone || '',
        });
      } catch (error) {
        if (!active) return;
        setLoadError(error?.response?.data?.message || 'Could not load this member for KYC.');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadMember();
    return () => { active = false; };
  }, [id]);

  const memberSite = useMemo(() => {
    if (!member?.site_id) return null;
    if (Number(currentSite?.id) === Number(member.site_id)) return currentSite;
    return (sites || []).find((site) => Number(site.id) === Number(member.site_id)) || null;
  }, [currentSite, member?.site_id, sites]);

  useEffect(() => {
    if (memberSite && Number(currentSite?.id) !== Number(memberSite.id)) {
      setCurrentSite(memberSite);
    }
  }, [currentSite?.id, memberSite, setCurrentSite]);

  const docPreviews = useMemo(() => {
    if (!member) return {};
    return KYC_DOC_FIELDS.reduce((result, document) => {
      if (member[document.key]) result[document.key] = member[document.key];
      return result;
    }, {});
  }, [member]);

  const backToMember = () => navigate(`/clients/${id}`);

  if (loading || (member && !memberSite && !(sites || []).length)) {
    return (
      <div className="flex min-h-[calc(100dvh-7rem)] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Opening member KYC…</div>
      </div>
    );
  }

  if (loadError || !member || !memberSite) {
    return (
      <div className="mx-auto flex min-h-[calc(100dvh-7rem)] max-w-lg items-center justify-center p-4">
        <div className="w-full rounded-2xl border border-red-100 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-600"><AlertCircle className="h-5 w-5" /></div>
          <h1 className="mt-4 text-base font-semibold text-slate-900">KYC could not be opened</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{loadError || 'The member’s site is not available to your account.'}</p>
          <Button className="mt-5" variant="outline" onClick={backToMember}><ArrowLeft className="mr-1.5 h-4 w-4" /> Back to member</Button>
        </div>
      </div>
    );
  }

  return (
    <MemberKycDialog
      presentation="page"
      autoStart
      open
      onOpenChange={(open) => { if (!open) backToMember(); }}
      editingId={Number(member.id)}
      form={kycForm}
      setForm={setKycForm}
      currentSite={memberSite}
      docPreviews={docPreviews}
      photoPreview={member.photo || null}
      onVerified={backToMember}
    />
  );
};

export default MemberKycPage;
