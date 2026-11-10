import React, {useState, useMemo} from 'react';
import styles from './styles.module.css';
import {
  TIERS,
  PROVIDERS,
  bomFor,
  DB_BRAND,
  REDIS_BRAND,
  SEARCH_BRAND,
  STORAGE_BRAND,
  LB_BRAND_VM,
  LB_BRAND_K8S,
  type Tier,
  type DeploymentType,
  type Provider,
} from './data';

/**
 * Interactive deployment-architecture builder.
 *
 * Pick a scale tier, deployment type, hosting provider, and optional
 * services (Calls / Push). Renders an architecture diagram with explicit
 * per-connection port labels, plus a bill of materials and a network
 * flows table sized to those choices.
 */

/* ============================ Diagram primitives ============================ */

function FlowDown({port}: {port: string}) {
  return (
    <div className={styles.flow} aria-hidden>
      <span className={styles.flowArrow}>↓</span>
      <span className={styles.flowPorts}>{port}</span>
    </div>
  );
}

function MiniFlow({port}: {port: string}) {
  return (
    <div className={styles.miniFlow} aria-hidden>
      <span className={styles.miniArrow}>↓</span> {port}
    </div>
  );
}

function HFlow({direction, port}: {direction: 'left' | 'right'; port: string}) {
  const arrow = direction === 'left' ? '←' : '→';
  return (
    <div className={styles.hFlow} aria-hidden>
      <span className={styles.hArrow}>{arrow}</span>
      <span className={styles.hFlowPorts}>{port}</span>
    </div>
  );
}

function DataItem({
  port,
  accent,
  label,
  subtitle,
}: {
  port: string;
  accent: string;
  label: string;
  subtitle: string;
}) {
  return (
    <div className={styles.dataItem}>
      <MiniFlow port={port} />
      <div className={`${styles.box} ${accent}`}>
        <div className={styles.boxLabel}>{label}</div>
        <div className={styles.boxSub}>{subtitle}</div>
      </div>
    </div>
  );
}

/* ============================ Architecture diagram ============================
 *
 * 3-column CSS grid: left side / center / right side.
 *   - Center column holds: clients, ALB, Mattermost, data tier (so they all
 *     align vertically — ALB is locked directly above Mattermost).
 *   - Left column holds RTCD when Calls is on.
 *   - Right column holds Push Proxy / HPNS.
 *
 * Connection labels are minimal (just ports). The Network Flows table
 * below the BOM documents what each port is for.
 */

