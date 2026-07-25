import mrLogo from '@/assets/mr-logo.svg';
import { cn } from '@/lib/utils';

/* ── Brand mark ──────────────────────────────────────────────────────
   The one place the product logo is sized and labelled. The mark is
   wider than it is tall, so `size` sets the height and the width follows
   from the artwork — never set both, or it distorts.

   Decorative by default: when a wordmark sits beside it the mark is
   redundant to a screen reader, so it carries an empty alt. Pass
   `alt` only where the mark stands alone as the link to home. ── */
const SIZES = {
  sm: 'h-6',
  md: 'h-7',
  lg: 'h-9',
};

export default function BrandMark({ size = 'md', alt = '', className }) {
  return (
    <img
      src={mrLogo}
      alt={alt}
      className={cn('w-auto shrink-0 object-contain', SIZES[size], className)}
    />
  );
}
