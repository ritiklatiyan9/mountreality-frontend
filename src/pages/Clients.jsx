import { writePrintDocument } from '../lib/safePrint';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Separator } from '../components/ui/separator';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { useRowSelection } from '../hooks/useRowSelection';
import BulkActionsBar from '../components/BulkActionsBar';
import { EmptyState, SkeletonBlock } from '../components/dashboard/primitives';
import { EmptyBlock, PRIMARY_BTN } from '../components/ui/page';
import MembersSummary from '../components/clients/MembersSummary';
import MembersToolbar from '../components/clients/MembersToolbar';
import MembersTable from '../components/clients/MembersTable';
import MembersMobileList from '../components/clients/MembersMobileList';
import { MemberAvatar as Avatar } from '../components/clients/memberDisplay';
import { MEMBER_TYPES, isKycIncomplete } from '../components/clients/memberMeta';
import { SiteRegistrationDialog } from '../components/MemberKycDialog';
import { KYC_DOC_FIELDS, EMPLOYEE_DOC_FIELDS } from '../components/memberKycFields';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Building2, Plus, Search, Edit2, Trash2, ArrowLeft, Download,
  Eye, Phone, Mail, MapPin, User, Users, Camera, X, Check,
  Printer,
  AlertCircle, Loader2, Calendar, CreditCard, Briefcase,
  Shield, Hash, Heart, UserCheck, Tractor, Handshake,
  Store, HelpCircle, FileText, Upload, Trash, GraduationCap,
  BadgeCheck, UserCog, Clock, IndianRupee, Contact, FileCheck, ArrowUpDown, UserPlus, Tag
} from 'lucide-react';
import * as XLSX from 'xlsx';

// ── Constants ──
const GENDER_OPTIONS = ['MALE', 'FEMALE', 'OTHER'];
const BLOOD_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'BLOCKED'];
const MARITAL_OPTIONS = ['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED'];
const EMPLOYMENT_TYPE_OPTIONS = ['FULL-TIME', 'PART-TIME', 'CONTRACT', 'INTERN', 'PROBATION', 'FREELANCE'];
const ROLE_OPTIONS = ['OWNER', 'PARTNER', 'DIRECTOR', 'MANAGER', 'STAFF', 'CONSULTANT', 'REPRESENTATIVE', 'OTHER'];
const CATEGORY_ICON_MAP = { UserCheck, Tractor, Users, Handshake, Store, UserCog, HelpCircle, Tag };

const EMPTY_FORM = {
  member_type: 'CLIENT', role: '', full_name: '', father_name: '', gender: '', date_of_birth: '',
  blood_group: '', phone: '', alt_phone: '', email: '', whatsapp: '',
  address: '', city: '', state: '', pincode: '',
  aadhar_no: '', pan_no: '', voter_id: '',
  bank_name: '', account_no: '', ifsc_code: '', branch: '',
  occupation: '', company_name: '', reference: '', notes: '', status: 'ACTIVE',
  // New personal
  mother_name: '', spouse_name: '', nationality: '', religion: '', caste: '',
  marital_status: '', anniversary_date: '', qualification: '',
  // Additional identity
  passport_no: '', driving_license_no: '', gst_no: '', tin_no: '',
  // Emergency contact
  emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relation: '',
  // Nominee
  nominee_name: '', nominee_relation: '', nominee_phone: '',
  // Employee-specific
  employee_id: '', designation: '', department: '', date_of_joining: '', salary: '', employment_type: '',
  // Team (for broker/member/employee/partner)
  team: '',
};

