import React from 'react';
import Link from '@docusaurus/Link';
import styles from './styles.module.css';

// Per-page edition badge. Authors mark which Mattermost editions a feature
// or configuration applies to. Renders a single-row inline badge at the
// top of the page (paired with <DeploymentAvailability/>).
//
// Canonical tier slugs:
//   free                 — Mattermost Team Edition (free, OSS)
//   professional         — Mattermost Professional
//   enterprise           — Mattermost Enterprise
//   enterprise-advanced  — Mattermost Enterprise Advanced
//
// Usage:
//   <EditionAvailability tiers="enterprise,enterprise-advanced" />
//   <EditionAvailability tiers="free,professional,enterprise,enterprise-advanced" />

type Tier = 'free' | 'professional' | 'enterprise' | 'enterprise-advanced';

const TIER_LABEL: Record<Tier, string> = {
  'free': 'Team Edition',
  'professional': 'Professional',
  'enterprise': 'Enterprise',
  'enterprise-advanced': 'Enterprise Advanced',
};

const KNOWN_TIERS = Object.keys(TIER_LABEL) as Tier[];

function parseTiers(value: string): {valid: Tier[]; invalid: string[]} {
  const valid: Tier[] = [];
  const invalid: string[] = [];
  for (const raw of value.split(',').map((s) => s.trim()).filter(Boolean)) {
    if ((KNOWN_TIERS as string[]).includes(raw)) {
      valid.push(raw as Tier);
    } else {
      invalid.push(raw);
    }
  }
  return {valid, invalid};
}

export default function EditionAvailability({tiers}: {tiers: string}) {
  const {valid, invalid} = parseTiers(tiers || '');

  if (invalid.length > 0) {
    return (
      <aside className={`${styles.badge} ${styles.unknown}`} role="note">
        Unknown edition tier(s): <code>{invalid.join(', ')}</code>. Valid:{' '}
        <code>{KNOWN_TIERS.join(', ')}</code>.
      </aside>
    );
  }
  if (valid.length === 0) {
    return (
      <aside className={`${styles.badge} ${styles.unknown}`} role="note">
        <code>&lt;EditionAvailability/&gt;</code> requires a non-empty <code>tiers</code> prop.
      </aside>
    );
  }

  const labels = valid.map((t) => TIER_LABEL[t]).join(', ');
  return (
    <aside className={`${styles.badge} ${styles.edition}`} role="note" aria-label="Edition availability">
      <span className={styles.key}>Edition</span>
      <span className={styles.value}>
        <Link href="/product-overview/editions-and-offerings">{labels}</Link>
      </span>
    </aside>
  );
}
