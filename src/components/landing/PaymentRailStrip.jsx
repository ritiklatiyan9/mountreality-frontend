import upiLogo from '../../assets/upi/upi.svg';
import bhimLogo from '../../assets/upi/bhim.svg';
import gpayLogo from '../../assets/upi/gpay.svg';
import phonepeLogo from '../../assets/upi/phonepe.svg';
import paytmLogo from '../../assets/upi/paytm.svg';
import amazonpayLogo from '../../assets/upi/amazonpay.svg';

/* ── Payment-rail strip ──────────────────────────────────────────────
   This is the landing page's logo wall, and it is deliberately NOT a
   "trusted by" customer wall. MountReality has no public customer list,
   and putting real companies' marks under a trust claim would be a
   fabricated endorsement — the same class of problem as the invented
   ₹ figures and the "start free" line that came off this page.

   What it shows instead is true and checkable: the payment rails the
   product actually collects through. The six marks are the local SVGs
   already bundled for the QR screens (src/assets/upi/), and Razorpay is
   the real gateway — order creation plus HMAC signature verification in
   billing.controller.js.

   Edge masks fade both ends so the row reads as continuing past the
   viewport, which is where the visual texture comes from rather than
   from padding it out with logos we do not have. ── */

const RAILS = [
  { name: 'BHIM UPI', src: bhimLogo, h: 'h-5' },
  { name: 'Google Pay', src: gpayLogo, h: 'h-[22px]' },
  { name: 'PhonePe', src: phonepeLogo, h: 'h-5' },
  { name: 'Paytm', src: paytmLogo, h: 'h-[18px]' },
  { name: 'Amazon Pay', src: amazonpayLogo, h: 'h-5' },
];

const EDGE_FADE = {
  maskImage: 'linear-gradient(to right, transparent, black 12%, black 88%, transparent)',
  WebkitMaskImage: 'linear-gradient(to right, transparent, black 12%, black 88%, transparent)',
};

export default function PaymentRailStrip() {
  return (
    <section aria-labelledby="mr-rails" className="w-full border-y border-mr-line bg-mr-surface py-14 sm:py-16">
      <p id="mr-rails" className="px-5 text-center text-[12px] font-semibold uppercase tracking-[0.14em] text-mr-muted">
        Payment methods supported
      </p>
      <p className="mx-auto mt-3 max-w-[62ch] px-5 text-center text-[12px] text-mr-muted">
        Buyers can pay a plot instalment from any UPI app. Your MountReality subscription is charged
        by Razorpay.
      </p>

      {/* data-native-scroll opts this rail out of the page's eased wheel
          scrolling, so a horizontal drag here is not hijacked. */}
      <div className="mr-rail mt-9 overflow-x-auto" data-native-scroll style={EDGE_FADE}>
        <ul className="flex min-w-max items-center justify-start gap-x-10 px-5 sm:justify-center sm:gap-x-14 sm:px-8">
          <li className="shrink-0">
            <img
              src={upiLogo}
              alt="UPI"
              draggable="false"
              className="h-6 w-auto select-none opacity-60 grayscale transition-all duration-200 hover:opacity-100 hover:grayscale-0"
            />
          </li>
          {RAILS.map((rail) => (
            <li key={rail.name} className="shrink-0">
              <img
                src={rail.src}
                alt={rail.name}
                title={rail.name}
                draggable="false"
                className={`${rail.h} w-auto select-none opacity-60 grayscale transition-all duration-200 hover:opacity-100 hover:grayscale-0`}
              />
            </li>
          ))}
          <li className="shrink-0 text-[15px] font-semibold tracking-[-0.01em] text-mr-muted transition-colors duration-200 hover:text-mr-text">
            Razorpay
          </li>
        </ul>
      </div>
    </section>
  );
}
