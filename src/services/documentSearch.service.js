import api from '../api/api';

export const DOCUMENT_CATEGORIES = [
  { value: 'KHATAUNI', label: 'Khatauni', description: 'Land ownership and record extracts' },
  { value: 'SALE_DEED', label: 'Sale deed', description: 'Executed property sale deeds' },
  { value: 'AGREEMENT', label: 'Agreement', description: 'Property and commercial agreements' },
  { value: 'REGISTRY', label: 'Registry', description: 'Registration and conveyance records' },
  { value: 'MAP', label: 'Map', description: 'Site, plot, and boundary maps' },
  { value: 'OTHER', label: 'Other', description: 'Other searchable records' },
];

export const DOCUMENT_ACCEPT = '.jpg,.jpeg,.png,.webp,.pdf,.doc,.docx';
export const DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;

export const documentErrorMessage = (error, fallback = 'Something went wrong. Please try again.') => {
  if (error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError') return '';
  if (!error?.response && error?.message === 'Network Error') {
    return 'The document service is not reachable. Check your connection and try again.';
  }
  return error?.response?.data?.message || error?.message || fallback;
};

export const searchDocuments = async ({
  siteId, query = '', category = 'ALL', from = '', to = '', expiring = false,
  offset = 0, limit = 24, signal,
} = {}) => {
  const params = { site_id: siteId, offset, limit };
  if (query.trim()) params.q = query.trim();
  if (category !== 'ALL') params.category = category;
  if (from) params.from = from;
  if (to) params.to = to;
  if (expiring) params.expiring = 30;

  const { data } = await api.get('/documents', { params, signal });
  const documents = Array.isArray(data?.documents) ? data.documents : [];
  const total = Number(data?.total ?? documents.length) || 0;
  return {
    documents,
    total,
    summary: {
      total,
      searchable: Number(data?.summary?.searchable || 0),
      processing: Number(data?.summary?.processing || 0),
      failed: Number(data?.summary?.failed || 0),
      expiring: Number(data?.summary?.expiring || 0),
    },
    hasMore: Boolean(data?.has_more ?? (offset + documents.length < total)),
  };
};

export const uploadDocument = async ({
  siteId, file, category, title, metadata, docDate, expiryDate, onProgress, signal,
}) => {
  const form = new FormData();
  form.append('site_id', String(siteId));
  form.append('file', file);
  form.append('category', category);
  form.append('title', title);
  form.append('metadata', JSON.stringify(metadata || {}));
  if (docDate) form.append('doc_date', docDate);
  if (expiryDate) form.append('expiry_date', expiryDate);

  // Do not set Content-Type manually: the browser must add the multipart boundary.
  const { data } = await api.post('/documents', form, {
    signal,
    onUploadProgress: (event) => {
      const total = event.total || file.size || 1;
      onProgress?.(Math.min(100, Math.round((event.loaded / total) * 100)));
    },
  });
  return data;
};

export const updateDocument = async (id, siteId, changes) => {
  const { data } = await api.patch(`/documents/${id}`, { ...changes, site_id: siteId });
  return data;
};

export const restartDocumentOcr = async (id, siteId) => {
  const { data } = await api.post(`/documents/${id}/retry-ocr`, { site_id: siteId });
  return data;
};

export const removeDocument = async (id, siteId) => {
  const { data } = await api.delete(`/documents/${id}`, { params: { site_id: siteId } });
  return data;
};

export const listUnassignedDocuments = async ({ offset = 0, limit = 24, signal } = {}) => {
  const { data } = await api.get('/documents/unassigned', {
    params: { offset, limit },
    signal,
  });
  const documents = Array.isArray(data?.documents) ? data.documents : [];
  const total = Number(data?.total ?? documents.length) || 0;
  return {
    documents,
    total,
    hasMore: Boolean(data?.has_more ?? (offset + documents.length < total)),
  };
};

export const assignUnassignedDocument = async (id, siteId) => {
  const { data } = await api.patch(`/documents/unassigned/${id}/assign`, { site_id: siteId });
  return data;
};
