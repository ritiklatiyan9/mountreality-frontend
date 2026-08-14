const SHAPE_TERMS = {
  PLOTTED_DEVELOPMENT: {
    singular: 'Plot',
    plural: 'Plots',
    numberLabel: 'Plot No.',
    paymentsTitle: 'Plot Payments',
    registryTitle: 'Plot Registries',
    blockLabel: 'Block',
  },
  APARTMENT: {
    singular: 'Unit',
    plural: 'Units',
    numberLabel: 'Unit No.',
    paymentsTitle: 'Unit Payments',
    registryTitle: 'Unit Registries',
    blockLabel: 'Tower / Block',
  },
  COMMERCIAL: {
    singular: 'Commercial unit',
    plural: 'Commercial units',
    numberLabel: 'Unit No.',
    paymentsTitle: 'Commercial Payments',
    registryTitle: 'Commercial Registries',
    blockLabel: 'Block / Wing',
  },
  MIXED_USE: {
    singular: 'Property',
    plural: 'Properties',
    numberLabel: 'Property No.',
    paymentsTitle: 'Property Payments',
    registryTitle: 'Property Registries',
    blockLabel: 'Block / Tower / Section',
  },
};

export const PROPERTY_TYPE_OPTIONS = Object.freeze([
  { value: 'PLOT', label: 'Plot', plural: 'Plots', numberLabel: 'Plot No.', blockLabel: 'Block / Sector' },
  { value: 'APARTMENT', label: 'Apartment', plural: 'Apartments', numberLabel: 'Apartment No.', blockLabel: 'Tower / Block' },
  { value: 'SHOP', label: 'Shop', plural: 'Shops', numberLabel: 'Shop No.', blockLabel: 'Block / Market' },
  { value: 'OFFICE', label: 'Office', plural: 'Offices', numberLabel: 'Office No.', blockLabel: 'Building / Floor' },
  { value: 'VILLA', label: 'Villa', plural: 'Villas', numberLabel: 'Villa No.', blockLabel: 'Block / Sector' },
  { value: 'OTHER', label: 'Other property', plural: 'Other properties', numberLabel: 'Property No.', blockLabel: 'Section / Location' },
]);

const PROPERTY_TYPES_BY_SHAPE = Object.freeze({
  PLOTTED_DEVELOPMENT: ['PLOT'],
  APARTMENT: ['APARTMENT'],
  COMMERCIAL: ['SHOP', 'OFFICE'],
  MIXED_USE: PROPERTY_TYPE_OPTIONS.map((option) => option.value),
});

export function getPropertyTypeOptions(shape) {
  const allowed = PROPERTY_TYPES_BY_SHAPE[String(shape || '').trim().toUpperCase()]
    || PROPERTY_TYPES_BY_SHAPE.PLOTTED_DEVELOPMENT;
  return PROPERTY_TYPE_OPTIONS.filter((option) => allowed.includes(option.value));
}

export function getDefaultPropertyType(shape) {
  const normalizedShape = String(shape || '').trim().toUpperCase();
  if (normalizedShape === 'MIXED_USE') return '';
  return getPropertyTypeOptions(normalizedShape)[0]?.value || 'PLOT';
}

export function getPropertyTypeTerminology(propertyType, fallback) {
  const option = PROPERTY_TYPE_OPTIONS.find(({ value }) => value === String(propertyType || '').trim().toUpperCase());
  if (!option) return { ...fallback, propertyType: 'OTHER' };
  return {
    ...fallback,
    singular: option.label,
    plural: option.plural,
    numberLabel: option.numberLabel,
    blockLabel: option.blockLabel,
    propertyType: option.value,
  };
}

const titleCase = (value) => String(value || '')
  .trim()
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

export function getPropertyTerminology(sitePolicy) {
  const shape = String(sitePolicy?.profile?.project_shape || '').trim().toUpperCase();
  const configuredUnit = titleCase(sitePolicy?.terminology?.inventory_unit);
  const base = SHAPE_TERMS[shape] || SHAPE_TERMS.PLOTTED_DEVELOPMENT;

  // The operating profile wins over legacy terminology saved before profile-
  // aware inventory existed. This keeps already active Sites migration-safe.
  if (SHAPE_TERMS[shape] || !configuredUnit) {
    return { ...base, shape, isMixedUse: shape === 'MIXED_USE' };
  }

  const plural = configuredUnit.toLowerCase().endsWith('s')
    ? configuredUnit
    : `${configuredUnit}s`;

  return {
    ...base,
    shape,
    singular: configuredUnit,
    plural,
    numberLabel: `${configuredUnit} No.`,
    paymentsTitle: `${configuredUnit} Payments`,
    registryTitle: `${configuredUnit} Registries`,
    isMixedUse: false,
  };
}

export function unitCountLabel(count, terminology) {
  const total = Number(count || 0);
  return `${total} ${total === 1 ? terminology.singular.toLowerCase() : terminology.plural.toLowerCase()}`;
}
