import type { ReactNode } from 'react';
import type { DataClass, DatasetRecord, IntegrationStatus } from '../types';

export const DATA_CLASS_INFO: Record<DataClass, { cls: string; meaning: string }> = {
  OBSERVED: {
    cls: 'text-obs border-obs/40 bg-obs/10',
    meaning: 'Measured or imaged by an instrument, shown without reinterpretation.',
  },
  DERIVED: {
    cls: 'text-der border-der/40 bg-der/10',
    meaning: 'Computed from observed data (e.g. slope from elevation) or an interpretation by named authors.',
  },
  MODELLED: {
    cls: 'text-mod border-mod/40 bg-mod/10',
    meaning: 'Output of a numerical model, with its own uncertainty.',
  },
  SIMULATED: {
    cls: 'text-sim border-sim/40 bg-sim/10',
    meaning: 'Synthetic or hypothetical content created for demonstration. Not a Mars measurement.',
  },
};

export function ClassBadge({ value }: { value: DataClass }) {
  return (
    <span
      title={DATA_CLASS_INFO[value].meaning}
      className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-wider ${DATA_CLASS_INFO[value].cls}`}
    >
      {value}
    </span>
  );
}

const INTEGRATION_LABEL: Record<IntegrationStatus, { text: string; cls: string }> = {
  integrated: { text: 'Integrated', cls: 'text-obs' },
  'runtime-check': { text: 'Checked live in browser', cls: 'text-der' },
  'optional-file': { text: 'Optional file', cls: 'text-der' },
  candidate: { text: 'Candidate - not integrated', cls: 'text-mute' },
  demo: { text: 'Demonstration only', cls: 'text-sim' },
};

export function IntegrationTag({ value }: { value: IntegrationStatus }) {
  const t = INTEGRATION_LABEL[value];
  return <span className={`text-xs font-medium ${t.cls}`}>{t.text}</span>;
}

export function PageShell({
  title,
  intro,
  children,
  wide = false,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`mx-auto px-4 py-8 ${wide ? 'max-w-[1500px]' : 'max-w-5xl'}`}>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {intro && <div className="mt-2 max-w-3xl text-sm leading-relaxed text-mute">{intro}</div>}
      <div className="mt-6">{children}</div>
    </div>
  );
}

export function Callout({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'warn' | 'sim';
  title?: string;
  children: ReactNode;
}) {
  const cls =
    tone === 'sim'
      ? 'border-sim/40 bg-sim/10'
      : tone === 'warn'
        ? 'border-der/40 bg-der/10'
        : 'border-line bg-panel2';
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${cls}`} role={tone === 'info' ? undefined : 'note'}>
      {title && <div className="mb-1 font-semibold">{title}</div>}
      <div className="leading-relaxed text-ink/90">{children}</div>
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-md border border-line bg-panel2 px-3 py-2" title={hint}>
      <div className="label">{label}</div>
      <div className="mt-0.5 font-mono text-base tabular-nums">{value}</div>
    </div>
  );
}

export function DatasetDetails({ d }: { d: DatasetRecord }) {
  const rows: [string, string | null][] = [
    ['Identifier', d.identifier],
    ['Provider', d.provider],
    ['Instrument', d.instrument],
    ['Acquisition', d.acquisition],
    ['Resolution', d.resolution],
    ['Coverage', d.coverage],
    ['Coordinate system', d.crs],
    ['Processing', d.processing],
    ['License / terms', d.license],
    ['Attribution', d.attribution],
  ];
  return (
    <div className="space-y-3 text-sm">
      <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-[10rem_1fr]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-mute">{k}</dt>
            <dd className={v ? '' : 'italic text-mute'}>{v ?? 'not recorded'}</dd>
          </div>
        ))}
        <dt className="text-mute">Source</dt>
        <dd>
          {d.sourceUrl ? (
            <a href={d.sourceUrl} target="_blank" rel="noreferrer" className="break-all text-rust-soft underline">
              {d.sourceUrl}
            </a>
          ) : (
            <span className="italic text-mute">not applicable</span>
          )}
        </dd>
      </dl>
      <div>
        <div className="label mb-1">Limitations</div>
        <ul className="list-disc space-y-1 pl-5">
          {d.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </div>
      <div className="rounded border border-line bg-bg px-3 py-2 text-xs text-mute">
        <span className="font-semibold text-ink/80">What was verified: </span>
        {d.verification}
      </div>
    </div>
  );
}