export const Clients = () => {
  const { currentSite, sites, canManage, hasPermission } = useAuth();
  const canWrite  = canManage && hasPermission('clients', 'write');
  const canUpdate = canManage && hasPermission('clients', 'update');
  const canDelete = canManage && hasPermission('clients', 'delete');
  const navigate = useNavigate();
  const location = useLocation();
  const siteId = currentSite?.id;

  // ── State ──
  const [members, setMembers] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(false);
  const [autocomplete, setAutocomplete] = useState({ cities: [], occupations: [], companies: [], references: [] });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);
  const selection = useRowSelection();
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const fileInputRef = useRef(null);
  // KYC & Employee document files
  const [docFiles, setDocFiles] = useState({});        // { field_key: File }
  const [docPreviews, setDocPreviews] = useState({});   // { field_key: url_string }
  const [removeDocs, setRemoveDocs] = useState({});     // { field_key: true }
  const [siteRegistrationOpen, setSiteRegistrationOpen] = useState(false);
  const [siteRegistrationMember, setSiteRegistrationMember] = useState(null);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreateSubmitting, setQuickCreateSubmitting] = useState(false);
  const [quickCreateForm, setQuickCreateForm] = useState({ full_name: '', phone: '', role: '', member_type: '' });
  const [quickCreateCategories, setQuickCreateCategories] = useState([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterTeam, setFilterTeam] = useState('ALL');
  const [filterKyc, setFilterKyc] = useState('ALL');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    const queryFromUrl = new URLSearchParams(location.search).get('q') || '';
    setSearchQuery(queryFromUrl);
  }, [location.search]);

  // ── Fetchers ──
  // Refresh members list only (used after create/update/delete). Does NOT toggle the
  // page-wide loader, so the table stays interactive while the latest data loads.
  const refreshMembers = useCallback(async () => {
    if (!siteId) return;
    try {
      const memRes = await api.get('/members', { params: { site_id: siteId } });
      setMembers(memRes.data.members || []);
      setSummary(memRes.data.summary || {});
    } catch (err) {
      console.error('Failed to refresh members:', err);
    }
  }, [siteId]);

  // Initial load (members + autocomplete). Autocomplete is fetched once per site;
  // it does not need to be refreshed after every form submit.
  const loadInitial = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    // Safety watchdog — never let the loader hang past 15s if a request silently stalls
    const watchdog = setTimeout(() => setLoading(false), 15000);
    try {
      const [memRes, acRes] = await Promise.all([
        api.get('/members', { params: { site_id: siteId } }),
        api.get('/members/autocomplete', { params: { site_id: siteId } }),
      ]);
      setMembers(memRes.data.members || []);
      setSummary(memRes.data.summary || {});
      setAutocomplete(acRes.data || { cities: [], occupations: [], companies: [], references: [] });
    } catch (err) {
      console.error('Failed to fetch members:', err);
    } finally {
      clearTimeout(watchdog);
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    setMembers([]);
    // Team options vary per site — a stale team would silently filter
    // everything out once the Select hides for team-less sites.
    setFilterTeam('ALL');
    setFilterKyc('ALL');
    loadInitial();
  }, [siteId, loadInitial]);

  // Live category list (org-wide, admin-managed via "User Categories") — used
  // by the quick-add dialog's Category field instead of a hardcoded list.
  useEffect(() => {
    api.get('/member-categories')
      .then((res) => setQuickCreateCategories(res.data.categories || []))
      .catch((err) => console.error('Failed to load member categories:', err));
  }, []);

  // ── Form Handlers ──
  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setPhotoFile(null);
    setPhotoPreview(null);
    setRemovePhoto(false);
    setDocFiles({});
    setDocPreviews({});
    setRemoveDocs({});
    setMessage({ type: '', text: '' });
  };

  const resetQuickCreateForm = () => setQuickCreateForm({ full_name: '', phone: '', role: '', member_type: '' });

  const handleOpenCreate = () => {
    resetQuickCreateForm();
    setQuickCreateOpen(true);
  };

  const handleQuickCreate = async (ev) => {
    ev.preventDefault();
    const fullName = quickCreateForm.full_name.trim();
    const phone = quickCreateForm.phone.trim();
    if (!fullName) {
      toast.error('Member name is required');
      return;
    }
    if (!phone) {
      toast.error('Phone number is required');
      return;
    }
    if (!siteId) {
      toast.error('Select a site before adding members');
      return;
    }

    setQuickCreateSubmitting(true);
    try {
      const payload = {
        site_id: siteId,
        full_name: fullName,
        phone,
        ...(quickCreateForm.role ? { role: quickCreateForm.role } : {}),
        ...(quickCreateForm.member_type ? { member_type: quickCreateForm.member_type } : {}),
      };
      const { data } = await api.post('/members', payload);
      setQuickCreateOpen(false);
      resetQuickCreateForm();
      refreshMembers();
      toast.success(data?.member?.full_name ? `${data.member.full_name} added` : 'Member added');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add member');
    } finally {
      setQuickCreateSubmitting(false);
    }
  };

  const handleOpenEdit = async (memberRow) => {
    let m = memberRow;
    try {
      const { data } = await api.get(`/members/${memberRow.id}`);
      m = data?.member || memberRow;
    } catch (error) {
      console.error('Failed to load complete member profile:', error);
      toast.error('Some profile details could not be refreshed. You can still edit this member.');
    }
    setForm({
      member_type: m.member_type || 'CLIENT',
      role: m.role || '',
      full_name: m.full_name || '',
      father_name: m.father_name || '',
      gender: m.gender || '',
      date_of_birth: m.date_of_birth ? m.date_of_birth.split('T')[0] : '',
      blood_group: m.blood_group || '',
      phone: m.phone || '',
      alt_phone: m.alt_phone || '',
      email: m.email || '',
      whatsapp: m.whatsapp || '',
      address: m.address || '',
      city: m.city || '',
      state: m.state || '',
      pincode: m.pincode || '',
      aadhar_no: m.aadhar_no || '',
      pan_no: m.pan_no || '',
      voter_id: m.voter_id || '',
      bank_name: m.bank_name || '',
      account_no: m.account_no || '',
      ifsc_code: m.ifsc_code || '',
      branch: m.branch || '',
      occupation: m.occupation || '',
      company_name: m.company_name || '',
      reference: m.reference || '',
      notes: m.notes || '',
      status: m.status || 'ACTIVE',
      // New personal
      mother_name: m.mother_name || '',
      spouse_name: m.spouse_name || '',
      nationality: m.nationality || '',
      religion: m.religion || '',
      caste: m.caste || '',
      marital_status: m.marital_status || '',
      anniversary_date: m.anniversary_date ? m.anniversary_date.split('T')[0] : '',
      qualification: m.qualification || '',
      // Additional identity
      passport_no: m.passport_no || '',
      driving_license_no: m.driving_license_no || '',
      gst_no: m.gst_no || '',
      tin_no: m.tin_no || '',
      // Emergency contact
      emergency_contact_name: m.emergency_contact_name || '',
      emergency_contact_phone: m.emergency_contact_phone || '',
      emergency_contact_relation: m.emergency_contact_relation || '',
      // Nominee
      nominee_name: m.nominee_name || '',
      nominee_relation: m.nominee_relation || '',
      nominee_phone: m.nominee_phone || '',
      // Employee
      employee_id: m.employee_id || '',
      designation: m.designation || '',
      department: m.department || '',
      date_of_joining: m.date_of_joining ? m.date_of_joining.split('T')[0] : '',
      salary: m.salary || '',
      employment_type: m.employment_type || '',
      team: m.team || '',
    });
    setEditingId(m.id);
    setPhotoPreview(m.photo || null);
    setPhotoFile(null);
    setRemovePhoto(false);
    // Populate existing document previews
    const existingDocs = {};
    [...KYC_DOC_FIELDS, ...EMPLOYEE_DOC_FIELDS].forEach(d => {
      if (m[d.key]) existingDocs[d.key] = m[d.key];
    });
    setDocPreviews(existingDocs);
    setDocFiles({});
    setRemoveDocs({});
    setDialogOpen(true);
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMessage({ type: 'error', text: 'Choose a JPG, PNG or WebP profile image.' });
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Profile image must be smaller than 5 MB.' });
      e.target.value = '';
      return;
    }
    setPhotoFile(file);
    setRemovePhoto(false);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleClearPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setRemovePhoto(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    setMessage({ type: '', text: '' });
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('site_id', siteId);
      Object.entries(form).forEach(([key, val]) => {
        if (val !== null && val !== undefined && val !== '') formData.append(key, val);
      });
      if (photoFile) formData.append('photo', photoFile);
      if (removePhoto) formData.append('remove_photo', 'true');

      // Append KYC & Employee document files
      Object.entries(docFiles).forEach(([fieldKey, file]) => {
        if (file) formData.append(fieldKey, file);
      });
      // Append remove flags for documents
      Object.entries(removeDocs).forEach(([fieldKey, val]) => {
        if (val) formData.append(`remove_${fieldKey}`, 'true');
      });

      let savedMember = null;
      if (editingId) {
        const { data } = await api.put(`/members/${editingId}`, formData);
        savedMember = data?.member || null;
      } else {
        const { data } = await api.post('/members', formData);
        savedMember = data?.member || null;
      }

      // Optimistic in-place update so the table reflects the change immediately
      // without waiting for a full re-fetch round-trip.
      if (savedMember) {
        setMembers(prev => {
          const idx = prev.findIndex(p => p.id === savedMember.id);
          if (idx === -1) return [savedMember, ...prev];
          const next = prev.slice();
          next[idx] = { ...next[idx], ...savedMember };
          return next;
        });
      }

      // Close dialog right away — no artificial delay.
      setDialogOpen(false);
      // Reconcile with the server in the background (covers summary counts + any
      // server-side defaults). The table stays responsive while this runs.
      refreshMembers();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (m) => {
    if (!window.confirm(`Delete ${m.full_name}? This cannot be undone.`)) return;
    // Optimistic removal — instant UI feedback.
    const snapshot = members;
    setMembers(prev => prev.filter(x => x.id !== m.id));
    try {
      await api.delete(`/members/${m.id}`);
      refreshMembers();
    } catch (err) {
      console.error('Delete failed:', err);
      setMembers(snapshot); // rollback on failure
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selection.selected);
    setBulkDeleting(true);
    try {
      const { data } = await api.post('/members/bulk-delete', { ids });
      setMembers(prev => prev.filter(m => !ids.includes(m.id)));
      selection.clear();
      refreshMembers();
      toast.success(data?.message || 'Clients deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete clients');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleBulkPrint = () => {
    const selectedIds = new Set(selection.selected);
    const rows = selectedIds.size > 0 ? filteredMembers.filter(m => selectedIds.has(m.id)) : filteredMembers;
    const win = window.open('', '_blank', 'width=1200,height=900');
    if (!win) return;

    const escapeHtml = (value) => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    const rowsHtml = rows.map((m, index) => {
      const kycStatus = isKycIncomplete(m) ? 'Incomplete' : (m.shared_kyc_status || 'Complete');
      return `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(m.member_type || '')}</td>
        <td>${escapeHtml(m.full_name || '')}</td>
        <td>${escapeHtml(m.father_name || '')}</td>
        <td>${escapeHtml(m.phone || '')}</td>
        <td>${escapeHtml(m.email || '')}</td>
        <td>${escapeHtml(m.city || '')}</td>
        <td>${escapeHtml(m.team || '')}</td>
        <td>${escapeHtml(m.status || '')}</td>
        <td>${escapeHtml(kycStatus)}</td>
      </tr>`;
    }).join('');

    const title = selectedIds.size > 0 ? 'Selected Members Report' : 'Members Report';
    const subtitle = selectedIds.size > 0
      ? `${selectedIds.size} selected member${selectedIds.size === 1 ? '' : 's'}`
      : `${rows.length} member${rows.length === 1 ? '' : 's'} in current view`;

    writePrintDocument(win, `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>${title}</title>
          <style>
            :root { color-scheme: light; }
            * { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
              margin: 0;
              padding: 16px;
              color: #111827;
              background: #fff;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 12px;
              padding-bottom: 10px;
              border-bottom: 2px solid #e5e7eb;
            }
            .title { font-size: 20px; font-weight: 700; margin: 0; }
            .subtitle { font-size: 12px; color: #6b7280; margin-top: 4px; }
            .meta {
              font-size: 12px;
              color: #374151;
              text-align: right;
              line-height: 1.5;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11px;
            }
            th, td {
              border: 1px solid #d1d5db;
              padding: 8px 7px;
              text-align: left;
              vertical-align: top;
            }
            th {
              background: #f3f4f6;
              font-weight: 700;
              color: #111827;
            }
            tbody tr:nth-child(even) {
              background: #fafafa;
            }
            tbody tr { page-break-inside: avoid; }
            @page { size: A4 landscape; margin: 10mm; }
            @media print {
              body { padding: 10mm; }
              .header { margin-bottom: 8px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h2 class="title">${title}</h2>
              <div class="subtitle">${subtitle}</div>
            </div>
            <div class="meta">
              <div>Site: ${escapeHtml(currentSite?.name || '—')}</div>
              <div>Generated: ${new Date().toLocaleString('en-IN')}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Type</th>
                <th>Name</th>
                <th>Father Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>City</th>
                <th>Team</th>
                <th>Status</th>
                <th>KYC Status</th>
              </tr>
            </thead>
            <tbody>${rowsHtml || '<tr><td colspan="10" style="text-align:center; color:#6b7280;">No records found</td></tr>'}</tbody>
          </table>
        </body>
      </html>
    `);
    win.document.close();
    setTimeout(() => win.print(), 250);
  };

  // ── Filters ──
  const uniqueTeams = useMemo(
    () => [...new Set(members.map(m => (m.team || '').trim().toUpperCase()).filter(Boolean))].sort(),
    [members]
  );

  const filteredMembers = useMemo(() => {
    let list = [...members];
    if (filterType !== 'ALL') list = list.filter(m => m.member_type === filterType);
    if (filterStatus !== 'ALL') list = list.filter(m => m.status === filterStatus);
    if (filterTeam !== 'ALL') list = list.filter(m => (m.team || '').trim().toUpperCase() === filterTeam);
    if (filterKyc === 'INCOMPLETE') list = list.filter(m => isKycIncomplete(m));
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      list = list.filter(m =>
        m.full_name?.toLowerCase().includes(q) ||
        m.father_name?.toLowerCase().includes(q) ||
        m.phone?.includes(q) ||
        m.email?.toLowerCase().includes(q) ||
        m.city?.toLowerCase().includes(q) ||
        m.aadhar_no?.includes(q) ||
        m.team?.toLowerCase().includes(q)
      );
    }
    if (sortOrder === 'asc') list.reverse();
    return list;
  }, [members, filterType, filterStatus, filterTeam, filterKyc, searchQuery, sortOrder]);

  const visibleIds = useMemo(() => filteredMembers.map(m => m.id), [filteredMembers]);

  // Passed to both the table and the mobile list so they can never drift.
  const memberPermissions = { canWrite, canUpdate, canDelete };
  const memberActions = {
    onView: (m) => navigate(`/clients/${m.id}`),
    onRegisterSite: (m) => { setSiteRegistrationMember(m); setSiteRegistrationOpen(true); },
    onEdit: (m) => handleOpenEdit(m),
    onDelete: (m) => handleDelete(m),
  };

  // ── Excel Export ──
  const downloadExcel = () => {
    const headers = ['#', 'Type', 'Full Name', 'Father Name', 'Phone', 'Email', 'City', 'State', 'Aadhar', 'PAN', 'Occupation', 'Status'];
    const rows = filteredMembers.map((m, i) => [
      i + 1, m.member_type, m.full_name, m.father_name || '', m.phone || '', m.email || '',
      m.city || '', m.state || '', m.aadhar_no || '', m.pan_no || '', m.occupation || '', m.status,
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = headers.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Members');
    XLSX.writeFile(wb, `Members_${currentSite?.name || 'site'}.xlsx`);
  };

  // ── Document upload helpers ──
  const handleDocSelect = (fieldKey, fileOrEvent) => {
    const file = fileOrEvent?.target?.files?.[0] || fileOrEvent;
    if (!file) return;
    setDocFiles(prev => ({ ...prev, [fieldKey]: file }));
    setRemoveDocs(prev => ({ ...prev, [fieldKey]: false }));
    // Generate preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setDocPreviews(prev => ({ ...prev, [fieldKey]: reader.result }));
      reader.readAsDataURL(file);
    } else {
      setDocPreviews(prev => ({ ...prev, [fieldKey]: 'pdf' }));
    }
  };

  const handleDocRemove = (fieldKey) => {
    setDocFiles(prev => { const n = { ...prev }; delete n[fieldKey]; return n; });
    setDocPreviews(prev => { const n = { ...prev }; delete n[fieldKey]; return n; });
    setRemoveDocs(prev => ({ ...prev, [fieldKey]: true }));
  };

  // ── Reusable document upload card component ──
  const DocUploadCard = ({ fieldDef }) => {
    const { key, label, accept } = fieldDef;
    const preview = docPreviews[key];
    const inputRef = useRef(null);
    return (
      <div className="border border-slate-200 rounded-lg p-3 space-y-2">
        <p className="text-xs font-medium text-slate-600">{label}</p>
        {preview ? (
          <div className="relative group">
            {preview === 'pdf' ? (
              <div className="w-full h-20 rounded-md bg-red-50 flex items-center justify-center">
                <FileText className="w-6 h-6 text-red-400" />
                <span className="text-xs text-red-500 ml-1">PDF</span>
              </div>
            ) : (
              <img src={preview} alt={label} className="w-full h-20 object-cover rounded-md border" />
            )}
            <button type="button" onClick={() => handleDocRemove(key)}
              className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => inputRef.current?.click()}
            className="w-full h-20 rounded-md border-2 border-dashed border-slate-200 hover:border-slate-400 transition-colors flex flex-col items-center justify-center gap-1">
            <Upload className="w-4 h-4 text-slate-400" />
            <span className="text-[10px] text-slate-400">Upload</span>
          </button>
        )}
        <input ref={inputRef} type="file" accept={accept} onChange={(e) => handleDocSelect(key, e)} className="hidden" />
        {preview && (
          <button type="button" onClick={() => inputRef.current?.click()} className="text-[10px] text-blue-500 hover:text-blue-700 font-medium">
            Replace
          </button>
        )}
      </div>
    );
  };

  // ═══════════════════════════════════════════════════
  //  MEMBER FORM DIALOG (inline JSX to prevent remount/flicker)
  // ═══════════════════════════════════════════════════
  const memberDialogJsx = (
    <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Edit Member</DialogTitle>
          <DialogDescription className="text-sm">
            Update member details, documents and KYC.
          </DialogDescription>
        </DialogHeader>

        {message.text && (
          <div className={`flex gap-2 p-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-emerald-50 border border-emerald-100 text-emerald-700'
              : 'bg-red-50 border border-red-100 text-red-700'
          }`}>
            {message.type === 'success' ? <Check className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Photo + Type */}
          <div className="flex items-start gap-5">
            <div className="flex flex-col items-center gap-2">
              <div className="relative group">
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="w-24 h-24 rounded-xl object-cover border-2 border-slate-200 shadow-sm" />
                ) : (
                  <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 border-2 border-dashed border-slate-300 flex items-center justify-center">
                    <Camera className="w-6 h-6 text-slate-400" />
                  </div>
                )}
                <input type="file" ref={fileInputRef} accept="image/jpeg,image/png,image/webp" onChange={handlePhotoSelect} className="hidden" />
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <Camera className="w-5 h-5 text-white" />
                </button>
              </div>
              {photoPreview && (
                <button type="button" onClick={handleClearPhoto} className="text-[10px] text-red-500 hover:text-red-700 font-medium">
                  Remove Photo
                </button>
              )}
              <p className="text-[10px] text-slate-400">JPG/PNG, max 5MB</p>
            </div>
            <div className="flex-1 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Member Type</Label>
                  <Select value={form.member_type} onValueChange={(v) => setForm({ ...form, member_type: v })}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MEMBER_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Role</Label>
                  <Select value={form.role || 'none'} onValueChange={(v) => setForm({ ...form, role: v === 'none' ? '' : v })}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select role" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not Specified</SelectItem>
                      {ROLE_OPTIONS.map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Full Name</Label>
                  <Input placeholder="RAJESH KUMAR" value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value.toUpperCase() })} required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Father / Husband Name</Label>
                  <Input placeholder="S/O RAMESH KUMAR" value={form.father_name}
                    onChange={(e) => setForm({ ...form, father_name: e.target.value.toUpperCase() })} />
                </div>
              </div>
              {['BROKER', 'MEMBER', 'EMPLOYEE', 'PARTNER'].includes(form.member_type) && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" /> Team
                    </Label>
                    <Input placeholder="TEAM A, TEAM B..." value={form.team}
                      onChange={(e) => setForm({ ...form, team: e.target.value.toUpperCase() })} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Personal */}
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Personal Details
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Gender</Label>
                <Select value={form.gender || 'none'} onValueChange={(v) => setForm({ ...form, gender: v === 'none' ? '' : v })}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not Specified</SelectItem>
                    {GENDER_OPTIONS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Date of Birth</Label>
                <Input type="date" value={form.date_of_birth}
                  onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Blood Group</Label>
                <Select value={form.blood_group || 'none'} onValueChange={(v) => setForm({ ...form, blood_group: v === 'none' ? '' : v })}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not Specified</SelectItem>
                    {BLOOD_OPTIONS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Marital Status</Label>
                <Select value={form.marital_status || 'none'} onValueChange={(v) => setForm({ ...form, marital_status: v === 'none' ? '' : v })}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not Specified</SelectItem>
                    {MARITAL_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Mother's Name</Label>
                <Input placeholder="MOTHER NAME" value={form.mother_name}
                  onChange={(e) => setForm({ ...form, mother_name: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Spouse Name</Label>
                <Input placeholder="SPOUSE NAME" value={form.spouse_name}
                  onChange={(e) => setForm({ ...form, spouse_name: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Anniversary Date</Label>
                <Input type="date" value={form.anniversary_date}
                  onChange={(e) => setForm({ ...form, anniversary_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Qualification</Label>
                <Input placeholder="B.TECH, MBA..." value={form.qualification}
                  onChange={(e) => setForm({ ...form, qualification: e.target.value.toUpperCase() })} />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Occupation</Label>
                <Input placeholder="BUSINESSMAN, FARMER..." value={form.occupation}
                  onChange={(e) => setForm({ ...form, occupation: e.target.value.toUpperCase() })}
                  list="occ-list" />
                <datalist id="occ-list">
                  {autocomplete.occupations?.map(v => <option key={v} value={v} />)}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Nationality</Label>
                <Input placeholder="INDIAN" value={form.nationality}
                  onChange={(e) => setForm({ ...form, nationality: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Religion</Label>
                <Input placeholder="HINDU, MUSLIM..." value={form.religion}
                  onChange={(e) => setForm({ ...form, religion: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Caste</Label>
                <Input placeholder="CASTE" value={form.caste}
                  onChange={(e) => setForm({ ...form, caste: e.target.value.toUpperCase() })} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Contact */}
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" /> Contact Details
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Phone</Label>
                <Input placeholder="9876543210" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Alt Phone</Label>
                <Input placeholder="Alternate number" value={form.alt_phone}
                  onChange={(e) => setForm({ ...form, alt_phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">WhatsApp</Label>
                <Input placeholder="WhatsApp number" value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Email</Label>
                <Input type="email" placeholder="email@example.com" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value.toLowerCase() })} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Address */}
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Address
            </p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Full Address</Label>
                <Textarea placeholder="House No, Street, Locality..." value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">City</Label>
                  <Input placeholder="JAIPUR" value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value.toUpperCase() })}
                    list="city-list" />
                  <datalist id="city-list">
                    {autocomplete.cities?.map(v => <option key={v} value={v} />)}
                  </datalist>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">State</Label>
                  <Input placeholder="RAJASTHAN" value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Pincode</Label>
                  <Input placeholder="302001" value={form.pincode}
                    onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Identity Documents (Numbers) */}
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Identity Documents
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Aadhar Number</Label>
                <Input placeholder="1234 5678 9012" value={form.aadhar_no}
                  onChange={(e) => setForm({ ...form, aadhar_no: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">PAN Number</Label>
                <Input placeholder="ABCDE1234F" value={form.pan_no}
                  onChange={(e) => setForm({ ...form, pan_no: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Voter ID</Label>
                <Input placeholder="ABC1234567" value={form.voter_id}
                  onChange={(e) => setForm({ ...form, voter_id: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Passport Number</Label>
                <Input placeholder="A1234567" value={form.passport_no}
                  onChange={(e) => setForm({ ...form, passport_no: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Driving License No</Label>
                <Input placeholder="DL-1234567890" value={form.driving_license_no}
                  onChange={(e) => setForm({ ...form, driving_license_no: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">GST Number</Label>
                <Input placeholder="22AAAAA0000A1Z5" value={form.gst_no}
                  onChange={(e) => setForm({ ...form, gst_no: e.target.value.toUpperCase() })} />
              </div>
            </div>
          </div>

          <Separator />

          {/* KYC Document Uploads */}
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FileCheck className="w-3.5 h-3.5" /> KYC Document Photos
            </p>
            <p className="text-[10px] text-slate-400 mb-3">Upload scanned copies of identity documents (JPG, PNG, PDF — max 5MB each)</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {KYC_DOC_FIELDS.map(doc => (
                <DocUploadCard key={doc.key} fieldDef={doc} />
              ))}
            </div>
          </div>

          <Separator />

          {/* Bank */}
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5" /> Bank Details
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Bank Name</Label>
                <Input placeholder="SBI, HDFC..." value={form.bank_name}
                  onChange={(e) => setForm({ ...form, bank_name: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Account Number</Label>
                <Input placeholder="Account No" value={form.account_no}
                  onChange={(e) => setForm({ ...form, account_no: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">IFSC Code</Label>
                <Input placeholder="SBIN0001234" value={form.ifsc_code}
                  onChange={(e) => setForm({ ...form, ifsc_code: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Branch</Label>
                <Input placeholder="Branch name" value={form.branch}
                  onChange={(e) => setForm({ ...form, branch: e.target.value.toUpperCase() })} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Emergency Contact */}
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" /> Emergency Contact
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Contact Name</Label>
                <Input placeholder="EMERGENCY CONTACT NAME" value={form.emergency_contact_name}
                  onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Contact Phone</Label>
                <Input placeholder="9876543210" value={form.emergency_contact_phone}
                  onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Relation</Label>
                <Input placeholder="FATHER, SPOUSE, BROTHER..." value={form.emergency_contact_relation}
                  onChange={(e) => setForm({ ...form, emergency_contact_relation: e.target.value.toUpperCase() })} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Nominee */}
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Contact className="w-3.5 h-3.5" /> Nominee Details
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Nominee Name</Label>
                <Input placeholder="NOMINEE NAME" value={form.nominee_name}
                  onChange={(e) => setForm({ ...form, nominee_name: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Nominee Relation</Label>
                <Input placeholder="WIFE, SON, DAUGHTER..." value={form.nominee_relation}
                  onChange={(e) => setForm({ ...form, nominee_relation: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Nominee Phone</Label>
                <Input placeholder="9876543210" value={form.nominee_phone}
                  onChange={(e) => setForm({ ...form, nominee_phone: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Employee-Specific Section (conditional) */}
          {form.member_type === 'EMPLOYEE' && (
            <>
              <Separator />
              <div>
                <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <UserCog className="w-3.5 h-3.5" /> Employee Details
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Employee ID</Label>
                    <Input placeholder="EMP-001" value={form.employee_id}
                      onChange={(e) => setForm({ ...form, employee_id: e.target.value.toUpperCase() })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Designation</Label>
                    <Input placeholder="MANAGER, ACCOUNTANT..." value={form.designation}
                      onChange={(e) => setForm({ ...form, designation: e.target.value.toUpperCase() })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Department</Label>
                    <Input placeholder="ACCOUNTS, HR, SALES..." value={form.department}
                      onChange={(e) => setForm({ ...form, department: e.target.value.toUpperCase() })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Date of Joining</Label>
                    <Input type="date" value={form.date_of_joining}
                      onChange={(e) => setForm({ ...form, date_of_joining: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Salary (₹)</Label>
                    <Input type="number" placeholder="25000" value={form.salary}
                      onChange={(e) => setForm({ ...form, salary: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Employment Type</Label>
                    <Select value={form.employment_type || 'none'} onValueChange={(v) => setForm({ ...form, employment_type: v === 'none' ? '' : v })}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not Specified</SelectItem>
                        {EMPLOYMENT_TYPE_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />
              {/* Employee Documents */}
              <div>
                <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5" /> Employee Documents
                </p>
                <p className="text-[10px] text-slate-400 mb-3">Upload resume, marksheets, certificates (JPG, PNG, PDF — max 5MB each)</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {EMPLOYEE_DOC_FIELDS.map(doc => (
                    <DocUploadCard key={doc.key} fieldDef={doc} />
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Other / Additional */}
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5" /> Additional Info
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Company Name</Label>
                <Input placeholder="Company / Firm" value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value.toUpperCase() })}
                  list="comp-list" />
                <datalist id="comp-list">
                  {autocomplete.companies?.map(v => <option key={v} value={v} />)}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Reference / Referred By</Label>
                <Input placeholder="Who referred this member" value={form.reference}
                  onChange={(e) => setForm({ ...form, reference: e.target.value.toUpperCase() })}
                  list="ref-list" />
                <datalist id="ref-list">
                  {autocomplete.references?.map(v => <option key={v} value={v} />)}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">TIN Number</Label>
                <Input placeholder="TIN Number" value={form.tin_no}
                  onChange={(e) => setForm({ ...form, tin_no: e.target.value.toUpperCase() })} />
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              <Label className="text-xs font-medium">Notes / Remarks</Label>
              <Textarea placeholder="Any additional notes or remarks about this member..." value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />{editingId ? 'Updating...' : 'Creating...'}</>
              ) : (editingId ? 'Update Member' : 'Create Member')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  // ═══════════════════════════════════════════════════
  //   NO SITE
  // ═══════════════════════════════════════════════════
  if (!currentSite) {
    return (
      <EmptyBlock icon={Building2} title="Select a site to view members" tall />
    );
  }

  // ═══════════════════════════════════════════════════
  //  LIST VIEW
  // ═══════════════════════════════════════════════════
  return (
    <div className="w-full space-y-6 pb-16">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center print:hidden">
        <div>
          <h1 className="text-[clamp(1.5rem,2.6vw,2rem)] font-semibold tracking-[-0.035em] text-mr-text">Members</h1>
          <p className="mt-1 text-[13px] text-mr-muted">Clients, farmers and members{currentSite?.name ? ` · ${currentSite.name}` : ''}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
            <BulkActionsBar
              count={selection.count}
              onClear={selection.clear}
              onEdit={canUpdate ? () => {
                const row = filteredMembers.find(m => selection.isSelected(m.id));
                if (row) handleOpenEdit(row);
              } : undefined}
              onDelete={canDelete ? handleBulkDelete : undefined}
              onPrint={handleBulkPrint}
              entityLabel="client"
              deleting={bulkDeleting}
            />
            <button type="button" className="inline-flex h-10 items-center gap-1.5 rounded-full border border-mr-line bg-mr-surface px-3.5 text-[13px] font-medium text-mr-text transition-colors hover:bg-mr-surface-2 disabled:pointer-events-none disabled:opacity-50" onClick={handleBulkPrint} disabled={filteredMembers.length === 0}>
              <Printer className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" /> Print
            </button>
            <button type="button" className="inline-flex h-10 items-center gap-1.5 rounded-full border border-mr-line bg-mr-surface px-3.5 text-[13px] font-medium text-mr-text transition-colors hover:bg-mr-surface-2 disabled:pointer-events-none disabled:opacity-50" onClick={downloadExcel} disabled={filteredMembers.length === 0}>
              <Download className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" /> Excel
            </button>
            {canWrite && (
              <button type="button" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-mr-ink px-4 text-[13px] font-semibold text-white transition-colors hover:bg-mr-ink/90" onClick={handleOpenCreate}>
                <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" /> Add member
              </button>
            )}
          </div>
      </div>

      <MembersSummary summary={summary} />

      <section className="overflow-hidden rounded-panel border border-mr-line bg-mr-surface">
        <div className="border-b border-mr-line px-4 py-3.5 sm:px-5">
          <MembersToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filterType={filterType}
          onTypeChange={setFilterType}
          filterStatus={filterStatus}
          onStatusChange={setFilterStatus}
          statusOptions={STATUS_OPTIONS}
          filterKyc={filterKyc}
          onKycChange={setFilterKyc}
          filterTeam={filterTeam}
          onTeamChange={setFilterTeam}
          teams={uniqueTeams}
          resultCount={filteredMembers.length}
          sortOrder={sortOrder}
          onToggleSort={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
          onClear={() => {
            setSearchQuery(''); setFilterType('ALL'); setFilterStatus('ALL');
            setFilterTeam('ALL'); setFilterKyc('ALL');
          }}
          />
        </div>

        {/* ── Member list ── */}
        {loading ? (
          <div className="space-y-3 p-5 sm:p-6">
            {[0, 1, 2, 3, 4].map((i) => <SkeletonBlock key={i} className="h-14 w-full" />)}
          </div>
        ) : filteredMembers.length === 0 ? (
          <EmptyState
            icon={Users}
            title={members.length === 0 ? 'No members registered yet' : 'No members match your filters'}
            description={members.length === 0
              ? 'Add your first client, farmer or member to start building the register.'
              : 'Try a different search term, or clear the filters to see everyone.'}
            action={canWrite && members.length === 0 ? (
              <button type="button" className={PRIMARY_BTN} onClick={handleOpenCreate}>
                <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" /> Add member
              </button>
            ) : null}
          />
        ) : (
          <>
            <MembersTable
              members={filteredMembers}
              selection={selection}
              visibleIds={visibleIds}
              sortOrder={sortOrder}
              onToggleSort={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
              permissions={memberPermissions}
              actions={memberActions}
            />
            <MembersMobileList
              members={filteredMembers}
              selection={selection}
              permissions={memberPermissions}
              actions={memberActions}
            />
          </>
        )}
      </section>

      <Dialog open={quickCreateOpen} onOpenChange={(open) => { setQuickCreateOpen(open); if (!open) resetQuickCreateForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Add New Member</DialogTitle>
            <DialogDescription className="text-sm">Quick add with basic member details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleQuickCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="quick-member-category">Category</Label>
              <Select
                value={quickCreateForm.member_type || 'none'}
                onValueChange={(v) => setQuickCreateForm((previous) => ({ ...previous, member_type: v === 'none' ? '' : v }))}
              >
                <SelectTrigger id="quick-member-category" className="h-9 text-xs"><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not Specified</SelectItem>
                  {quickCreateCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.slug}>
                      <span className="flex items-center gap-2">
                        {(() => { const I = CATEGORY_ICON_MAP[cat.icon] || Tag; return <I className="w-3.5 h-3.5" />; })()}
                        {cat.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quick-member-name">Member Name</Label>
              <Input
                id="quick-member-name"
                placeholder="Enter member name"
                value={quickCreateForm.full_name}
                onChange={(event) => setQuickCreateForm((previous) => ({ ...previous, full_name: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quick-member-phone">Contact Number</Label>
              <Input
                id="quick-member-phone"
                placeholder="10-digit phone number"
                value={quickCreateForm.phone}
                onChange={(event) => setQuickCreateForm((previous) => ({ ...previous, phone: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quick-member-role">Role</Label>
              <Select
                value={quickCreateForm.role || 'none'}
                onValueChange={(v) => setQuickCreateForm((previous) => ({ ...previous, role: v === 'none' ? '' : v }))}
              >
                <SelectTrigger id="quick-member-role" className="h-9 text-xs"><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not Specified</SelectItem>
                  {ROLE_OPTIONS.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setQuickCreateOpen(false)} disabled={quickCreateSubmitting}>Cancel</Button>
              <Button type="submit" size="sm" disabled={quickCreateSubmitting}>
                {quickCreateSubmitting ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving...</> : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {memberDialogJsx}
      <SiteRegistrationDialog
        open={siteRegistrationOpen}
        onOpenChange={setSiteRegistrationOpen}
        member={siteRegistrationMember}
        sites={sites}
        currentSite={currentSite}
        onComplete={refreshMembers}
      />
    </div>
  );
};

export default Clients;
