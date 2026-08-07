import { useEffect } from 'react';
import { Link, useLocation, Navigate } from 'react-router-dom';
import { ArrowUpRight, Mail, MapPin } from 'lucide-react';
import PublicNav from '../components/ui/public-nav';
import { BTN_INK, LINK_SM } from '../components/landing/layout';
import SiteFooter from '../components/SiteFooter';

/**
 * Company details used across every policy document and the contact page.
 * TODO(owner): replace with the registered entity's details before going live —
 * Razorpay verifies these against your merchant account.
 */
const COMPANY = {
  legalName: 'Mount Reality',
  email: 'support@mountreality.in',
  phone: '+91 98XXX XXXXX',
  address: 'Bhopal, Madhya Pradesh, India',
  jurisdiction: 'Bhopal, Madhya Pradesh',
  refundWindowDays: 7,
};

const LAST_UPDATED = '25 July 2026';

/**
 * Every public policy document, rendered by one page. The copy is standard SaaS
 * boilerplate written against what this product actually does — have it reviewed
 * by a lawyer and fill in COMPANY above before publishing.
 */
const DOCS = {
  terms: {
    title: 'Terms of Service',
    intro: `These terms govern your use of the ${COMPANY.legalName} accounting platform. By creating an account you agree to them.`,
    sections: [
      {
        h: '1. Your account',
        p: [
          'You must provide accurate company and contact details when signing up. The person who signs up becomes the Super Admin of the organisation and is responsible for every user they invite.',
          'You are responsible for keeping login credentials confidential. Notify us immediately if you suspect unauthorised access.',
        ],
      },
      {
        h: '2. Subscriptions and billing',
        p: [
          'Access is sold as a monthly or yearly subscription. Plans differ only by the number of sites you can manage — all features are included on every plan.',
          'Fees are charged in advance through Razorpay. Prices are shown in INR and are exclusive of applicable taxes unless stated otherwise.',
          'A subscription stays active for the period paid for. If a payment is not completed, access to non-billing features is suspended until it is.',
        ],
      },
      {
        h: '3. Your data',
        p: [
          'You own the financial records, documents and other content you enter into the platform. We process it only to operate the service for you.',
          'You may export your data at any time from the reports and export tools built into the product.',
        ],
      },
      {
        h: '4. Acceptable use',
        p: [
          'Do not use the platform to store unlawful content, attempt to breach its security, resell access without our written consent, or interfere with other customers.',
          'We may suspend an account that is being used in breach of these terms, with notice where practicable.',
        ],
      },
      {
        h: '5. Availability and support',
        p: [
          'We work to keep the service available continuously, but do not guarantee uninterrupted access. Planned maintenance is announced in advance where possible.',
          `Support is available by email at ${COMPANY.email}.`,
        ],
      },
      {
        h: '6. Liability',
        p: [
          'The platform is a record-keeping tool. It does not provide accounting, tax or legal advice, and you remain responsible for the accuracy of your filings.',
          'To the extent permitted by law, our total liability in any 12-month period is limited to the subscription fees you paid in that period.',
        ],
      },
      {
        h: '7. Changes and governing law',
        p: [
          'We may update these terms; material changes will be notified by email or in-product. Continuing to use the service after a change means you accept it.',
          `These terms are governed by the laws of India, and the courts at ${COMPANY.jurisdiction} have exclusive jurisdiction.`,
        ],
      },
    ],
  },

  privacy: {
    title: 'Privacy Policy',
    intro: 'This policy explains what we collect, why we collect it, and the choices you have.',
    sections: [
      {
        h: 'What we collect',
        p: [
          'Account data: your name, work email, phone number, company name and role. If you sign in with Google, we receive your name, email address and profile photo from Google.',
          'Business data: the ledgers, plots, clients, vendors, payments and documents you enter into the platform.',
          'Technical data: IP address, browser type and session timestamps, recorded so admins can review login activity.',
        ],
      },
      {
        h: 'Why we use it',
        p: [
          'To provide and secure the service, to process subscription payments, to provide support, and to send service notices about your account.',
          'We do not sell your data and we do not use your business records for advertising.',
        ],
      },
      {
        h: 'Who we share it with',
        p: [
          'Razorpay for payment processing, Google for optional sign-in, and our cloud hosting and email providers. Each receives only what it needs to perform its function.',
          'We disclose data to authorities only where legally required.',
        ],
      },
      {
        h: 'Security',
        p: [
          'Passwords are stored hashed, never in plain text. Sessions use signed tokens that expire, and access to each module is controlled by role-based permissions set by your admin.',
        ],
      },
      {
        h: 'Retention and your rights',
        p: [
          'We keep your data while your account is active and for a reasonable period afterwards to meet legal and accounting obligations.',
          `You may request access, correction or deletion of your personal data by writing to ${COMPANY.email}. We respond within 30 days.`,
        ],
      },
      {
        h: 'Cookies',
        p: [
          'We use only essential browser storage — to keep you signed in and remember your selected site. There are no advertising or third-party tracking cookies.',
        ],
      },
    ],
  },

  refund: {
    title: 'Refund & Cancellation Policy',
    intro: 'How cancellations and refunds work for subscription payments.',
    sections: [
      {
        h: 'Cancelling',
        p: [
          'You can cancel at any time. Your subscription stays active until the end of the period you have already paid for, and it is not renewed after that.',
          'Cancelling does not delete your data — you keep access to export it until the paid period ends.',
        ],
      },
      {
        h: 'Refunds',
        p: [
          `If you are not satisfied, write to ${COMPANY.email} within ${COMPANY.refundWindowDays} days of your first payment for a full refund of that payment.`,
          'Renewal payments and partially used periods are not refundable, except where a payment was charged in error or the service was unavailable for a prolonged period due to a fault on our side.',
        ],
      },
      {
        h: 'How refunds are paid',
        p: [
          'Approved refunds are returned through Razorpay to the original payment method. Banks typically credit them within 5–7 working days of approval.',
        ],
      },
      {
        h: 'Failed or duplicate payments',
        p: [
          'If you were charged twice or a payment failed but money was debited, send us the Razorpay payment ID and we will trace and return it.',
        ],
      },
    ],
  },

  shipping: {
    title: 'Delivery Policy',
    intro: 'This is a software service — nothing is physically shipped.',
    sections: [
      {
        h: 'Service delivery',
        p: [
          'Access is delivered electronically. Your workspace is created the moment you sign up, and every feature of your plan unlocks immediately once payment is confirmed by Razorpay.',
          'A payment receipt and subscription confirmation are sent to the email address on your account.',
        ],
      },
      {
        h: 'If access does not activate',
        p: [
          `If a payment succeeds but your plan does not activate within a few minutes, contact ${COMPANY.email} with your Razorpay payment ID and we will activate it manually.`,
        ],
      },
    ],
  },
};

