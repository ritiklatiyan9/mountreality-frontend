// UPI payment-app branding for QR screens — official logos bundled as local
// SVG assets (src/assets/upi/) so the outside-office display works offline.
import upiLogo from '../assets/upi/upi.svg';
import bhimLogo from '../assets/upi/bhim.svg';
import gpayLogo from '../assets/upi/gpay.svg';
import phonepeLogo from '../assets/upi/phonepe.svg';
import paytmLogo from '../assets/upi/paytm.svg';
import amazonpayLogo from '../assets/upi/amazonpay.svg';

// UPI logo overlaid on the QR centre. Safe to cover ~4% of the code when the
// QR is generated with errorCorrectionLevel 'H' (30% recovery).
export const QrUpiBadge = () => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
    <div className="bg-white rounded-xl px-2 py-1.5 shadow-md ring-1 ring-slate-200">
      <img src={upiLogo} alt="UPI" className="h-5 w-auto" draggable="false" />
    </div>
  </div>
);

const APPS = [
  { name: 'BHIM', src: bhimLogo, h: 'h-[18px]' },
  { name: 'Google Pay', src: gpayLogo, h: 'h-[20px]' },
  { name: 'PhonePe', src: phonepeLogo, h: 'h-[18px]' },
  { name: 'Paytm', src: paytmLogo, h: 'h-[16px]' },
  { name: 'Amazon Pay', src: amazonpayLogo, h: 'h-[18px]' },
];

const UpiBrandStrip = ({ className = '' }) => (
  <div className={`text-center ${className}`}>
    <div className="flex items-center justify-center gap-2">
      <img src={upiLogo} alt="UPI" className="h-4 w-auto" draggable="false" />
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        Scan and pay with any BHIM UPI app
      </p>
    </div>
    <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 select-none">
      {APPS.map((a) => (
        <img key={a.name} src={a.src} alt={a.name} title={a.name}
          className={`${a.h} w-auto`} draggable="false" />
      ))}
    </div>
  </div>
);

export default UpiBrandStrip;
