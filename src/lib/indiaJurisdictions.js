export const INDIA_JURISDICTIONS = Object.freeze([
  ['AN', 'Andaman and Nicobar Islands'],
  ['AP', 'Andhra Pradesh'],
  ['AR', 'Arunachal Pradesh'],
  ['AS', 'Assam'],
  ['BR', 'Bihar'],
  ['CH', 'Chandigarh'],
  ['CG', 'Chhattisgarh'],
  ['DH', 'Dadra and Nagar Haveli and Daman and Diu'],
  ['DL', 'Delhi'],
  ['GA', 'Goa'],
  ['GJ', 'Gujarat'],
  ['HR', 'Haryana'],
  ['HP', 'Himachal Pradesh'],
  ['JK', 'Jammu and Kashmir'],
  ['JH', 'Jharkhand'],
  ['KA', 'Karnataka'],
  ['KL', 'Kerala'],
  ['LA', 'Ladakh'],
  ['LD', 'Lakshadweep'],
  ['MP', 'Madhya Pradesh'],
  ['MH', 'Maharashtra'],
  ['MN', 'Manipur'],
  ['ML', 'Meghalaya'],
  ['MZ', 'Mizoram'],
  ['NL', 'Nagaland'],
  ['OD', 'Odisha'],
  ['PY', 'Puducherry'],
  ['PB', 'Punjab'],
  ['RJ', 'Rajasthan'],
  ['SK', 'Sikkim'],
  ['TN', 'Tamil Nadu'],
  ['TS', 'Telangana'],
  ['TR', 'Tripura'],
  ['UP', 'Uttar Pradesh'],
  ['UK', 'Uttarakhand'],
  ['WB', 'West Bengal'],
]);

const EXTRA_ALIASES = Object.freeze({
  CT: 'CG',
  DN: 'DH',
  DD: 'DH',
  'NCT OF DELHI': 'DL',
  OR: 'OD',
  ORISSA: 'OD',
  PONDICHERRY: 'PY',
  TG: 'TS',
  UT: 'UK',
  UTTARANCHAL: 'UK',
});

const normalize = (value) => String(value || '')
  .trim()
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, ' ')
  .trim();

const CODE_BY_VALUE = new Map();
INDIA_JURISDICTIONS.forEach(([code, name]) => {
  CODE_BY_VALUE.set(normalize(code), code);
  CODE_BY_VALUE.set(normalize(name), code);
});
Object.entries(EXTRA_ALIASES).forEach(([alias, code]) => CODE_BY_VALUE.set(normalize(alias), code));

export const indiaJurisdictionCode = (value) => CODE_BY_VALUE.get(normalize(value)) || '';

export const indiaJurisdictionName = (value) => {
  const code = indiaJurisdictionCode(value);
  return INDIA_JURISDICTIONS.find(([candidate]) => candidate === code)?.[1] || '';
};

export const rulesetMatchesJurisdiction = (ruleset, state) => {
  const country = normalize(ruleset?.jurisdiction_country_code);
  const siteCode = indiaJurisdictionCode(state);
  const rulesetCode = indiaJurisdictionCode(ruleset?.jurisdiction_state_code);
  return Boolean(['IN', 'INDIA'].includes(country) && siteCode && rulesetCode && siteCode === rulesetCode);
};
