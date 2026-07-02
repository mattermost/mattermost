import React from 'react';
import Link from '@docusaurus/Link';
import styles from './styles.module.css';

// Compliance / authorization status badge for framework pages
// (FedRAMP, DoD IL, DISA STIG, HIPAA, FINRA, CMMC, Common Criteria…).
//
// Status semantics:
//   authorized   — formally authorized / certified; ATO or equivalent in place.
//   in-process   — actively pursuing authorization; documented gap exists.
//   roadmap      — committed for future authorization; no work in flight yet.
//   not-pursued  — not on the roadmap; framework documented for reference only.
//
// Usage:
//   <AttestationStatus framework="FedRAMP Moderate" status="in-process" />
//   <AttestationStatus framework="FIPS 140-3" status="authorized" certificate="CMVP #4735" />
//   <AttestationStatus framework="Common Criteria" status="not-pursued" />

type Status = 'authorized' | 'in-process' | 'roadmap' | 'not-pursued';

const STATUS_LABEL: Record<Status, string> = {
  'authorized': 'Authorized',
  'in-process': 'In Process',
  'roadmap': 'Roadmap',
  'not-pursued': 'Not Pursued',
};

const STATUS_CLASS: Record<Status, string> = {
  'authorized': 'authorized',
  'in-process': 'inProcess',
  'roadmap': 'roadmap',
  'not-pursued': 'notPursued',
};

const KNOWN_STATUSES = Object.keys(STATUS_LABEL) as Status[];

export default function AttestationStatus({
  framework,
  status,
  certificate,
  asOf,
  detailsHref,
}: {
  framework: string;
  status: string;
  certificate?: string;
  asOf?: string;
  detailsHref?: string;
}) {
  if (!framework) {
    return (
      <aside className={`${styles.box} ${styles.unknown}`} role="note">
        <code>&lt;AttestationStatus/&gt;</code> requires a <code>framework</code> prop.
      </aside>
    );
  }
  if (!(KNOWN_STATUSES as string[]).includes(status)) {
    return (
      <aside className={`${styles.box} ${styles.unknown}`} role="note">
        Unknown attestation status: <code>{status}</code>. Valid:{' '}
        <code>{KNOWN_STATUSES.join(', ')}</code>.
      </aside>
    );
  }

  const s = status as Status;
  return (
    <aside
      className={`${styles.box} ${styles[STATUS_CLASS[s]]}`}
      role="note"
      aria-label={`${framework} attestation status`}
    >
      <div className={styles.header}>
        <span className={styles.framework}>{framework}</span>
        <span className={styles.status} data-status={s}>{STATUS_LABEL[s]}</span>
      </div>
      {(certificate || asOf || detailsHref) && (
        <div className={styles.meta}>
          {certificate && <span><strong>Certificate:</strong> {certificate}</span>}
          {asOf && <span><strong>As of:</strong> {asOf}</span>}
          {detailsHref && <Link href={detailsHref}>Attestation details</Link>}
        </div>
      )}
    </aside>
  );
}