function ArchDiagram({
  tier,
  k8s,
  provider,
  showCalls,
  pushMode,
}: {
  tier: Tier;
  k8s: boolean;
  provider: Provider;
  showCalls: boolean;
  pushMode: 'self-hosted' | 'hpns';
}) {
  const showLb = tier.loadBalancer !== 'none';
  const showRedis = tier.redis;
  const showSearch = tier.search !== 'none';
  const showReplica = tier.dbReplicas > 0;

  const lbName = k8s ? LB_BRAND_K8S[provider] : LB_BRAND_VM[provider];

  return (
    <div className={styles.diagram} aria-label="Architecture diagram">
      {/* Client tier — labeled container, two cards (Web/Desktop + Mobile) */}
      <div className={styles.gridCenter}>
        <div className={styles.clientsBox}>
          <div className={styles.clientsLabel}>Clients</div>
          <div className={styles.clientsRow}>
            <div className={styles.client}>
              <div className={styles.clientLabel}>Web &amp; Desktop</div>
              <div className={styles.clientSub}>Channels web app · Windows · macOS · Linux</div>
            </div>
            <div className={styles.client}>
              <div className={styles.clientLabel}>Mobile</div>
              <div className={styles.clientSub}>iOS · Android</div>
            </div>
          </div>
        </div>
      </div>

      {/* Flow row: main HTTPS arrow from clients into LB / Mattermost */}
      <div className={styles.gridCenter}>
        <FlowDown port="TCP/443" />
      </div>

      {/* Edge tier (ALB) — center column, locked above Mattermost */}
      {showLb && (
        <>
          <div className={styles.gridCenter}>
            <div className={`${styles.box} ${styles.boxLb}`}>
              <div className={styles.boxLabel}>{lbName}</div>
              <div className={styles.boxSub}>
                {tier.loadBalancer === 'cluster' ? 'HA pair · TLS termination' : 'TLS termination'}
              </div>
            </div>
          </div>
          <div className={styles.gridCenter}>
            <FlowDown port="TCP/8065" />
          </div>
        </>
      )}

      {/* App row: RTCD (left) — Mattermost (center) — Push (right), all in one row.
       * The DIRECT pill floats absolutely above the RTCD box so it doesn't claim
       * its own grid row (which would create an empty band across the diagram). */}
      {showCalls && (
        <div className={styles.gridLeft}>
          <div className={styles.sideGroup}>
            <div className={styles.rtcdWrap}>
              <div className={styles.flowDirectAbove} aria-label="Direct client media path to RTCD">
                <span className={styles.directBadge}>direct</span>
                <span className={styles.flowArrowDiag}>↓</span>
                <span className={styles.flowPorts}>UDP+TCP/8443</span>
              </div>
              <div className={`${styles.box} ${styles.boxCalls}`}>
                <div className={styles.boxLabel}>RTCD (Calls)</div>
                <div className={styles.boxSub}>
                  {tier.appNodes >= 8 ? 'HA (2–3 nodes)' : '1 node'} · audio + screen-share
                </div>
              </div>
            </div>
            <HFlow direction="left" port="TCP/8045" />
          </div>
        </div>
      )}

      <div className={styles.gridCenter}>
        <div className={`${styles.box} ${styles.boxApp}`}>
          <div className={styles.boxLabel}>
            Mattermost{k8s ? ' (Operator)' : ''}
            <span className={styles.qty}>×{tier.appNodes}</span>
          </div>
          <div className={styles.boxSub}>
            {tier.appCpu} vCPU · {tier.appRam} GB RAM{tier.ha ? ' · HA cluster' : ''}
          </div>
        </div>
      </div>

      <div className={styles.gridRight}>
        <div className={styles.sideGroup}>
          <HFlow direction="right" port="HTTPS/443" />
          {pushMode === 'self-hosted' ? (
            <div className={`${styles.box} ${styles.boxPush}`}>
              <div className={styles.boxLabel}>Push Proxy</div>
              <div className={styles.boxSub}>self-hosted</div>
            </div>
          ) : (
            <div className={`${styles.box} ${styles.boxPushManaged}`}>
              <div className={styles.boxLabel}>Mattermost HPNS</div>
              <div className={styles.boxSub}>
                <span className={styles.managedBadge}>managed by Mattermost</span>
                <br />
                Hosted Push Notifications Service
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Data tier — spans full width below center */}
      <div className={`${styles.gridFull} ${styles.rowData}`}>
        <DataItem
          port="TCP/5432"
          accent={styles.boxDb}
          label={DB_BRAND[provider]}
          subtitle={`primary${showReplica ? ` + ${tier.dbReplicas} replica${tier.dbReplicas > 1 ? 's' : ''}` : ''}`}
        />
        {showRedis && (
          <DataItem
            port="TCP/6379"
            accent={styles.boxRedis}
            label={REDIS_BRAND[provider]}
            subtitle={`${tier.appNodes >= 8 ? 'Cluster' : 'Single'} · sessions + cluster state`}
          />
        )}
        {showSearch && (
          <DataItem
            port="HTTPS/9200"
            accent={styles.boxSearch}
            label={SEARCH_BRAND[provider]}
            subtitle={`${tier.searchNodes} node${tier.searchNodes > 1 ? 's' : ''} · message search`}
          />
        )}
        <DataItem
          port="HTTPS/443"
          accent={styles.boxStorage}
          label={tier.storage === 'object' ? STORAGE_BRAND[provider] : 'Local disk'}
          subtitle={tier.storage === 'object' ? 'S3-compatible · uploads + plugins' : 'host disk (trial)'}
        />
      </div>
    </div>
  );
}

/* ============================ Network Flows table ============================
 *
 * Documents every connection in the architecture: source → destination,
 * protocol, port, and purpose. Useful for firewall configuration.
 * Rows are conditional on the user's choices. */

type NetworkFlow = {
  from: string;
  to: string;
  protocol: string;
  port: string;
  direction: 'inbound' | 'internal' | 'egress';
  purpose: string;
};

function networkFlowsFor(
  tier: Tier,
  provider: Provider,
  showCalls: boolean,
  pushMode: 'self-hosted' | 'hpns',
): NetworkFlow[] {
  const flows: NetworkFlow[] = [];

  flows.push({
    from: 'Web / Desktop / Mobile clients',
    to: tier.loadBalancer !== 'none' ? 'Load balancer' : 'Mattermost',
    protocol: 'HTTPS + WSS',
    port: 'TCP/443',
    direction: 'inbound',
    purpose: 'Channels API, WebSocket events, file uploads',
  });

  if (showCalls) {
    flows.push({
      from: 'Web / Desktop / Mobile clients',
      to: 'RTCD',
      protocol: 'UDP, TCP (fallback)',
      port: '8443',
      direction: 'inbound',
      purpose: 'Calls media (audio, video, screen-share) — direct, bypasses LB',
    });
  }

  if (tier.loadBalancer !== 'none') {
    flows.push({
      from: 'Load balancer',
      to: 'Mattermost',
      protocol: 'HTTP',
      port: 'TCP/8065',
      direction: 'internal',
      purpose: 'TLS-terminated app traffic',
    });
  }

  flows.push({
    from: 'Mattermost',
    to: `PostgreSQL (${DB_BRAND[provider]})`,
    protocol: 'TCP',
    port: '5432',
    direction: 'internal',
    purpose: 'Database queries',
  });

  if (tier.redis) {
    flows.push({
      from: 'Mattermost',
      to: `Redis (${REDIS_BRAND[provider]})`,
      protocol: 'TCP',
      port: '6379',
      direction: 'internal',
      purpose: 'Sessions, cluster coordination, cache',
    });
  }

  if (tier.search !== 'none') {
    flows.push({
      from: 'Mattermost',
      to: `OpenSearch (${SEARCH_BRAND[provider]})`,
      protocol: 'HTTPS',
      port: '9200',
      direction: 'internal',
      purpose: 'Message search index reads + writes',
    });
  }

  flows.push({
    from: 'Mattermost',
    to: tier.storage === 'object' ? `Object storage (${STORAGE_BRAND[provider]})` : 'Local disk',
    protocol: 'HTTPS',
    port: 'TCP/443',
    direction: tier.storage === 'object' ? 'internal' : 'internal',
    purpose: 'File uploads, plugin assets, compliance exports',
  });

  if (showCalls) {
    flows.push({
      from: 'Mattermost',
      to: 'RTCD',
      protocol: 'TCP',
      port: '8045',
      direction: 'internal',
      purpose: 'Calls signaling and orchestration API',
    });
  }

  flows.push({
    from: 'Mattermost',
    to: pushMode === 'self-hosted' ? 'Mattermost Push Proxy (self-hosted)' : 'Mattermost HPNS (managed)',
    protocol: 'HTTPS',
    port: 'TCP/443',
    direction: pushMode === 'self-hosted' ? 'internal' : 'egress',
    purpose: 'Push notification submission',
  });

  flows.push({
    from: pushMode === 'self-hosted' ? 'Mattermost Push Proxy' : 'Mattermost HPNS',
    to: 'Apple APNs (api.push.apple.com)',
    protocol: 'HTTPS',
    port: 'TCP/443',
    direction: 'egress',
    purpose: 'iOS push fan-out',
  });

  flows.push({
    from: pushMode === 'self-hosted' ? 'Mattermost Push Proxy' : 'Mattermost HPNS',
    to: 'Google FCM (fcm.googleapis.com)',
    protocol: 'HTTPS',
    port: 'TCP/443',
    direction: 'egress',
    purpose: 'Android push fan-out',
  });

  return flows;
}

function NetworkFlowsTable({flows}: {flows: NetworkFlow[]}) {
  return (
    <>
      <h3 className={styles.bomHeading}>Network flows</h3>
      <p className={styles.flowsIntro}>
        Every connection in the architecture above — useful when configuring firewall
        rules, security groups, or a CAP. <strong>Inbound</strong> = from clients;{' '}
        <strong>internal</strong> = within the deployment boundary;{' '}
        <strong>egress</strong> = out to external services.
      </p>
      <div className={styles.bomTableWrap}>
        <table className={styles.bomTable}>
          <thead>
            <tr>
              <th>From</th>
              <th>To</th>
              <th>Direction</th>
              <th>Protocol</th>
              <th>Port</th>
              <th>Purpose</th>
            </tr>
          </thead>
          <tbody>
            {flows.map((f, i) => (
              <tr key={`${f.from}-${f.to}-${i}`}>
                <td className={styles.cellComponent}>{f.from}</td>
                <td className={styles.cellComponent}>{f.to}</td>
                <td className={styles.cellQty}>
                  <span className={`${styles.directionPill} ${styles[`dir_${f.direction}`]}`}>
                    {f.direction}
                  </span>
                </td>
                <td className={styles.cellSpec}>{f.protocol}</td>
                <td className={styles.cellSpec}>{f.port}</td>
                <td className={styles.cellNotes}>{f.purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ============================ Main component ============================ */

export default function DeploymentArchitectureBuilder() {
  const [tierId, setTierId] = useState<string>('medium');
  const [deploymentType, setDeploymentType] = useState<DeploymentType>('vm');
  const [provider, setProvider] = useState<Provider>('aws');
  const [includeCalls, setIncludeCalls] = useState<boolean>(false);
  const [selfHostPush, setSelfHostPush] = useState<boolean>(true);

  const tier = useMemo(
    () => TIERS.find((t) => t.id === tierId) ?? TIERS[0],
    [tierId],
  );

  const bom = useMemo(
    () => bomFor(tier, deploymentType, provider, {calls: includeCalls, push: selfHostPush}),
    [tier, deploymentType, provider, includeCalls, selfHostPush],
  );

  const flows = useMemo(
    () => networkFlowsFor(tier, provider, includeCalls, selfHostPush ? 'self-hosted' : 'hpns'),
    [tier, provider, includeCalls, selfHostPush],
  );

  return (
    <section className={styles.builder} aria-label="Deployment architecture builder">
      <div className={styles.controls}>
        <ControlGroup label="Scale tier">
          <select
            className={styles.select}
            value={tierId}
            onChange={(e) => setTierId(e.target.value)}
            aria-label="Scale tier"
          >
            {TIERS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.seats}
              </option>
            ))}
          </select>
        </ControlGroup>

        <ControlGroup label="Deployment type">
          <SegmentedControl
            name="deployment-type"
            value={deploymentType}
            onChange={(v) => setDeploymentType(v as DeploymentType)}
            options={[
              {value: 'vm', label: 'Virtual machines'},
              {value: 'kubernetes', label: 'Kubernetes'},
            ]}
          />
        </ControlGroup>

        <ControlGroup label="Hosting">
          <select
            className={styles.select}
            value={provider}
            onChange={(e) => setProvider(e.target.value as Provider)}
            aria-label="Hosting"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </ControlGroup>

        <ControlGroup label="Optional services">
          <div className={styles.checkboxes}>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={includeCalls}
                onChange={(e) => setIncludeCalls(e.target.checked)}
              />
              <span>Calls (RTCD)</span>
            </label>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={selfHostPush}
                onChange={(e) => setSelfHostPush(e.target.checked)}
              />
              <span>Self-host Push Proxy</span>
            </label>
          </div>
        </ControlGroup>
      </div>

      <aside className={styles.summary} role="note">
        <strong>{tier.seats}</strong> — {tier.description}
      </aside>

      <ArchDiagram
        tier={tier}
        k8s={deploymentType === 'kubernetes'}
        provider={provider}
        showCalls={includeCalls}
        pushMode={selfHostPush ? 'self-hosted' : 'hpns'}
      />

      <h3 className={styles.bomHeading}>Bill of materials</h3>
      <div className={styles.bomTableWrap}>
        <table className={styles.bomTable}>
          <thead>
            <tr>
              <th>Component</th>
              <th>Quantity</th>
              <th>Recommended size / SKU</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {bom.map((row, i) => (
              <tr key={`${row.component}-${i}`}>
                <td className={styles.cellComponent}>{row.component}</td>
                <td className={styles.cellQty}>{row.quantity}</td>
                <td className={styles.cellSpec}>{row.spec}</td>
                <td className={styles.cellNotes}>{row.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <NetworkFlowsTable flows={flows} />

      <p className={styles.caveat}>
        Sizing follows the Mattermost scaling guide; provider SKUs are illustrative
        starting points. Verify against current pricing, regional availability, and any
        compliance constraints before procurement.
      </p>
    </section>
  );
}

/* ============================ Small UI bits ============================ */

function ControlGroup({label, children}: {label: string; children: React.ReactNode}) {
  return (
    <div className={styles.controlGroup}>
      <div className={styles.controlLabel}>{label}</div>
      {children}
    </div>
  );
}

function SegmentedControl<T extends string>({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: T;
  onChange: (v: T) => void;
  options: {value: T; label: string}[];
}) {
  return (
    <div className={styles.segmented} role="radiogroup" aria-label={name}>
      {options.map((opt) => (
        <label
          key={opt.value}
          className={`${styles.segment} ${value === opt.value ? styles.segmentActive : ''}`}
        >
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className={styles.segmentInput}
          />
          {opt.label}
        </label>
      ))}
    </div>
  );
}
