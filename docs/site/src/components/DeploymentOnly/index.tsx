import React from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';

// Inline conditional rendering keyed off the `?scope=` URL parameter.
// Pattern adopted from Teleport (`?scope=enterprise`). Same canonical page,
// multiple rendered variants by deployment mode.
//
// Usage:
//   <DeploymentOnly modes="self-hosted,air-gapped">
//     This paragraph only renders when ?scope=self-hosted or ?scope=air-gapped.
//   </DeploymentOnly>
//
//   <DeploymentOnly modes="cloud-shared,cloud-dedicated,cloud-government" hideWhen="other">
//     Cloud-specific content. Hidden when ?scope= is set to a non-Cloud mode.
//   </DeploymentOnly>
//
// Behaviour:
//   - No `?scope=` in URL: render the content (default = show everything).
//   - `?scope=<mode>` present and `<mode>` is in `modes`: render content.
//   - `?scope=<mode>` present and NOT in `modes`: hide content.
//   - SSR: render content (matches "no scope" default — safe for SEO).

type Mode =
  | 'cloud-shared'
  | 'cloud-dedicated'
  | 'cloud-government'
  | 'self-hosted'
  | 'air-gapped'
  | 'tactical-edge';

const KNOWN_MODES: Mode[] = [
  'cloud-shared',
  'cloud-dedicated',
  'cloud-government',
  'self-hosted',
  'air-gapped',
  'tactical-edge',
];

function getScope(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return new URLSearchParams(window.location.search).get('scope');
  } catch {
    return null;
  }
}

function Inner({
  modes,
  children,
}: {
  modes: string;
  children: React.ReactNode;
}) {
  const allowed = (modes || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => (KNOWN_MODES as string[]).includes(s));

  const scope = getScope();
  if (!scope) return <>{children}</>; // No filter set — show everything.
  if (allowed.includes(scope)) return <>{children}</>;
  return null;
}

export default function DeploymentOnly(props: {
  modes: string;
  children: React.ReactNode;
}) {
  return (
    <BrowserOnly fallback={<>{props.children}</>}>
      {() => <Inner {...props} />}
    </BrowserOnly>
  );
}