const DocPage = ({ doc }) => (
  <article className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
    <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-primary">Legal</p>
    <h1 className="mt-3 text-[34px] font-semibold leading-tight tracking-[-0.03em] text-slate-900 sm:text-[40px]">
      {doc.title}
    </h1>
    <p className="mt-4 text-[15.5px] leading-relaxed text-slate-500">{doc.intro}</p>
    <p className="mt-4 text-[12.5px] text-slate-400">Last updated {LAST_UPDATED}</p>

    <div className="mt-10 space-y-9">
      {doc.sections.map((s) => (
        <section key={s.h}>
          <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-slate-900">{s.h}</h2>
          <div className="mt-2.5 space-y-3">
            {s.p.map((para) => (
              <p key={para} className="text-[15px] leading-[1.7] text-slate-600">{para}</p>
            ))}
          </div>
        </section>
      ))}
    </div>

    <div className="mt-12 rounded-2xl bg-slate-50 p-6 ring-1 ring-slate-200">
      <p className="text-[14px] font-semibold text-slate-900">Questions about this policy?</p>
      <p className="mt-1 text-[14px] text-slate-500">
        Write to{' '}
        <a href={`mailto:${COMPANY.email}`} className="font-medium text-primary underline-offset-4 hover:underline">
          {COMPANY.email}
        </a>{' '}
        or see our <Link to="/contact" className="font-medium text-primary underline-offset-4 hover:underline">contact page</Link>.
      </p>
    </div>
  </article>
);

/* ── Contact ─────────────────────────────────────────────────────────
   No form. There is no contact endpoint in this repo — no /api/contact,
   no lead route, no mail transport — so a form here would collect a
   message and drop it. An email link that demonstrably works beats a
   form that silently does not.

   The phone tile is gone too. COMPANY.phone is the placeholder
   '+91 98XXX XXXXX', which the old page turned into a live
   `tel:+9198XXXXXXXX` link that dials nothing. Showing no number is
   better than shipping a broken one; put a real number in COMPANY and
   the tile below can come back in a minute.

   Everything rendered here is verifiable: the address is the
   jurisdiction already stated in the Terms, and the response-time line
   promises nothing that cannot be kept. ── */

