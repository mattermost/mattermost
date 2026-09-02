import React from 'react';
import Link from '@docusaurus/Link';
import styles from './styles.module.css';

// Per-page deployment-mode badge. Paired with <EditionAvailability/>.
//
// Canonical mode slugs:
//   cloud-shared      — Mattermost Cloud (multi-tenant)
//   cloud-dedicated   — Mattermost Cloud Dedicated (single-tenant managed)
//   cloud-government  — Mattermost Cloud Government (FedRAMP Moderate)
//   self-hosted       — customer-managed, internet-connected
//   air-gapped        — customer-managed, network-isolated
//   tactical-edge     — DDIL forward-deployed
//
// Usage:
//   <DeploymentAvailability modes="self-hosted,air-gapped,cloud-government" />

type Mode =
  | 'cloud-shared'
  | 'cloud-dedicated'
  | 'cloud-government'
  | 'self-hosted'
  | 'air-gapped'
  | 'tactical-edge';

const MODE_LABEL: Record<Mode, string> = {
  'cloud-shared': 'Cloud',
  'cloud-dedicated': 'Cloud Dedicated',
  'cloud-government': 'Cloud Government',
  'self-hosted': 'Self-Hosted',
  'air-gapped': 'Air-Gapped',
  'tactical-edge': 'Tactical Edge',
};

const KNOWN_MODES = Object.keys(MODE_LABEL) as Mode[];

function parseModes(value: string): {valid: Mode[]; invalid: string[]} {
  const valid: Mode[] = [];
  const invalid: string[] = [];
  for (const raw of value.split(',').map((s) => s.trim()).filter(Boolean)) {
    if ((KNOWN_MODES as string[]).includes(raw)) valid.push(raw as Mode);
    else invalid.push(raw);
  }
  return {valid, invalid};
}

export default function DeploymentAvailability({modes}: {modes: string}) {
  const {valid, invalid} = parseModes(modes || '');

  if (invalid.length > 0) {
    return (
      <aside className={`${styles.badge} ${styles.unknown}`} role="note">
        Unknown deployment mode(s): <code>{invalid.join(', ')}</code>. Valid:{' '}
        <code>{KNOWN_MODES.join(', ')}</code>.
      </aside>
    );
  }
  if (valid.length === 0) {
    return (
      <aside className={`${styles.badge} ${styles.unknown}`} role="note">
        <code>&lt;DeploymentAvailability/&gt;</code> requires a non-empty <code>modes</code> prop.
      </aside>
    );
  }

  const labels = valid.map((m) => MODE_LABEL[m]).join(', ');
  return (
    <aside className={`${styles.badge} ${styles.deployment}`} role="note" aria-label="Deployment availability">
      <span className={styles.key}>Deployment</span>
      <span className={styles.value}>
        <Link href="/product-overview/editions-and-offerings">{labels}</Link>
      </span>
    </aside>
  );
}
