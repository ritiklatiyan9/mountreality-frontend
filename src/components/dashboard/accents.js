/* ── Accents ─────────────────────────────────────────────────────────
   Five brand tones, each with a soft tint for backgrounds and a darker
   ink for text/icons on that tint. Sections pick a tone by meaning —
   aqua/lime for money coming in and healthy states, coral for money
   going out, amber for attention, blue for neutral information. */
export const ACCENT = {
  blue:  { chip: 'bg-mr-blue-soft text-mr-blue', solid: 'bg-mr-blue', text: 'text-mr-blue', ring: 'ring-mr-blue/20' },
  aqua:  { chip: 'bg-mr-aqua-soft text-mr-aqua-ink', solid: 'bg-mr-aqua', text: 'text-mr-aqua-ink', ring: 'ring-mr-aqua-ink/20' },
  lime:  { chip: 'bg-mr-lime-soft text-mr-lime-ink', solid: 'bg-mr-lime', text: 'text-mr-lime-ink', ring: 'ring-mr-lime-ink/20' },
  amber: { chip: 'bg-mr-amber-soft text-mr-amber-ink', solid: 'bg-mr-amber', text: 'text-mr-amber-ink', ring: 'ring-mr-amber-ink/20' },
  coral: { chip: 'bg-mr-coral-soft text-mr-coral-ink', solid: 'bg-mr-coral', text: 'text-mr-coral-ink', ring: 'ring-mr-coral-ink/20' },
  ink:   { chip: 'bg-mr-ink text-white', solid: 'bg-mr-ink', text: 'text-mr-text', ring: 'ring-mr-line-strong' },
};

/* Stable tone for a module key, so the same module reads the same colour
   everywhere it appears (workflow strip, activity table, breakdown bar). */
const TONE_RAMP = ['blue', 'aqua', 'lime', 'amber', 'coral'];
export const toneFor = (key = '') => {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) % 997;
  return TONE_RAMP[hash % TONE_RAMP.length];
};