const CONTACT_ROUTES = [
  {
    label: 'Sales & plans',
    body: 'Which plan fits your number of sites, what migration from your current sheets looks like, and anything about billing before you pay.',
  },
  {
    label: 'Support',
    body: 'Something not behaving as it should, a figure you cannot trace, or help getting a new site set up on your books.',
  },
  {
    label: 'Billing & invoices',
    body: 'GST invoices, payment receipts, renewals, or changing the plan on an existing subscription.',
  },
];

const ContactPage = () => (
  <div className="w-full">
    <div className="mx-auto w-full max-w-[1120px] px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-16">
        {/* ── Left: the ask ── */}
        <div>
          <h1 className="text-[clamp(2rem,4vw,3rem)] font-semibold leading-[1.03] tracking-[-0.045em] text-mr-text">
            Talk to a person.
          </h1>
          <p className="mt-5 max-w-[52ch] text-[17px] leading-[1.5] tracking-[-0.01em] text-mr-muted">
            One address, read by the people who build MountReality. Tell us what you run — how many
            sites, roughly how many plots — and we will tell you honestly whether this fits.
          </p>

          <a
            href={`mailto:${COMPANY.email}`}
            className={`mt-8 ${BTN_INK}`}
          >
            <Mail className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            {COMPANY.email}
          </a>

          <p className="mt-4 text-[12px] text-mr-muted">
            We reply on working days, usually the same one. Please include your company name.
          </p>

          <dl className="mt-12 grid gap-px overflow-hidden rounded-panel border border-mr-line bg-mr-line">
            {CONTACT_ROUTES.map((route) => (
              <div key={route.label} className="bg-mr-surface p-5">
                <dt className="text-[15px] font-semibold tracking-[-0.01em] text-mr-text">{route.label}</dt>
                <dd className="mt-1.5 max-w-[62ch] text-[14px] leading-[1.6] text-mr-muted">{route.body}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* ── Right: where we are, and where to look first ── */}
        <aside className="lg:pt-2">
          <div className="rounded-panel border border-mr-line bg-mr-surface p-6">
            <p className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-mr-text">
              <MapPin className="h-4 w-4 text-mr-muted" strokeWidth={1.9} aria-hidden="true" />
              {COMPANY.legalName}
            </p>
            <p className="mt-2 text-[14px] leading-[1.6] text-mr-muted">{COMPANY.address}</p>
            <p className="mt-4 border-t border-mr-line pt-4 text-[12px] text-mr-muted">
              Agreements are governed by the courts of {COMPANY.jurisdiction}, as set out in the{' '}
              <Link to="/terms" className={LINK_SM}>Terms of Service</Link>.
            </p>
          </div>

          <div className="mt-5 rounded-panel border border-mr-line bg-mr-surface p-6">
            <p className="text-[15px] font-semibold tracking-[-0.01em] text-mr-text">Answered already</p>
            <ul className="mt-4 space-y-3">
              {[
                { to: '/pricing', label: 'Plans, yearly billing and what each one includes' },
                { to: '/refund', label: `Refunds — the ${COMPANY.refundWindowDays}-day window and how it works` },
                { to: '/terms', label: 'Terms of Service' },
                { to: '/privacy', label: 'How your data is handled' },
              ].map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="group flex items-start gap-2 text-[14px] leading-[1.5] text-mr-muted transition-colors hover:text-mr-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue focus-visible:ring-offset-2"
                  >
                    <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-mr-faint transition-colors group-hover:text-mr-blue" strokeWidth={1.9} aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-5 text-[12px] text-mr-muted">
            Already a customer? Sign in and use the in-app chat — it reaches us with your site and
            entry already attached.
          </p>
        </aside>
      </div>
    </div>
  </div>
);

/** One page for every legal document — /terms, /privacy, /refund, /shipping, /contact. */
export const Legal = () => {
  // One component behind five routes — the path segment picks the document.
  const docKey = useLocation().pathname.replace(/^\/|\/$/g, '');

  useEffect(() => { window.scrollTo(0, 0); }, [docKey]);

  if (docKey !== 'contact' && !DOCS[docKey]) return <Navigate to="/" replace />;

  return (
    <div className="auth-type mr-tech-field flex min-h-screen flex-col bg-mr-shell text-mr-text">
      <PublicNav />
      <main id="main" className="flex-1">
        {docKey === 'contact' ? <ContactPage /> : <DocPage doc={DOCS[docKey]} />}
      </main>
      <SiteFooter />
    </div>
  );
};

export default Legal;
