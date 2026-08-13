import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, Banknote, Check, CircleDollarSign, Download, Edit3, FileCheck2,
  FileText, LandPlot, Loader2, MoreHorizontal, Plus, Printer, ReceiptText, RotateCcw, Upload,
} from 'lucide-react';
import api from '@/api/api';
import { useAuth } from '@/context/AuthContext';
import { escapePrintText, writePrintDocument } from '@/lib/safePrint';
import { printUnifiedReceipt } from '@/lib/printReceipt';
import { authoritySigHtml, customerSigImg } from '@/lib/receiptSignature';
import {
  getReceiptConfiguration,
  RECEIPT_CONFIGURATION_DEFAULTS,
} from '@/lib/receiptConfiguration';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { EmptyBlock, PageTabs, SectionHead, StatusDot } from '@/components/ui/page';
import AcquisitionSummaryStrip from '@/components/land-acquisition/AcquisitionSummaryStrip';
import AcquisitionActivityTimeline from '@/components/land-acquisition/AcquisitionActivityTimeline';
import LandAcquisitionProgress from '@/components/land-acquisition/LandAcquisitionProgress';
import { LandownerDrawer, TransactionDrawer } from '@/components/land-acquisition/LandAcquisitionDrawers';
import {
  AgreementSheet, AgreementViewSheet, DocumentUploadSheet, FinancialTermsSheet, LandDetailsSheet, RecordPaymentSheet,
} from '@/components/land-acquisition/AcquisitionEditDrawers';
import {
  apiMessage, areaLabel, dateLabel, DETAIL_TABS, money, readable, statusTone,
} from '@/components/land-acquisition/landAcquisitionUtils';

const EMPTY = { acquisition: null, agreements: [], payment_schedule: [], transactions: [], activity: [], documents: [] };

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error || new Error('Image could not be read'));
  reader.readAsDataURL(blob);
});

