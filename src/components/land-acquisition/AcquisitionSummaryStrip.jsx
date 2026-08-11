import { money, dateLabel } from './landAcquisitionUtils';

export default function AcquisitionSummaryStrip({ acquisition }) {
  const facts = [
    { label: 'Agreed value', value: money(acquisition?.total_amount, true) },
    { label: 'Paid', value: money(acquisition?.total_paid, true) },
    { label: 'Outstanding', value: money(acquisition?.outstanding, true) },
    {
      label: 'Next payment',
      value: acquisition?.next_due_date ? dateLabel(acquisition.next_due_date) : 'No upcoming due',
    },
  ];
  return (
    <section className="grid gap-y-4 border-y border-mr-line py-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Acquisition financial summary">
      {facts.map((fact, index) => (
        <div key={fact.label} className={index ? 'min-w-0 border-l border-mr-line pl-5' : 'min-w-0'}>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-mr-faint">{fact.label}</p>
          <p className="mt-1 truncate text-[20px] font-semibold tracking-[-0.02em] text-mr-text">{fact.value}</p>
        </div>
      ))}
    </section>
  );
}

