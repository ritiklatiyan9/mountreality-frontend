import api from './api';

// The complete KYC workflow is owned by the Accounts backend. Reusing the main
// client preserves the Accounts base URL, session header and token-refresh flow.
export const createSharedKycCase = (payload) =>
  api.post('/member-kyc/cases', payload).then((response) => response.data);

export const getSharedKycCase = (caseId) =>
  api.get(`/member-kyc/case/${caseId}`).then((response) => response.data);

export const updateSharedKycCustomer = (caseId, payload) =>
  api.patch(`/member-kyc/case/${caseId}/customer`, payload).then((response) => response.data);

export const uploadSharedKycDocument = (payload) =>
  api.post('/member-kyc/upload', payload, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then((response) => response.data);

export const getSharedKycDocument = (documentId) =>
  api.get(`/member-kyc/document/${documentId}`).then((response) => response.data);

export const retrySharedKycDocument = (documentId) =>
  api.post(`/member-kyc/document/${documentId}/retry`).then((response) => response.data);

export const getSharedKycAiPreview = (caseId) =>
  api.post(`/member-kyc/case/${caseId}/extract-preview`).then((response) => response.data);

export const verifySharedKycCase = (caseId, payload) =>
  api.post(`/member-kyc/case/${caseId}/verify`, payload).then((response) => response.data);

export default api;
