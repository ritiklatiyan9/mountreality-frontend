export const KYC_DOC_FIELDS = [
  { key: 'aadhar_front_url', label: 'Aadhaar front', short: 'Aadhaar', ocrType: 'AADHAAR', description: 'Identity and address', accept: 'image/jpeg,image/png,image/webp,application/pdf' },
  { key: 'aadhar_back_url', label: 'Aadhaar back', short: 'Address', ocrType: 'AADHAAR', description: 'Address verification', accept: 'image/jpeg,image/png,image/webp,application/pdf' },
  { key: 'pan_card_url', label: 'PAN card', short: 'PAN', ocrType: 'PAN', description: 'Tax identity', accept: 'image/jpeg,image/png,image/webp,application/pdf' },
  { key: 'voter_id_url', label: 'Voter ID', short: 'Voter ID', ocrType: 'VOTER_ID', description: 'Elector identity', accept: 'image/jpeg,image/png,image/webp,application/pdf' },
  { key: 'passport_url', label: 'Passport', short: 'Passport', ocrType: 'PASSPORT', description: 'Passport details', accept: 'image/jpeg,image/png,image/webp,application/pdf' },
  { key: 'driving_license_url', label: 'Driving licence', short: 'Licence', ocrType: 'DL', description: 'Licence identity', accept: 'image/jpeg,image/png,image/webp,application/pdf' },
  { key: 'cheque_url', label: 'Cancelled cheque', short: 'Cheque', ocrType: 'CHEQUE', description: 'Bank details', accept: 'image/jpeg,image/png,image/webp,application/pdf' },
  { key: 'other_kyc_url', label: 'Filled KYC form', short: 'KYC form', ocrType: 'KYC_FORM', description: 'Read the complete form', accept: 'image/jpeg,image/png,image/webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx' },
];

// Compact Booking-style timeline used by the shared KYC workspace. Aadhaar is
// intentionally one step with two required sides, while the legacy field list
// above remains unchanged for member create/edit payload compatibility.
export const KYC_WORKSPACE_STEPS = [
  {
    key: 'photo', label: 'Customer photo', short: 'Photo', ocrType: 'PHOTO',
    description: 'Profile photograph', memberFields: ['photo'], requiredCount: 1,
    accept: 'image/jpeg,image/png,image/webp', photo: true,
  },
  {
    key: 'aadhaar', label: 'Aadhaar card', short: 'Aadhaar', ocrType: 'AADHAAR',
    description: 'Front and back are compulsory',
    memberFields: ['aadhar_front_url', 'aadhar_back_url'], requiredCount: 2, required: true,
    sideLabels: ['Front side', 'Back side'],
    accept: 'image/jpeg,image/png,image/webp,application/pdf',
  },
  {
    key: 'pan_card_url', label: 'PAN card', short: 'PAN', ocrType: 'PAN',
    description: 'Tax identity', memberFields: ['pan_card_url'], requiredCount: 1,
    accept: 'image/jpeg,image/png,image/webp,application/pdf',
  },
  {
    key: 'voter_id_url', label: 'Voter ID', short: 'Voter ID', ocrType: 'VOTER_ID',
    description: 'Elector identity', memberFields: ['voter_id_url'], requiredCount: 1,
    accept: 'image/jpeg,image/png,image/webp,application/pdf',
  },
  {
    key: 'passport_url', label: 'Passport', short: 'Passport', ocrType: 'PASSPORT',
    description: 'Passport details', memberFields: ['passport_url'], requiredCount: 1,
    accept: 'image/jpeg,image/png,image/webp,application/pdf',
  },
  {
    key: 'driving_license_url', label: 'Driving licence', short: 'Licence', ocrType: 'DL',
    description: 'Licence identity', memberFields: ['driving_license_url'], requiredCount: 1,
    accept: 'image/jpeg,image/png,image/webp,application/pdf',
  },
  {
    key: 'cheque_url', label: 'Cancelled cheque', short: 'Cheque', ocrType: 'CHEQUE',
    description: 'Bank details', memberFields: ['cheque_url'], requiredCount: 1,
    accept: 'image/jpeg,image/png,image/webp,application/pdf',
  },
  {
    key: 'other_kyc_url', label: 'Filled KYC form', short: 'KYC form', ocrType: 'KYC_FORM',
    description: 'Read the complete form', memberFields: ['other_kyc_url'], requiredCount: 1,
    accept: 'image/jpeg,image/png,image/webp,application/pdf',
  },
];

export const EMPLOYEE_DOC_FIELDS = [
  { key: 'resume_url', label: 'Resume / CV', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
  { key: 'marksheet_10th_url', label: '10th marksheet', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
  { key: 'marksheet_12th_url', label: '12th marksheet', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
  { key: 'degree_certificate_url', label: 'Degree / diploma', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
  { key: 'experience_certificate_url', label: 'Experience certificate', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
  { key: 'offer_letter_url', label: 'Offer letter', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
  { key: 'other_certificate_url', label: 'Other certificate', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
];