export default function LandAcquisitionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentSite, hasPermission, isAdmin, organization, user } = useAuth();
  const requestedTab = searchParams.get('tab') || 'overview';
  const tab = DETAIL_TABS.some((item) => item.id === requestedTab) ? requestedTab : 'overview';
  const [state, setState] = useState({ loading: true, error: '', data: EMPTY });
  const [reloadKey, setReloadKey] = useState(0);
  const [drawer, setDrawer] = useState('');
  const [agreementViewOpen, setAgreementViewOpen] = useState(false);
  const [agreementToView, setAgreementToView] = useState(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [landownerOpen, setLandownerOpen] = useState(false);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');
  const [reversal, setReversal] = useState({ payment: null, reason: '', busy: false });
  const [actionBusy, setActionBusy] = useState(false);
  const [receiptConfiguration, setReceiptConfiguration] = useState(RECEIPT_CONFIGURATION_DEFAULTS);
  const canWrite = hasPermission('farmers', 'write');
  const canUpdate = hasPermission('farmers', 'update');

  const load = useCallback(async (signal) => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const [detail, documents] = await Promise.all([
        api.get(`/land-acquisitions/${id}`, { signal }),
        api.get(`/compliance-documents/LAND_ACQUISITION/${id}`, { signal }),
      ]);
      setState({ loading: false, error: '', data: { ...detail.data, documents: documents.data.documents || [] } });
    } catch (error) {
      if (error?.code !== 'ERR_CANCELED') setState({ loading: false, error: apiMessage(error, 'Land acquisition could not be loaded'), data: EMPTY });
    }
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, reloadKey, currentSite?.id]);

  useEffect(() => {
    if (!currentSite?.id) {
      setReceiptConfiguration(RECEIPT_CONFIGURATION_DEFAULTS);
      return undefined;
    }
    let active = true;
    getReceiptConfiguration(currentSite.id)
      .then((configuration) => { if (active) setReceiptConfiguration(configuration); })
      .catch(() => { if (active) setReceiptConfiguration(RECEIPT_CONFIGURATION_DEFAULTS); });
    return () => { active = false; };
  }, [currentSite?.id]);

  useEffect(() => {
    const action = searchParams.get('action');
    if (!action || !state.data.acquisition) return;
    if (['payment', 'land', 'agreement', 'financials'].includes(action)) setDrawer(action);
    if (action === 'complete') setCompletionOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('action');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, state.data.acquisition]);

  const refresh = () => setReloadKey((key) => key + 1);
  const acquisition = state.data.acquisition;
  const latestAgreement = state.data.agreements[0] || null;
  const openAgreementView = (selectedAgreement = latestAgreement) => {
    if (!selectedAgreement) return;
    setDrawer('');
    setAgreementToView(selectedAgreement);
    setAgreementViewOpen(true);
  };
  const documentsByCategory = useMemo(() => state.data.documents.reduce((map, document) => {
    const category = document.category || 'OTHER';
    map[category] = [...(map[category] || []), document];
    return map;
  }, {}), [state.data.documents]);
  const agreementDocuments = useMemo(() => state.data.documents.filter((document) => {
    const category = String(document.category || document.document_type || '').toUpperCase();
    return category === 'AGREEMENT';
  }), [state.data.documents]);

  const setTab = (value) => {
    const next = new URLSearchParams(searchParams); next.set('tab', value); next.delete('action'); setSearchParams(next);
  };

  const openActivityItem = (item) => {
    const action = String(item?.action || '').toUpperCase();
    const value = item?.new_value || {};
    const isCompleted = acquisition?.effective_lifecycle_status === 'COMPLETED';

    if (action.includes('AGREEMENT')) {
      const agreementId = value.id ?? value.agreement_id;
      const agreement = state.data.agreements.find((entry) => Number(entry.id) === Number(agreementId));
      if (agreement) openAgreementView(agreement);
      else setTab('agreement');
      return;
    }

    if (action.includes('PAYMENT')) {
      const paymentId = value.payment_id ?? value.reversal_payment_id;
      const payment = state.data.transactions.find((entry) => Number(entry.id) === Number(paymentId));
      if (payment) setSelectedTransaction(payment);
      else setTab('transactions');
      return;
    }

    if (action.includes('LAND')) {
      if (canUpdate && !isCompleted) setDrawer('land');
      else setTab('land');
      return;
    }

    if (action.includes('FINANCIAL') || action.includes('TERMS')) {
      if (canUpdate && !isCompleted) setDrawer('financials');
      else setTab('financials');
      return;
    }

    if (action.includes('DOCUMENT')) {
      setTab('documents');
      return;
    }

    setTab('overview');
  };

  const complete = async () => {
    setActionBusy(true);
    try {
      await api.post(`/land-acquisitions/${id}/complete`, { notes: completionNotes });
      toast.success('Land acquisition completed'); setCompletionOpen(false); setCompletionNotes(''); refresh();
    } catch (error) { toast.error(apiMessage(error, 'This acquisition is not eligible for completion')); } finally { setActionBusy(false); }
  };
  const reopen = async () => {
    const reason = window.prompt('Reason for reopening this completed acquisition:');
    if (!reason?.trim()) return;
    setActionBusy(true);
    try { await api.post(`/land-acquisitions/${id}/reopen`, { reason }); toast.success('Acquisition reopened'); refresh(); }
    catch (error) { toast.error(apiMessage(error, 'Acquisition could not be reopened')); }
    finally { setActionBusy(false); }
  };
  const reversePayment = async () => {
    if (!reversal.payment || !reversal.reason.trim()) return;
    setReversal((current) => ({ ...current, busy: true }));
    try {
      await api.post(`/land-acquisitions/${id}/transactions/${reversal.payment.id}/reverse`, { reason: reversal.reason });
      toast.success('Reversal recorded and sent for approval'); setReversal({ payment: null, reason: '', busy: false }); refresh();
    } catch (error) {
      toast.error(apiMessage(error, 'Payment could not be reversed')); setReversal((current) => ({ ...current, busy: false }));
    }
  };
  const printTransactionReceipt = async (payment) => {
    if (!payment || !acquisition) return;
    const value = Number(payment.amount) || 0;
    const isReversal = value < 0 || Boolean(payment.reverses_payment_id);
    const bankDetails = [
      payment.bank_name,
      payment.bank_account_no ? `Account ending ${String(payment.bank_account_no).slice(-4)}` : null,
      payment.bank_ifsc ? `IFSC ${payment.bank_ifsc}` : null,
    ].filter(Boolean).join(' · ');
    const paymentReference = payment.bank_reference || payment.cheque_no || '';
    const signerName = user?.full_name || user?.name || '';
    const printedAt = new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium', timeStyle: 'short',
    }).format(new Date());
    try {
      await printUnifiedReceipt({
        docTitle: isReversal ? 'Land Payment Reversal' : 'Land Payment Receipt',
        site: currentSite || {},
        receiptNo: `FPR-${payment.id}`,
        date: dateLabel(payment.date),
        leadIn: `${acquisition.acquisition_reference || `Acquisition #${acquisition.id}`} · Payment recorded against the land acquisition account.`,
        rows: [
          { field: 'party', label: isReversal ? 'Reversal from' : 'Paid to (landowner)', value: acquisition.landowner_name },
          { label: 'Acquisition reference', value: acquisition.acquisition_reference || `#${acquisition.id}` },
          { label: 'Particular', value: payment.particular },
          { field: 'payment_mode', label: 'Payment mode', value: readable(payment.payment_mode) },
          { field: 'reference', label: 'Payment reference', value: paymentReference },
          { field: 'bank_details', label: 'Bank details', value: bankDetails },
          { field: 'allocation', label: 'Allocated against', value: payment.allocated_schedule || 'Unallocated' },
          { field: 'status', label: 'Status', value: readable(payment.status) },
          { field: 'recorded_by', label: 'Recorded by', value: payment.recorded_by_name || payment.created_by_name },
          { field: 'remarks', label: 'Remarks', value: payment.reversal_reason || payment.remarks },
        ],
        amount: Math.abs(value),
        amountDirection: 'out',
        amountLabel: isReversal ? 'Amount Reversed' : 'Amount Paid',
        amountColor: isReversal ? '#be123c' : undefined,
        verifyUrl: payment.verifyUrl,
        signatures: {
          customerImg: customerSigImg(payment),
          authorityHtml: authoritySigHtml(payment, signerName),
          customerLabel: 'Landowner / Payee Signature',
          authorityLabel: 'Authorized Signatory & Seal',
        },
        extraNote: isReversal
          ? 'This receipt records an audited reversal and should be read together with the original payment receipt.'
          : '',
        printedAt,
        configuration: receiptConfiguration,
      });
    } catch (error) {
      toast.error(error?.message || 'Receipt could not be prepared');
    }
  };
  const openDocument = async (document) => {
    try {
      const { data } = await api.get(`/compliance-documents/file/${document.id}`);
      if (data.document.file_url) return window.open(data.document.file_url, '_blank', 'noopener,noreferrer');
      if (data.document.content_url) {
        const response = await api.get(data.document.content_url, { responseType: 'blob' });
        const url = URL.createObjectURL(response.data); window.open(url, '_blank', 'noopener,noreferrer'); setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    } catch (error) { toast.error(apiMessage(error, 'Document could not be opened')); }
    return null;
  };
  const printAgreement = async () => {
    const popup = window.open('', '_blank', 'width=980,height=820');
    if (!popup) return toast.error('Allow pop-ups to generate the Agreement PDF');
    popup.document.write('<!doctype html><title>Preparing agreement…</title><body style="margin:0;display:grid;min-height:100vh;place-items:center;background:#10233f;color:#fff;font:16px Arial,sans-serif">Preparing the agreement and photo annex…</body>');
    popup.document.close();

    try {
      const photoDocuments = state.data.documents
        .filter((document) => String(document.mime_type || '').toLowerCase().startsWith('image/'))
        .slice(0, 6);
      const photos = (await Promise.all(photoDocuments.map(async (document) => {
        try {
          const { data } = await api.get(`/compliance-documents/file/${document.id}`);
          if (data.document.file_url) return { title: document.title || document.original_name || 'Acquisition photo', src: data.document.file_url };
          if (data.document.content_url) {
            const response = await api.get(data.document.content_url, { responseType: 'blob' });
            return { title: document.title || document.original_name || 'Acquisition photo', src: await blobToDataUrl(response.data) };
          }
        } catch {
          // A document may have been removed or be unavailable; omit only that image.
        }
        return null;
      }))).filter(Boolean);

      const agreement = latestAgreement || {};
      const companyName = organization?.company_name || organization?.name || currentSite?.name || 'Company name to be completed';
      const companyAddress = organization?.registered_address || currentSite?.address || '';
      const agreementReference = agreement.agreement_number || acquisition.acquisition_reference || `LAND-ACQUISITION-${acquisition.id}`;
      const landLocation = [acquisition.village, acquisition.tehsil, acquisition.district, acquisition.state].filter(Boolean).join(', ') || 'Land location to be completed';
      const parcel = acquisition.khasra_number || acquisition.survey_number || acquisition.parcel_number || 'Parcel reference to be completed';
      const agreementDate = agreement.agreement_date ? dateLabel(agreement.agreement_date) : 'To be completed before execution';
      const consideration = money(agreement.agreement_value ?? acquisition.total_amount);
      const witnesses = agreementParties(agreement.witness_parties).map((party) => (typeof party === 'string' ? party : party?.name || party?.full_name || party?.label)).filter(Boolean);
      const printedAt = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());
      const escape = escapePrintText;
      const propertyRows = [
        ['Project / purpose', acquisition.project_name || 'To be completed'],
        ['Location', landLocation],
        ['Khasra / survey / parcel', parcel],
        ['Land area', areaLabel(acquisition)],
        ['Land type', acquisition.land_type || 'To be completed'],
        ['Ownership share', acquisition.ownership_share ? `${acquisition.ownership_share}%` : 'To be completed'],
        ['Land notes', acquisition.land_notes || 'No additional notes recorded'],
      ].map(([label, value]) => `<tr><th>${escape(label)}</th><td>${escape(value)}</td></tr>`).join('');
      const paymentRows = state.data.payment_schedule.length
        ? state.data.payment_schedule.map((item, index) => `<tr><td>${escape(item.description || `Installment ${index + 1}`)}</td><td>${escape(dateLabel(item.due_date))}</td><td>${escape(readable(item.preferred_mode || 'To be confirmed'))}</td><td class="amount">${escape(money(item.expected_amount))}</td><td>${escape(readable(item.effective_status || item.schedule_status || 'PENDING'))}</td></tr>`).join('')
        : '<tr><td colspan="5" class="empty-row">No payment schedule has been recorded. Insert the approved schedule before execution.</td></tr>';
      const photoCards = photos.length
        ? photos.map((photo, index) => `<figure class="photo-card"><img src="${escape(photo.src)}" alt="${escape(photo.title)}" /><figcaption><b>Photograph ${index + 1}</b><span>${escape(photo.title)}</span></figcaption></figure>`).join('')
        : '<div class="no-photos"><b>No acquisition photos attached.</b><span>Upload actual site, parcel, boundary or document photographs to include them in this annex. This draft does not add synthetic images.</span></div>';

      writePrintDocument(popup, `<!doctype html><html><head><title>Land Acquisition Agreement · ${escape(agreementReference)}</title><style>
        @page{size:A4 portrait;margin:0}*{box-sizing:border-box}body{margin:0;background:#dce4ee;color:#172033;font:10.5px Arial,Helvetica,sans-serif}.viewer{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 18px;background:#0b203c;color:#fff}.viewer strong{font-size:13px}.viewer span{display:block;margin-top:2px;color:#b7c9df;font-size:10px}.viewer button{border:0;border-radius:7px;padding:8px 14px;font-weight:700;cursor:pointer}.viewer .print{background:#e8bd62;color:#172033}.viewer .close{margin-left:7px;background:#fff;color:#172033}.page{position:relative;width:210mm;min-height:297mm;margin:14px auto;background:#fff;padding:18mm 18mm 17mm;box-shadow:0 18px 48px #0f172a28;overflow:hidden;break-after:page}.page:last-child{break-after:auto}.page-number{position:absolute;right:18mm;bottom:8mm;color:#718096;font-size:8.5px;letter-spacing:.2px}.topline{width:52px;height:4px;background:#d9aa45;margin-bottom:10px}.brand{color:#6d7f96;font-size:9px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase}.cover{display:flex;min-height:297mm;flex-direction:column;padding:0;background:linear-gradient(145deg,#0b203c 0%,#123762 57%,#0b203c 100%);color:#fff}.cover .cover-inner{position:relative;z-index:1;display:flex;min-height:297mm;flex:1;flex-direction:column;justify-content:center;padding:24mm 22mm 19mm}.cover:after{position:absolute;right:-42mm;bottom:-50mm;width:160mm;height:160mm;border:1px solid #ffffff26;border-radius:50%;content:"";box-shadow:0 0 0 24mm #ffffff09,0 0 0 50mm #ffffff06}.cover .brand{color:#d4e2f3}.cover h1{max-width:130mm;margin:22px 0 12px;font-size:34px;letter-spacing:.3px;line-height:1.03}.cover h1 span{display:block;color:#e6bc5f}.cover .sub{max-width:120mm;margin:0;color:#d4e2f3;font-size:13px;line-height:1.65}.cover-card{display:grid;grid-template-columns:1fr 1fr;gap:0;max-width:150mm;margin-top:26px;border:1px solid #ffffff35;background:#ffffff10}.cover-card>div{padding:12px 13px;border-right:1px solid #ffffff2b}.cover-card>div:last-child{border-right:0}.cover-card label{display:block;margin-bottom:4px;color:#bfd0e6;font-size:8.5px;font-weight:700;letter-spacing:.75px;text-transform:uppercase}.cover-card b{font-size:11px;line-height:1.35}.cover-footer{margin-top:auto;padding-top:32px;color:#c7d6e8;font-size:9px;line-height:1.55}.cover-footer b{color:#fff}.notice{margin-top:14px;border-left:3px solid #d9aa45;background:#fff8e817;padding:10px 11px;color:#f8dfa0;font-size:9px;line-height:1.55}.document-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;border-bottom:2px solid #153b67;padding-bottom:11px}.document-head h1{margin:3px 0 0;color:#0b203c;font-size:19px;letter-spacing:.15px}.document-head p{max-width:85mm;margin:5px 0 0;color:#65758a;line-height:1.45}.ref-tag{min-width:42mm;border:1px solid #cbd7e5;background:#f5f8fb;padding:8px 9px;text-align:right}.ref-tag label{display:block;color:#75869c;font-size:8px;font-weight:700;letter-spacing:.7px;text-transform:uppercase}.ref-tag b{display:block;margin-top:4px;color:#153b67;font-size:10px}.intro{margin:18px 0;color:#3a4a5f;font-size:11px;line-height:1.75;text-align:justify}.party-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.party-card{min-height:94px;border:1px solid #d7e0eb;border-top:3px solid #153b67;padding:12px}.party-card .eyebrow,.section-kicker{color:#75869c;font-size:8px;font-weight:700;letter-spacing:1px;text-transform:uppercase}.party-card strong{display:block;margin-top:8px;color:#132943;font-size:13px}.party-card p{margin:5px 0 0;color:#5b6c80;line-height:1.48}.section{margin-top:19px}.section h2{margin:4px 0 0;color:#102b4b;font-size:13px;letter-spacing:.1px}.section-rule{width:100%;height:1px;margin:8px 0 0;background:#cbd7e5}.facts,.schedule{width:100%;border-collapse:collapse;margin-top:10px}.facts th,.facts td,.schedule th,.schedule td{border:1px solid #d7e0eb;padding:7px 8px;text-align:left;vertical-align:top;line-height:1.4}.facts th{width:33%;background:#f5f8fb;color:#66788d;font-size:8.5px;font-weight:700;letter-spacing:.35px;text-transform:uppercase}.schedule th{background:#0e3158;color:#fff;font-size:8.5px;letter-spacing:.35px;text-transform:uppercase}.schedule tr:nth-child(even) td{background:#f9fbfd}.amount{text-align:right!important;font-variant-numeric:tabular-nums}.empty-row{padding:16px!important;color:#6d7d91;font-style:italic;text-align:center!important}.summary-band{display:grid;grid-template-columns:repeat(3,1fr);margin-top:12px;border:1px solid #d7e0eb}.summary-band div{padding:10px 11px;border-right:1px solid #d7e0eb}.summary-band div:last-child{border-right:0}.summary-band label{display:block;color:#728196;font-size:8px;font-weight:700;letter-spacing:.65px;text-transform:uppercase}.summary-band b{display:block;margin-top:5px;color:#132943;font-size:12px}.legal-lead{margin:17px 0 0;border-left:3px solid #d9aa45;background:#fff9e9;padding:10px 12px;color:#554927;line-height:1.58}.clause{margin-top:13px;break-inside:avoid}.clause h3{margin:0;color:#132f52;font-size:10.5px}.clause p{margin:4px 0 0;color:#405166;line-height:1.65;text-align:justify}.clause-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 20px}.execution-note{margin-top:16px;border:1px solid #d7e0eb;background:#f7f9fc;padding:10px 12px;color:#53657a;line-height:1.55}.signing-party{margin-top:16px;border:1px solid #d7e0eb;padding:12px}.signing-party h3{margin:0;color:#0f2d50;font-size:11px}.signing-party p{margin:4px 0 0;color:#5c6d82}.signature-grid{display:grid;grid-template-columns:1fr 1fr;gap:26px;margin-top:26px}.signature{min-height:94px;border-top:1px solid #31445b;padding-top:7px}.signature b{color:#1c334e}.signature p{margin:5px 0;color:#617187;font-size:9.5px}.witness-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:16px}.witness{min-height:68px;border:1px dashed #a9b7c8;padding:9px}.witness b{display:block;color:#1d3653}.witness span{display:block;margin-top:20px;border-top:1px solid #718096;padding-top:5px;color:#718096;font-size:8.5px}.annex-title{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-top:20px}.annex-title h1{margin:4px 0 0;color:#102b4b;font-size:22px}.annex-title p{margin:0;color:#697b90;line-height:1.5;text-align:right}.photo-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:18px}.photo-card{margin:0;overflow:hidden;border:1px solid #d7e0eb;break-inside:avoid;background:#fff}.photo-card img{display:block;width:100%;height:77mm;object-fit:cover;background:#eff3f7}.photo-card figcaption{display:flex;justify-content:space-between;gap:10px;padding:7px 8px;color:#607289;font-size:8.5px;line-height:1.35}.photo-card figcaption b{color:#17385e}.photo-card figcaption span{text-align:right}.no-photos{display:grid;gap:6px;margin-top:20px;border:1px dashed #a7b6c8;background:#f7f9fc;padding:18px;color:#617287;line-height:1.55;text-align:center}.no-photos b{color:#183555;font-size:12px}.footer{position:absolute;right:18mm;bottom:13mm;left:18mm;border-top:1px solid #d7e0eb;padding-top:6px;color:#7a899b;font-size:8px;line-height:1.35}.footer span{float:right}@media print{body{background:#fff}.viewer{display:none}.page{width:auto;min-height:297mm;margin:0;box-shadow:none}.cover{min-height:297mm}.cover .cover-inner{min-height:297mm}.page-number{bottom:9mm}.footer{bottom:13mm}}
      </style></head><body><div class="viewer"><div><strong>Agreement PDF preview</strong><span>Multi-page execution draft with the acquisition photo annex.</span></div><div><button class="print">Print / Save PDF</button><button class="close">Close</button></div></div>
      <main class="page cover"><div class="cover-inner"><div class="topline"></div><div class="brand">${escape(companyName)}</div><h1>Land Acquisition <span>Agreement</span></h1><p class="sub">A system-generated agreement pack for the proposed acquisition of the scheduled land, prepared from the live acquisition record.</p><div class="cover-card"><div><label>Agreement reference</label><b>${escape(agreementReference)}</b></div><div><label>Agreement date</label><b>${escape(agreementDate)}</b></div><div><label>Seller / landowner</label><b>${escape(acquisition.landowner_name || 'To be completed')}</b></div><div><label>Total consideration</label><b>${escape(consideration)}</b></div></div><div class="notice"><b>Execution draft.</b> This software-generated document must be reviewed, completed and approved by the authorised legal and business representatives before it is signed, stamped or registered.</div><div class="cover-footer"><b>Buyer / acquiring party</b><br>${escape(companyName)}${companyAddress ? `<br>${escape(companyAddress)}` : ''}<br><br>Generated ${escape(printedAt)} · Record ${escape(acquisition.acquisition_reference || `#${acquisition.id}`)}</div></div></main>
      <main class="page"><header class="document-head"><div><div class="brand">Schedule A · Parties and property</div><h1>Parties and land particulars</h1><p>The commercial and property particulars below must be matched with title documents and the final execution instructions.</p></div><div class="ref-tag"><label>Reference</label><b>${escape(agreementReference)}</b></div></header><p class="intro">This agreement is proposed between the acquiring company identified below (the <b>Buyer</b>) and the recorded landowner identified below (the <b>Seller</b>) in relation to the land described in the property schedule. The final executed version should contain the parties’ complete legal names, capacity, identification and addresses as confirmed by authorised review.</p><section class="party-grid"><article class="party-card"><div class="eyebrow">Buyer / acquiring party</div><strong>${escape(companyName)}</strong><p><b>Registered address:</b> ${escape(companyAddress || 'To be completed')}<br><b>Authorised signatory:</b> To be completed at execution</p></article><article class="party-card"><div class="eyebrow">Seller / landowner</div><strong>${escape(acquisition.landowner_name || 'To be completed')}</strong><p><b>Address:</b> ${escape(acquisition.landowner_address || 'To be completed')}<br><b>Phone:</b> ${escape(acquisition.landowner_phone || 'To be completed')}</p></article></section><section class="section"><div class="section-kicker">Property schedule</div><h2>Land identification and records</h2><div class="section-rule"></div><table class="facts"><tbody>${propertyRows}</tbody></table></section><section class="section"><div class="section-kicker">Agreement summary</div><h2>Commercial reference</h2><div class="section-rule"></div><div class="summary-band"><div><label>Agreement type</label><b>${escape(agreement.agreement_type || 'Purchase Agreement')}</b></div><div><label>Agreement status</label><b>${escape(readable(agreement.agreement_status || 'DRAFT'))}</b></div><div><label>Revision</label><b>${escape(agreement.revision_number ? `Revision ${agreement.revision_number}` : 'Initial draft')}</b></div></div></section><footer class="footer">System-generated execution draft · ${escape(agreementReference)}<span>Page 2</span></footer></main>
      <main class="page"><header class="document-head"><div><div class="brand">Schedule B · Consideration</div><h1>Consideration and payment schedule</h1><p>Commercial terms are sourced from the current acquisition record and remain subject to formal approval and authorised execution.</p></div><div class="ref-tag"><label>Total consideration</label><b>${escape(consideration)}</b></div></header><section class="section"><div class="summary-band"><div><label>Cash agreed</label><b>${escape(money(acquisition.cash_amount))}</b></div><div><label>Bank agreed</label><b>${escape(money(acquisition.bank_amount))}</b></div><div><label>Financial status</label><b>${escape(readable(acquisition.financial_status || acquisition.financial_terms_status || 'PENDING'))}</b></div></div></section><section class="section"><div class="section-kicker">Installments</div><h2>Approved payment schedule</h2><div class="section-rule"></div><table class="schedule"><thead><tr><th>Description</th><th>Due date</th><th>Mode</th><th class="amount">Expected amount</th><th>Status</th></tr></thead><tbody>${paymentRows}</tbody></table></section><section class="section"><div class="section-kicker">Payment protocol</div><h2>Commercial operating notes</h2><div class="section-rule"></div><div class="legal-lead">No payment under the final agreement should be made except through the organisation’s approved payment workflow, with the relevant supporting documents, approvals, statutory deductions and acknowledgement retained in the acquisition record.</div><div class="clause-grid"><article class="clause"><h3>1. Consideration</h3><p>The consideration stated in this schedule is the commercial amount currently recorded for the acquisition. The parties must insert any required tax treatment, deductions, adjustments, advance terms and registration-related amounts in the final reviewed agreement.</p></article><article class="clause"><h3>2. Payment evidence</h3><p>Each payment should identify its approved installment or purpose, payment mode, date, bank or cash reference and recipient acknowledgement. Any variation must be documented and approved before payment.</p></article><article class="clause"><h3>3. Conditions before release</h3><p>The Buyer may require satisfactory title review, identity and authority checks, land record verification, internal approvals and any other documented conditions before releasing an installment.</p></article><article class="clause"><h3>4. Reconciliation</h3><p>The parties should reconcile the consideration, payments made, outstanding balance and applicable costs before the transfer, registration or possession event is treated as complete.</p></article></div></section><footer class="footer">System-generated execution draft · ${escape(agreementReference)}<span>Page 3</span></footer></main>
      <main class="page"><header class="document-head"><div><div class="brand">Schedule C · Terms of agreement</div><h1>Detailed commercial clauses</h1><p>These clauses form a structured management draft and are not a substitute for jurisdiction-specific legal advice or final legal drafting.</p></div><div class="ref-tag"><label>Draft status</label><b>${escape(readable(agreement.agreement_status || 'DRAFT'))}</b></div></header><section class="section"><div class="legal-lead"><b>Important:</b> authorised legal counsel should tailor the final agreement to the property, transaction structure, registration requirements, local law, taxes and the parties’ final negotiated terms.</div><div class="clause-grid"><article class="clause"><h3>1. Purpose and property</h3><p>The Seller agrees to deal with the scheduled land for the Buyer’s stated project or lawful purpose, and the parties will confirm the final property description, boundaries, area and attached land records before execution.</p></article><article class="clause"><h3>2. Title and authority</h3><p>The Seller will provide the documents reasonably required for verification of ownership, authority, encumbrances and rights affecting the land. The Buyer may rely on its completed review and may request clarifications or corrective documents.</p></article><article class="clause"><h3>3. Consideration and changes</h3><p>The consideration and payment schedule are those set out in Schedule B unless formally changed in a written, authorised amendment. Oral understandings should not be relied upon for execution, payment or transfer.</p></article><article class="clause"><h3>4. Conditions precedent</h3><p>Completion may depend on satisfactory due diligence, internal approval, availability of required records, consents, releases, no-objection requirements and any other conditions recorded in the final agreement.</p></article><article class="clause"><h3>5. Possession and registration</h3><p>The parties will record the agreed process and date for possession, execution, registration and delivery of original documents. Possession or registration should not be inferred solely from a draft, payment entry or system status.</p></article><article class="clause"><h3>6. Costs, taxes and duties</h3><p>The final agreement should clearly allocate registration costs, stamp duty, taxes, deductions, professional fees and other transaction expenses after advice from the relevant authorised advisers.</p></article><article class="clause"><h3>7. Representations and cooperation</h3><p>Each party will provide accurate information and reasonably cooperate with the documentation and execution process. Any material discrepancy should be escalated and resolved before final execution.</p></article><article class="clause"><h3>8. Records and confidentiality</h3><p>Acquisition records, payment evidence and personal information should be handled through approved systems and disclosed only as required for the transaction, compliance, financing, audit or law.</p></article><article class="clause"><h3>9. Notices and amendments</h3><p>The final agreement should state valid notice addresses and approval authority. Amendments, waivers or extensions should be in writing and signed by the persons authorised to bind each party.</p></article><article class="clause"><h3>10. Governing terms and disputes</h3><p>Applicable governing law, venue, dispute process and remedies must be completed by authorised legal counsel before execution, with reference to the applicable jurisdiction and transaction documents.</p></article></div></section><footer class="footer">System-generated execution draft · ${escape(agreementReference)}<span>Page 4</span></footer></main>
      <main class="page"><header class="document-head"><div><div class="brand">Schedule D · Execution</div><h1>Signatures and witness record</h1><p>Complete this page only after the final agreement, schedules and required attachments have been reviewed and approved for execution.</p></div><div class="ref-tag"><label>Execution date</label><b>${escape(agreementDate)}</b></div></header><div class="execution-note"><b>Execution checklist:</b> verify party details, property schedule, consideration, payment schedule, supporting title documents, witness details, authority of signatories and the final jurisdiction-specific legal form before signing.</div><section class="signing-party"><h3>For and on behalf of the Buyer / acquiring party</h3><p><b>Company:</b> ${escape(companyName)}</p><p><b>Authorised signatory name and designation:</b> ________________________________________________</p><div class="signature-grid"><div class="signature"><b>Authorised signature</b><p>Signature: ____________________________________</p><p>Date: __________________ Place: __________________</p></div><div class="signature"><b>Company confirmation</b><p>Seal, if applicable: ___________________________</p><p>Authority reference: ___________________________</p></div></div></section><section class="signing-party"><h3>Seller / landowner</h3><p><b>Name:</b> ${escape(acquisition.landowner_name || 'To be completed')}</p><p><b>Identity / authority reference:</b> ________________________________________________</p><div class="signature-grid"><div class="signature"><b>Seller signature</b><p>Signature / thumb impression: __________________</p><p>Date: __________________ Place: __________________</p></div><div class="signature"><b>Seller acknowledgement</b><p>Received / understood final agreement: __________</p><p>Contact confirmation: __________________________</p></div></div></section><section class="section"><div class="section-kicker">Witnesses</div><h2>Witness confirmation</h2><div class="section-rule"></div><div class="witness-grid">${[0, 1].map((index) => `<div class="witness"><b>Witness ${index + 1}${witnesses[index] ? ` · ${escape(witnesses[index])}` : ''}</b><span>Name, address, signature and date</span></div>`).join('')}</div></section><footer class="footer">System-generated execution draft · ${escape(agreementReference)}<span>Page 5</span></footer></main>
      <main class="page"><header class="document-head"><div><div class="brand">Annexure · Acquisition evidence</div><h1>Property and field photographs</h1><p>Only image documents already attached to this acquisition are included below. Captions preserve the attachment title recorded in the system.</p></div><div class="ref-tag"><label>Images included</label><b>${escape(String(photos.length))}</b></div></header><div class="annex-title"><div><div class="section-kicker">Annexure E</div><h1>Photo annex</h1></div><p>Acquisition reference<br><b>${escape(agreementReference)}</b></p></div><div class="photo-grid">${photoCards}</div><footer class="footer">System-generated execution draft · ${escape(agreementReference)}<span>Page 6</span></footer></main>
      </body></html>`);
    } catch (error) {
      popup.close();
      toast.error(apiMessage(error, 'Agreement PDF could not be generated'));
    }
  };

  if (state.loading && !acquisition) return <div className="mx-auto max-w-[1500px] space-y-5 pb-12"><Skeleton className="h-16 w-2/3" /><Skeleton className="h-20" /><Skeleton className="h-10" /><Skeleton className="h-96" /></div>;
  if (state.error || !acquisition) return <EmptyBlock icon={LandPlot} title="Land acquisition not found" description={state.error || 'This record may belong to another Site.'} action={<Button variant="outline" onClick={() => navigate('/land-acquisition?view=acquisitions')}><ArrowLeft className="mr-2 h-4 w-4" />Back to acquisitions</Button>} tall />;

  const completed = acquisition.effective_lifecycle_status === 'COMPLETED';
  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6 pb-12">
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex min-w-0 items-start gap-3">
          <Button variant="ghost" size="icon" className="mt-0.5" onClick={() => navigate('/land-acquisition?view=acquisitions')}><ArrowLeft className="h-4 w-4" /><span className="sr-only">Back</span></Button>
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="text-[28px] font-semibold tracking-[-0.03em] text-mr-text">{acquisition.acquisition_reference}</h1><StatusDot tone={statusTone(acquisition.effective_lifecycle_status)}>{readable(acquisition.effective_lifecycle_status)}</StatusDot>{acquisition.is_legacy && <StatusDot tone="attention">Legacy review required</StatusDot>}</div><button type="button" onClick={() => setLandownerOpen(true)} className="mt-1.5 text-left text-[15px] font-medium text-mr-text hover:text-mr-blue">{acquisition.landowner_name}</button><p className="mt-0.5 text-[13px] text-mr-muted">{acquisition.village || 'Location pending'} · {areaLabel(acquisition)}</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!completed && canWrite && <Button onClick={() => setDrawer('payment')} disabled={acquisition.financial_terms_status !== 'CONFIRMED'}><CircleDollarSign className="mr-2 h-4 w-4" />Record payment</Button>}
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">{latestAgreement && <DropdownMenuItem onClick={() => openAgreementView()}><FileCheck2 className="mr-2 h-4 w-4" />View agreement</DropdownMenuItem>}{!completed && canUpdate && <><DropdownMenuItem onClick={() => setDrawer('land')}>Edit land details</DropdownMenuItem><DropdownMenuItem onClick={() => setDrawer('agreement')}>Record agreement revision</DropdownMenuItem><DropdownMenuItem onClick={() => setDrawer('financials')}>Confirm financial terms</DropdownMenuItem><DropdownMenuItem onClick={() => setCompletionOpen(true)}>Complete acquisition</DropdownMenuItem></>}{completed && isAdmin && <DropdownMenuItem onClick={reopen} disabled={actionBusy}><RotateCcw className="mr-2 h-4 w-4" />Reopen with reason</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu>
        </div>
      </header>

      <AcquisitionSummaryStrip acquisition={acquisition} />
      <div className="px-1 py-2"><LandAcquisitionProgress status={acquisition.effective_lifecycle_status} /></div>
      <PageTabs items={DETAIL_TABS} value={tab} onChange={setTab} label="Acquisition workspace" />

      {tab === 'overview' && <OverviewTab acquisition={acquisition} agreement={latestAgreement} onAction={setTab} />}
      {tab === 'land' && <LandTab acquisition={acquisition} documents={documentsByCategory} canEdit={!completed && canUpdate} onEdit={() => setDrawer('land')} onOpenDocument={openDocument} />}
      {tab === 'agreement' && <AgreementTab agreements={state.data.agreements} documents={agreementDocuments} canEdit={!completed && canUpdate} canUpload={!completed && canWrite} onEdit={() => setDrawer('agreement')} onView={openAgreementView} onOpenDocument={openDocument} onUpload={() => setDrawer('agreement-document')} onPrint={printAgreement} />}
      {tab === 'financials' && <FinancialTab acquisition={acquisition} schedule={state.data.payment_schedule} canEdit={!completed && canUpdate} onEdit={() => setDrawer('financials')} />}
      {tab === 'transactions' && <TransactionsTab transactions={state.data.transactions} canWrite={!completed && canWrite} canReverse={!completed && canUpdate} onRecord={() => setDrawer('payment')} onOpen={setSelectedTransaction} onPrint={printTransactionReceipt} onReverse={(payment) => setReversal({ payment, reason: '', busy: false })} />}
      {tab === 'documents' && <DocumentsTab documents={state.data.documents} canUpload={!completed && canWrite} onUpload={() => setDrawer('document')} onOpen={openDocument} />}
      {tab === 'activity' && <section><SectionHead title="Activity history" description="Select an event to open the agreement, payment, land or financial record it relates to." /><AcquisitionActivityTimeline items={state.data.activity} onOpen={openActivityItem} /></section>}

      <LandDetailsSheet acquisition={acquisition} open={drawer === 'land'} onOpenChange={(open) => !open && setDrawer('')} onSaved={refresh} />
      <AgreementSheet acquisition={acquisition} agreement={latestAgreement} open={drawer === 'agreement'} onOpenChange={(open) => !open && setDrawer('')} onSaved={refresh} onView={() => openAgreementView(latestAgreement)} />
      <AgreementViewSheet acquisition={acquisition} agreement={agreementToView || latestAgreement} agreements={state.data.agreements} documents={agreementDocuments} open={agreementViewOpen} onOpenChange={(open) => { setAgreementViewOpen(open); if (!open) setAgreementToView(null); }} onEdit={() => { setAgreementViewOpen(false); setAgreementToView(null); setDrawer('agreement'); }} onOpenDocument={openDocument} onUpload={!completed && canWrite ? () => { setAgreementViewOpen(false); setAgreementToView(null); setDrawer('agreement-document'); } : undefined} />
      <FinancialTermsSheet acquisition={acquisition} schedule={state.data.payment_schedule} open={drawer === 'financials'} onOpenChange={(open) => !open && setDrawer('')} onSaved={refresh} />
      <RecordPaymentSheet acquisition={acquisition} schedule={state.data.payment_schedule} open={drawer === 'payment'} onOpenChange={(open) => !open && setDrawer('')} onSaved={refresh} />
      <DocumentUploadSheet acquisition={acquisition} open={drawer === 'document' || drawer === 'agreement-document'} initialCategory={drawer === 'agreement-document' ? 'AGREEMENT' : 'LAND_RECORD'} onOpenChange={(open) => !open && setDrawer('')} onSaved={refresh} />
      <LandownerDrawer memberId={acquisition.member_id} siteId={acquisition.site_id} open={landownerOpen} onOpenChange={setLandownerOpen} onOpenAcquisition={(acquisitionId) => navigate(`/land-acquisition/${acquisitionId}`)} />
      <TransactionDrawer transaction={selectedTransaction} open={Boolean(selectedTransaction)} onOpenChange={(open) => !open && setSelectedTransaction(null)} />

      <Dialog open={completionOpen} onOpenChange={setCompletionOpen}><DialogContent><DialogHeader><DialogTitle>Complete acquisition</DialogTitle><DialogDescription>{acquisition.acquisition_reference} · {acquisition.landowner_name}</DialogDescription></DialogHeader><div className="space-y-2">{acquisition.completion?.checks?.map((check) => <div key={check.key} className="flex items-center gap-2 border-b border-mr-line py-2 text-[13px]"><span className={`flex h-5 w-5 items-center justify-center rounded-full ${check.complete ? 'bg-mr-lime-soft text-mr-lime-ink' : 'bg-mr-coral-soft text-mr-coral-ink'}`}>{check.complete ? <Check className="h-3 w-3" /> : '!'}</span>{check.label}</div>)}</div><div><Label>Completion notes</Label><Textarea className="mt-2" rows={3} value={completionNotes} onChange={(event) => setCompletionNotes(event.target.value)} /></div><DialogFooter><Button variant="outline" onClick={() => setCompletionOpen(false)}>Cancel</Button><Button onClick={complete} disabled={actionBusy || !acquisition.completion?.eligible}>{actionBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Complete acquisition</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={Boolean(reversal.payment)} onOpenChange={(open) => !open && setReversal({ payment: null, reason: '', busy: false })}><DialogContent><DialogHeader><DialogTitle>Reverse payment</DialogTitle><DialogDescription>The original transaction remains visible. A signed correction is created and sent through approval.</DialogDescription></DialogHeader><div className="border-y border-mr-line py-3 text-[13px]"><span className="text-mr-muted">Original payment</span><span className="float-right font-semibold">{money(reversal.payment?.amount)}</span></div><div><Label>Reason</Label><Input className="mt-2" value={reversal.reason} onChange={(event) => setReversal((current) => ({ ...current, reason: event.target.value }))} placeholder="Example: Wrong bank selected" /></div><DialogFooter><Button variant="outline" onClick={() => setReversal({ payment: null, reason: '', busy: false })}>Cancel</Button><Button variant="destructive" disabled={reversal.busy || !reversal.reason.trim()} onClick={reversePayment}>{reversal.busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create reversal</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}

function OverviewTab({ acquisition, agreement, onAction }) {
  const next = acquisition.completion?.checks?.find((check) => !check.complete);
  return <div className="grid gap-9 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]"><section><SectionHead title="Acquisition at a glance" /><div className="grid gap-x-8 sm:grid-cols-2"><Fact label="Landowner" value={acquisition.landowner_name} /><Fact label="Land" value={`${acquisition.village || 'Location pending'} · ${areaLabel(acquisition)}`} /><Fact label="Parcel" value={acquisition.khasra_number || acquisition.survey_number || acquisition.parcel_number} /><Fact label="Project" value={acquisition.project_name} /><Fact label="Agreement" value={readable(agreement?.agreement_status || 'NOT_STARTED')} /><Fact label="Agreed value" value={money(acquisition.total_amount)} /><Fact label="Financial status" value={readable(acquisition.financial_status)} /><Fact label="Responsible employee" value={acquisition.responsible_user_name} /></div></section><section><SectionHead title="What happens next" /><div className="py-5"><p className="text-[14px] font-medium text-mr-text">{next?.label || 'Acquisition workflow complete'}</p><p className="mt-1 text-[12px] leading-relaxed text-mr-muted">{next ? 'Open the relevant tab to complete this business step. No legal conclusion is inferred.' : 'All configured business prerequisites are complete.'}</p>{next && <Button className="mt-4" variant="outline" onClick={() => onAction(next.key === 'land_details' ? 'land' : next.key === 'agreement' ? 'agreement' : next.key === 'financial_terms' ? 'financials' : 'transactions')}>Open next step</Button>}</div></section></div>;
}

function LandTab({ acquisition, documents, canEdit, onEdit, onOpenDocument }) {
  const landDocs = [...(documents.LAND_RECORD || []), ...(documents.KHASRA || []), ...(documents.OWNERSHIP_PROOF || [])];
  return <section><SectionHead title="Land details" description="Location, parcel identity and ownership information." actions={canEdit ? <Button variant="outline" onClick={onEdit}><Edit3 className="mr-2 h-4 w-4" />Edit</Button> : null} /><div className="grid gap-x-10 lg:grid-cols-3"><div><p className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-mr-faint">Location</p><Fact label="Village" value={acquisition.village} /><Fact label="Tehsil" value={acquisition.tehsil} /><Fact label="District" value={acquisition.district} /><Fact label="State" value={acquisition.state} /></div><div><p className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-mr-faint">Parcel</p><Fact label="Khasra" value={acquisition.khasra_number} /><Fact label="Survey" value={acquisition.survey_number} /><Fact label="Parcel number" value={acquisition.parcel_number} /><Fact label="Area" value={areaLabel(acquisition)} /><Fact label="Ownership" value={acquisition.ownership_share ? `${acquisition.ownership_share}%` : null} /></div><div><p className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-mr-faint">Documents</p>{landDocs.map((document) => <button key={document.id} type="button" onClick={() => onOpenDocument(document)} className="flex w-full items-center gap-2 border-b border-mr-line py-3 text-left text-[13px] font-medium text-mr-text hover:text-mr-blue"><FileText className="h-4 w-4 text-mr-faint" />{document.title}</button>)}{!landDocs.length && <p className="py-5 text-[12px] text-mr-muted">No land documents uploaded.</p>}</div></div>{acquisition.land_notes && <p className="mt-5 border-t border-mr-line pt-4 text-[13px] text-mr-muted">{acquisition.land_notes}</p>}</section>;
}

function agreementParties(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch {
    // Legacy records can contain a comma-separated list.
  }
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
}

function AgreementTab({ agreements, documents = [], canEdit, canUpload, onEdit, onView, onOpenDocument, onUpload, onPrint }) {
  const latest = agreements[0];
  const actions = <div className="flex flex-wrap items-center gap-2"><Button variant="outline" onClick={onPrint}><Printer className="mr-2 h-4 w-4" />Generate PDF</Button>{latest && <Button variant="outline" onClick={() => onView(latest)}><FileCheck2 className="mr-2 h-4 w-4" />View agreement</Button>}{canEdit && <Button onClick={onEdit}><Plus className="mr-2 h-4 w-4" />Record revision</Button>}</div>;
  if (!latest) return <section><SectionHead title="Agreement" description="Revisioned agreement history; executed records are preserved." actions={actions} /><EmptyBlock icon={FileCheck2} title="Agreement not started" description="Record the first agreement revision when terms are prepared." action={canEdit ? <Button onClick={onEdit}>Record agreement</Button> : null} tall /></section>;

  const parties = agreementParties(latest.witness_parties);
  const reviewFacts = [
    ['Created by', latest.created_by_name],
    ['Reviewed by', latest.reviewed_by_name],
    ['Witnesses / parties', parties.length ? parties.join(', ') : null],
    ['Remarks', latest.remarks],
  ];

  return (
    <section className="space-y-7">
      <SectionHead title="Agreement" description="The latest terms and every retained revision for this acquisition." actions={actions} />

      <div className="overflow-hidden rounded-xl border border-mr-line bg-mr-surface">
        <div className="flex flex-wrap items-start justify-between gap-5 border-b border-mr-line bg-mr-surface-2 px-5 py-5 sm:px-6">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-mr-faint">Current agreement</p>
            <h2 className="mt-1 text-[21px] font-semibold tracking-[-0.02em] text-mr-text">{latest.agreement_type || 'Purchase Agreement'}</h2>
            <p className="mt-1 text-[13px] text-mr-muted">{latest.agreement_number ? `Agreement no. ${latest.agreement_number}` : 'Agreement number not recorded'}</p>
          </div>
          <div className="flex items-center gap-3"><StatusDot tone={statusTone(latest.agreement_status)}>{readable(latest.agreement_status)}</StatusDot><span className="rounded-full border border-mr-line bg-mr-surface px-3 py-1 text-[12px] font-medium text-mr-muted">Revision {latest.revision_number}</span></div>
        </div>
        <div className="grid divide-y divide-mr-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            ['Agreed value', money(latest.agreement_value)],
            ['Agreement date', dateLabel(latest.agreement_date)],
            ['Revision history', `${agreements.length} saved ${agreements.length === 1 ? 'revision' : 'revisions'}`],
          ].map(([label, value]) => <div key={label} className="px-5 py-4 sm:px-6"><p className="text-[11px] font-medium uppercase tracking-[0.08em] text-mr-faint">{label}</p><p className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-mr-text">{value}</p></div>)}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,.9fr)]">
        <section className="rounded-xl border border-mr-line bg-mr-surface p-5 sm:p-6">
          <p className="text-[13px] font-semibold text-mr-text">Agreement details</p>
          <div className="mt-4 divide-y divide-mr-line border-y border-mr-line">
            {[
              ['Agreement type', latest.agreement_type],
              ['Agreement number', latest.agreement_number],
              ['Agreement date', dateLabel(latest.agreement_date)],
              ['Status', readable(latest.agreement_status)],
            ].map(([label, value]) => <div key={label} className="grid gap-1 py-3 sm:grid-cols-[150px_1fr] sm:gap-5"><p className="text-[12px] text-mr-muted">{label}</p><p className="break-words text-[13px] font-medium text-mr-text">{value || 'Not recorded'}</p></div>)}
          </div>
        </section>
        <section className="rounded-xl border border-mr-line bg-mr-surface p-5 sm:p-6">
          <p className="text-[13px] font-semibold text-mr-text">People & review</p>
          <div className="mt-4 divide-y divide-mr-line border-y border-mr-line">
            {reviewFacts.map(([label, value]) => <div key={label} className="grid gap-1 py-3 sm:grid-cols-[135px_1fr] sm:gap-5"><p className="text-[12px] text-mr-muted">{label}</p><p className="break-words whitespace-pre-wrap text-[13px] font-medium text-mr-text">{value || 'Not recorded'}</p></div>)}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-mr-line bg-mr-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[13px] font-semibold text-mr-text">Agreement PDF</p><p className="mt-1 text-[12px] text-mr-muted">Signed agreement files stored with this acquisition.</p></div>{canUpload && <Button type="button" variant="outline" size="sm" onClick={onUpload}><Upload className="mr-1.5 h-3.5 w-3.5" />Upload agreement PDF</Button>}</div>
        {documents.length ? <div className="mt-4 divide-y divide-mr-line border-y border-mr-line">{documents.map((document) => <button key={document.id} type="button" onClick={() => onOpenDocument(document)} className="group flex w-full items-center justify-between gap-4 px-1 py-3 text-left hover:bg-mr-surface-2"><span className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-mr-blue-soft text-mr-blue"><FileText className="h-4 w-4" /></span><span className="min-w-0"><span className="block truncate text-[13px] font-medium text-mr-text">{document.title || document.original_name || 'Agreement PDF'}</span><span className="mt-0.5 block text-[11px] text-mr-muted">{document.original_name || 'Agreement document'} · {dateLabel(document.created_at)}</span></span></span><span className="shrink-0 text-[12px] font-medium text-mr-blue transition-colors group-hover:underline">Open PDF</span></button>)}</div> : <div className="mt-4 rounded-lg border border-dashed border-mr-line bg-mr-surface-2 px-4 py-5 text-[13px] text-mr-muted">No agreement PDF is attached to this acquisition yet.</div>}
      </section>

      <section className="rounded-xl border border-mr-line bg-mr-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[13px] font-semibold text-mr-text">Revision timeline</p><p className="mt-1 text-[12px] text-mr-muted">Every saved revision stays available for review.</p></div><span className="text-[12px] text-mr-muted">Select a revision to open it</span></div>
        <ol className="mt-5 space-y-1">
          {agreements.map((item, index) => <li key={item.id} className="relative pl-10">{index < agreements.length - 1 && <span className="absolute bottom-[-8px] left-[15px] top-9 w-px bg-mr-line" />}<span className={`absolute left-0 top-3 flex h-8 w-8 items-center justify-center rounded-full border text-[11px] font-semibold ${item.id === latest.id ? 'border-mr-blue bg-mr-blue-soft text-mr-blue' : 'border-mr-line bg-mr-surface-2 text-mr-muted'}`}>{item.revision_number}</span><button type="button" onClick={() => onView(item)} className="group grid w-full gap-3 rounded-lg border border-transparent px-3 py-3 text-left transition-colors hover:border-mr-line hover:bg-mr-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><span><span className="block text-[13px] font-semibold text-mr-text">{item.agreement_type || 'Agreement revision'}</span><span className="mt-0.5 block text-[12px] text-mr-muted">{item.agreement_number || 'Number not recorded'} · {dateLabel(item.agreement_date)}</span></span><span className="flex items-center gap-3 sm:justify-end"><StatusDot tone={statusTone(item.agreement_status)}>{readable(item.agreement_status)}</StatusDot><span className="text-[11px] font-medium text-mr-faint transition-colors group-hover:text-mr-blue">View</span></span></button></li>)}
        </ol>
      </section>
    </section>
  );
}

function FinancialTab({ acquisition, schedule, canEdit, onEdit }) {
  return <section><SectionHead title="Financial terms" description="Contractual expectation is shown separately from actual posted transactions." actions={canEdit ? <Button variant="outline" onClick={onEdit}><Edit3 className="mr-2 h-4 w-4" />{acquisition.financial_terms_status === 'CONFIRMED' ? 'Revise terms' : 'Confirm terms'}</Button> : null} /><div className="grid gap-y-4 border-b border-mr-line py-5 sm:grid-cols-3">{[['Total consideration', money(acquisition.total_amount)], ['Cash agreed', money(acquisition.cash_amount)], ['Bank agreed', money(acquisition.bank_amount)]].map(([label, value]) => <div key={label}><p className="text-[11px] uppercase tracking-wide text-mr-faint">{label}</p><p className="mt-1 text-[20px] font-semibold text-mr-text">{value}</p></div>)}</div><div className="grid gap-5 border-b border-mr-line py-5 lg:grid-cols-3"><PaymentBar label="Cash" paid={acquisition.cash_paid} total={acquisition.cash_amount} /><PaymentBar label="Bank" paid={acquisition.bank_paid} total={acquisition.bank_amount} /><PaymentBar label="Total" paid={acquisition.total_paid} total={acquisition.total_amount} /></div><div className="mt-7"><p className="text-[12px] font-semibold text-mr-text">Payment schedule</p>{schedule.length ? <div className="mt-2 overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Installment</TableHead><TableHead>Due date</TableHead><TableHead>Mode</TableHead><TableHead className="text-right">Expected</TableHead><TableHead className="text-right">Paid</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{schedule.map((item) => <TableRow key={item.id}><TableCell className="font-medium">{item.description}</TableCell><TableCell>{dateLabel(item.due_date)}</TableCell><TableCell>{readable(item.preferred_mode)}</TableCell><TableCell className="text-right">{money(item.expected_amount)}</TableCell><TableCell className="text-right">{money(item.amount_paid)}</TableCell><TableCell><StatusDot tone={statusTone(item.effective_status)}>{readable(item.effective_status)}</StatusDot></TableCell></TableRow>)}</TableBody></Table></div> : <p className="mt-4 text-[13px] text-mr-muted">No payment schedule has been confirmed.</p>}</div></section>;
}

function PaymentBar({ label, paid, total }) {
  const denominator = Number(total) || 0;
  const percent = denominator > 0 ? Math.min(Math.max((Number(paid) || 0) / denominator * 100, 0), 100) : 0;
  return <div><div className="flex items-center justify-between gap-3 text-[12px]"><span className="font-medium text-mr-text">{label}</span><span className="tabular-nums text-mr-muted">{money(paid, true)} / {money(total, true)}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-mr-surface-2"><div className="h-full rounded-full bg-mr-blue transition-[width] duration-200" style={{ width: `${percent}%` }} /></div></div>;
}

function TransactionsTab({ transactions, canWrite, canReverse, onRecord, onOpen, onPrint, onReverse }) {
  return <section><SectionHead title="Transactions" description="Actual money movement from the existing Farmer Payment, Day Book and ledger architecture." actions={canWrite ? <Button onClick={onRecord}><Plus className="mr-2 h-4 w-4" />Record payment</Button> : null} />{transactions.length ? <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Particular</TableHead><TableHead>Mode</TableHead><TableHead>Reference</TableHead><TableHead>Allocation</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead className="w-20 text-right">Receipt</TableHead></TableRow></TableHeader><TableBody>{transactions.map((payment) => <TableRow key={payment.id} className="cursor-pointer" onClick={() => onOpen(payment)}><TableCell>{dateLabel(payment.date)}</TableCell><TableCell className="font-medium">{payment.particular}</TableCell><TableCell>{readable(payment.payment_mode)}</TableCell><TableCell>{payment.bank_reference || payment.cheque_no || '—'}</TableCell><TableCell>{payment.allocated_schedule || 'Unallocated'}</TableCell><TableCell className={`text-right font-semibold ${Number(payment.amount) < 0 ? 'text-mr-coral-ink' : ''}`}>{money(payment.amount)}</TableCell><TableCell><StatusDot tone={statusTone(payment.status)}>{readable(payment.status)}</StatusDot></TableCell><TableCell onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-end"><Button variant="ghost" size="icon" onClick={() => onPrint(payment)} title={`Print receipt FPR-${payment.id}`} aria-label={`Print receipt FPR-${payment.id}`}><ReceiptText className="h-4 w-4" /></Button>{canReverse && Number(payment.amount) > 0 && String(payment.status).toLowerCase() === 'approved' && !payment.reverses_payment_id ? <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => onOpen(payment)}>View details</DropdownMenuItem><DropdownMenuItem onClick={() => onPrint(payment)}>Print receipt</DropdownMenuItem><DropdownMenuItem className="text-mr-coral-ink" onClick={() => onReverse(payment)}>Create reversal</DropdownMenuItem></DropdownMenuContent></DropdownMenu> : null}</div></TableCell></TableRow>)}</TableBody></Table></div> : <EmptyBlock icon={Banknote} title="No payments yet" description="Record the first installment after financial terms are confirmed." action={canWrite ? <Button onClick={onRecord}>Record payment</Button> : null} tall />}</section>;
}

function DocumentsTab({ documents, canUpload, onUpload, onOpen }) {
  return <section><SectionHead title="Documents" description="Land, agreement, KYC, registry and payment evidence in existing private document storage." actions={canUpload ? <Button onClick={onUpload}><Upload className="mr-2 h-4 w-4" />Upload document</Button> : null} />{documents.length ? <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Document</TableHead><TableHead>Type</TableHead><TableHead>Uploaded by</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead className="w-10" /></TableRow></TableHeader><TableBody>{documents.map((document) => <TableRow key={document.id}><TableCell className="font-medium">{document.title}</TableCell><TableCell>{readable(document.category)}</TableCell><TableCell>{document.uploaded_by_name || 'MountReality user'}</TableCell><TableCell>{dateLabel(document.created_at)}</TableCell><TableCell><StatusDot tone={statusTone(document.review_status)}>{readable(document.review_status || 'NOT_REVIEWED')}</StatusDot></TableCell><TableCell><Button variant="ghost" size="icon" onClick={() => onOpen(document)}><Download className="h-4 w-4" /><span className="sr-only">Open document</span></Button></TableCell></TableRow>)}</TableBody></Table></div> : <EmptyBlock icon={FileText} title="No acquisition documents" description="Upload land records, agreements, payment proofs or other supporting evidence." action={canUpload ? <Button onClick={onUpload}>Upload document</Button> : null} tall />}</section>;
}

function Fact({ label, value }) {
  return <div className="border-b border-mr-line py-3"><p className="text-[11px] font-medium uppercase tracking-[0.08em] text-mr-faint">{label}</p><p className="mt-1 break-words text-[13px] font-medium text-mr-text">{value || 'Not recorded'}</p></div>;
}
