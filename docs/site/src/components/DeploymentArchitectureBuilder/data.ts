// Data tables for the Deployment Architecture builder.
//
// Tier sizing follows the Mattermost scaling guide. Provider SKUs are
// illustrative starting points — verify with current pricing and any
// regional / compliance constraints before committing to a procurement
// decision.

export type Tier = {
  id: string;
  label: string;
  seats: string;
  description: string;
  appNodes: number;
  appCpu: number;
  appRam: number;
  dbReplicas: number;
  redis: boolean;
  search: 'none' | 'optional' | 'recommended' | 'required';
  searchNodes: number;
  loadBalancer: 'none' | 'single' | 'cluster';
  storage: 'local' | 'object';
  ha: boolean;
};

export const TIERS: Tier[] = [
  {
    id: 'trial',
    label: 'Trial / Pilot',
    seats: '≤ 200 users',
    description: 'Single host for evaluation. Mattermost and PostgreSQL co-located; no separate proxy or cache.',
    appNodes: 1,
    appCpu: 2,
    appRam: 4,
    dbReplicas: 0,
    redis: false,
    search: 'none',
    searchNodes: 0,
    loadBalancer: 'none',
    storage: 'local',
    ha: false,
  },
  {
    id: 'small',
    label: 'Small',
    seats: '≤ 2,000 users',
    description: 'Separate app and database hosts. NGINX reverse proxy. Single Mattermost node — restart causes a brief outage.',
    appNodes: 1,
    appCpu: 4,
    appRam: 16,
    dbReplicas: 0,
    redis: false,
    search: 'optional',
    searchNodes: 1,
    loadBalancer: 'single',
    storage: 'object',
    ha: false,
  },
  {
    id: 'medium',
    label: 'Medium',
    seats: '≤ 10,000 users',
    description: 'High availability: 2-node Mattermost cluster behind a load balancer. PostgreSQL with read replica.',
    appNodes: 2,
    appCpu: 8,
    appRam: 32,
    dbReplicas: 1,
    redis: false,
    search: 'recommended',
    searchNodes: 1,
    loadBalancer: 'single',
    storage: 'object',
    ha: true,
  },
  {
    id: 'large',
    label: 'Large',
    seats: '≤ 25,000 users',
    description: '4-node Mattermost cluster. PostgreSQL primary + 2 read replicas. Dedicated Elasticsearch / OpenSearch cluster for message search.',
    appNodes: 4,
    appCpu: 16,
    appRam: 64,
    dbReplicas: 2,
    redis: false,
    search: 'required',
    searchNodes: 3,
    loadBalancer: 'cluster',
    storage: 'object',
    ha: true,
  },
  {
    id: 'xlarge',
    label: 'Extra Large',
    seats: '≤ 50,000 users',
    description: '8-node Mattermost cluster. PostgreSQL primary + 2 replicas with connection pooler. OpenSearch cluster (5 nodes).',
    appNodes: 8,
    appCpu: 16,
    appRam: 64,
    dbReplicas: 2,
    redis: false,
    search: 'required',
    searchNodes: 5,
    loadBalancer: 'cluster',
    storage: 'object',
    ha: true,
  },
  {
    id: 'mega',
    label: 'Mega',
    seats: '≤ 100,000 users',
    description: '16-node Mattermost cluster. PostgreSQL with connection pooler + multiple read replicas. OpenSearch cluster (5+ data nodes). CDN in front of static assets.',
    appNodes: 16,
    appCpu: 32,
    appRam: 128,
    dbReplicas: 3,
    redis: false,
    search: 'required',
    searchNodes: 5,
    loadBalancer: 'cluster',
    storage: 'object',
    ha: true,
  },
  {
    id: 'hyperscale',
    label: 'Hyperscale',
    seats: '≤ 200,000 users',
    description: '32-node Mattermost cluster. Sharded PostgreSQL via connection pooler. Redis cluster (5+ nodes). OpenSearch cluster (10+ data nodes). Multi-region CDN.',
    appNodes: 32,
    appCpu: 32,
    appRam: 128,
    dbReplicas: 4,
    redis: true,
    search: 'required',
    searchNodes: 10,
    loadBalancer: 'cluster',
    storage: 'object',
    ha: true,
  },
];

export type DeploymentType = 'vm' | 'kubernetes';
export type Provider = 'aws' | 'azure' | 'gcp' | 'oci' | 'on-prem';

export const PROVIDERS: {id: Provider; label: string}[] = [
  {id: 'aws', label: 'AWS'},
  {id: 'azure', label: 'Azure'},
  {id: 'gcp', label: 'Google Cloud'},
  {id: 'oci', label: 'Oracle Cloud (OCI)'},
  {id: 'on-prem', label: 'On-prem / Other'},
];

/* ============================ Brand short names ============================
 * Used in the diagram boxes — proper service product name per provider.
 * Longer descriptive labels live in the BOM under "Recommended size / SKU". */

export const DB_BRAND: Record<Provider, string> = {
  aws: 'Amazon RDS (PostgreSQL)',
  azure: 'Azure Database (PostgreSQL)',
  gcp: 'Cloud SQL (PostgreSQL)',
  oci: 'OCI Database (PostgreSQL)',
  'on-prem': 'PostgreSQL (self-managed)',
};

export const REDIS_BRAND: Record<Provider, string> = {
  aws: 'Amazon ElastiCache (Redis)',
  azure: 'Azure Cache for Redis',
  gcp: 'Memorystore (Redis)',
  oci: 'OCI Cache (Redis)',
  'on-prem': 'Redis (self-managed)',
};

export const SEARCH_BRAND: Record<Provider, string> = {
  aws: 'Amazon OpenSearch',
  azure: 'Self-hosted OpenSearch',
  gcp: 'Self-hosted OpenSearch',
  oci: 'OCI Search (OpenSearch)',
  'on-prem': 'OpenSearch (self-managed)',
};

export const STORAGE_BRAND: Record<Provider, string> = {
  aws: 'Amazon S3',
  azure: 'Azure Blob Storage',
  gcp: 'Cloud Storage',
  oci: 'OCI Object Storage',
  'on-prem': 'MinIO (S3-compatible)',
};

export const LB_BRAND_VM: Record<Provider, string> = {
  aws: 'AWS Application Load Balancer',
  azure: 'Azure Application Gateway',
  gcp: 'Google Cloud HTTPS LB',
  oci: 'OCI Flexible Load Balancer',
  'on-prem': 'NGINX / HAProxy',
};

export const LB_BRAND_K8S: Record<Provider, string> = {
  aws: 'NGINX Ingress + AWS NLB',
  azure: 'NGINX Ingress + Azure LB',
  gcp: 'NGINX Ingress + GCP LB',
  oci: 'NGINX Ingress + OCI LB',
  'on-prem': 'NGINX Ingress Controller',
};

/* ============================ DB instance sizing ============================ */

const DB_INSTANCE = {
  aws:    {trial: 'co-located',         small: 'db.m5.large',        medium: 'db.m5.xlarge',    large: 'db.m5.2xlarge',    xlarge: 'db.m5.4xlarge',  mega: 'db.r5.4xlarge',  hyperscale: 'db.r5.8xlarge'},
  azure:  {trial: 'co-located',         small: 'D4ds_v4',            medium: 'D8ds_v4',         large: 'D16ds_v4',         xlarge: 'D32ds_v4',       mega: 'E32ds_v4',       hyperscale: 'E48ds_v4'},
  gcp:    {trial: 'co-located',         small: 'db-n1-standard-4',   medium: 'db-n1-standard-8', large: 'db-n1-standard-16', xlarge: 'db-n1-standard-32', mega: 'db-n1-highmem-32', hyperscale: 'db-n1-highmem-64'},
  oci:    {trial: 'co-located',         small: 'PostgreSQL.E4.4',    medium: 'PostgreSQL.E4.8', large: 'PostgreSQL.E4.16', xlarge: 'PostgreSQL.E4.32', mega: 'PostgreSQL.E4.64', hyperscale: 'PostgreSQL.E4.96'},
  'on-prem': {trial: 'co-located',      small: '4 vCPU / 16 GB',     medium: '8 vCPU / 32 GB',  large: '16 vCPU / 64 GB',  xlarge: '32 vCPU / 128 GB', mega: '32 vCPU / 256 GB', hyperscale: '64 vCPU / 384 GB'},
} as const;

const APP_SKU = {
  aws:    {'2-4': 't3.medium',  '4-16': 'm5.xlarge',  '8-32': 'm5.2xlarge', '16-64': 'm5.4xlarge', '32-128': 'm6i.8xlarge'},
  azure:  {'2-4': 'B2ms',       '4-16': 'D4s_v3',     '8-32': 'D8s_v3',     '16-64': 'D16s_v3',    '32-128': 'D32s_v3'},
  gcp:    {'2-4': 'e2-medium',  '4-16': 'e2-standard-4', '8-32': 'e2-standard-8', '16-64': 'n2-standard-16', '32-128': 'n2-standard-32'},
  oci:    {'2-4': 'VM.Standard.E4.Flex (2 OCPU)', '4-16': 'VM.Standard.E4.Flex (4 OCPU)', '8-32': 'VM.Standard.E4.Flex (8 OCPU)', '16-64': 'VM.Standard.E4.Flex (16 OCPU)', '32-128': 'VM.Standard.E4.Flex (32 OCPU)'},
  'on-prem': {'2-4': '2 vCPU / 4 GB VM', '4-16': '4 vCPU / 16 GB VM', '8-32': '8 vCPU / 32 GB VM', '16-64': '16 vCPU / 64 GB VM', '32-128': '32 vCPU / 128 GB VM'},
} as const;

function bucketFor(cpu: number): keyof typeof APP_SKU['aws'] {
  if (cpu <= 2) return '2-4';
  if (cpu <= 4) return '4-16';
  if (cpu <= 8) return '8-32';
  if (cpu <= 16) return '16-64';
  return '32-128';
}

/* ============================ Bill of materials ============================ */

export type BomRow = {
  component: string;
  quantity: string;
  spec: string;
  notes?: string;
};

export type BomOptions = {
  calls: boolean;
  push: boolean;
};

export function bomFor(
  tier: Tier,
  deploymentType: DeploymentType,
  provider: Provider,
  opts: BomOptions,
): BomRow[] {
  const rows: BomRow[] = [];
  const onPrem = provider === 'on-prem';
  const k8s = deploymentType === 'kubernetes';
  const bucket = bucketFor(tier.appCpu);
  const tierId = tier.id as keyof typeof DB_INSTANCE['aws'];

  // Load balancer / ingress
  if (tier.loadBalancer !== 'none') {
    rows.push({
      component: k8s ? 'Ingress controller' : 'Load balancer',
      quantity: tier.loadBalancer === 'cluster' ? 'HA pair' : '1',
      spec: k8s ? LB_BRAND_K8S[provider] : LB_BRAND_VM[provider],
      notes: 'TLS terminated at the proxy. Mattermost behind, listening on HTTP/8065.',
    });
  }

  // App / Mattermost
  rows.push({
    component: k8s ? 'Mattermost (Operator)' : 'Mattermost app server',
    quantity: `${tier.appNodes} node${tier.appNodes > 1 ? 's' : ''}`,
    spec: k8s
      ? `${tier.appCpu} vCPU / ${tier.appRam} GB RAM per pod — worker nodes: ${APP_SKU[provider][bucket]}`
      : `${APP_SKU[provider][bucket]} (${tier.appCpu} vCPU / ${tier.appRam} GB RAM)`,
    notes: tier.ha
      ? 'High availability — restarts and upgrades are non-disruptive.'
      : 'Single node — restarts cause a brief outage.',
  });

  // Database
  rows.push({
    component: 'PostgreSQL (primary)',
    quantity: '1',
    spec: `${DB_BRAND[provider]} — ${DB_INSTANCE[provider][tierId]}`,
    notes: tier.id === 'trial' ? 'Co-located with the app for evaluation only.' : 'Separate host. PostgreSQL 14 minimum. App connects on TCP/5432.',
  });
  if (tier.dbReplicas > 0) {
    rows.push({
      component: 'PostgreSQL read replicas',
      quantity: `${tier.dbReplicas}`,
      spec: onPrem
        ? 'Streaming replication, same size as primary'
        : `${DB_BRAND[provider]} read replica`,
      notes: 'Read queries (search, dashboards) offloaded from the primary.',
    });
  }

  // Redis
  if (tier.redis) {
    rows.push({
      component: 'Redis cache',
      quantity: tier.appNodes >= 16 ? 'Cluster (5+ nodes)' : tier.appNodes >= 8 ? 'Cluster (3 nodes)' : '1 node',
      spec: REDIS_BRAND[provider],
      notes: 'Required for HA — coordinates sessions and cluster state across app nodes. App connects on TCP/6379.',
    });
  }

  // Search
  if (tier.search !== 'none') {
    rows.push({
      component: 'Search index',
      quantity: `${tier.searchNodes} node${tier.searchNodes > 1 ? 's' : ''}`,
      spec: SEARCH_BRAND[provider],
      notes:
        tier.search === 'optional'
          ? 'Optional at this size — message search will work via PostgreSQL but is slower above ~5,000 users. App connects on HTTPS/9200.'
          : tier.search === 'recommended'
          ? 'Recommended — message search performance degrades on the DB alone at this scale. App connects on HTTPS/9200.'
          : 'Required — message search at this scale cannot run on PostgreSQL alone. App connects on HTTPS/9200.',
    });
  }

  // File storage
  rows.push({
    component: 'File storage',
    quantity: '—',
    spec: tier.storage === 'local' ? 'Local disk on app host (trial only)' : STORAGE_BRAND[provider],
    notes: tier.storage === 'local'
      ? 'Acceptable for trial only. Move to object storage before any HA or multi-node config.'
      : 'S3-compatible bucket. App connects on HTTPS/443. Backup + versioning recommended.',
  });

  // Calls (RTCD) — optional
  if (opts.calls) {
    rows.push({
      component: 'Calls / RTCD service',
      quantity: tier.appNodes >= 8 ? '2-3 nodes (HA)' : '1 node',
      spec: 'Mattermost RTCD (real-time communications daemon) — small container or VM (2 vCPU / 4 GB)',
      notes:
        'Standalone service for audio + screen-share. Clients connect on UDP/8443 (and TCP/8443 fallback). Mattermost talks to RTCD on TCP/8045 for the API.',
    });
    rows.push({
      component: 'Calls plugin',
      quantity: '—',
      spec: 'Bundled Calls plugin enabled in System Console',
      notes: 'Required to drive the RTCD service. Configure provider URL pointing at RTCD endpoint.',
    });
  }

  // Push notification proxy — optional
  if (opts.push) {
    rows.push({
      component: 'Push notification proxy',
      quantity: '1',
      spec: 'Mattermost Push Proxy (open source) — small single host (1 vCPU / 2 GB) or container',
      notes:
        'Mediates APNs (api.push.apple.com) and FCM (fcm.googleapis.com) on HTTPS/443. Use HPNS instead if you can reach Mattermost-managed; self-host for air-gapped / sovereign deployments.',
    });
  }

  // Kubernetes-specific: cluster sizing note
  if (k8s) {
    rows.push({
      component: 'Kubernetes cluster',
      quantity: tier.appNodes <= 2 ? '3 worker nodes (min)' : `${tier.appNodes + 2}+ worker nodes`,
      spec: provider === 'aws' ? 'Amazon EKS' : provider === 'azure' ? 'Azure AKS' : provider === 'gcp' ? 'Google GKE' : provider === 'oci' ? 'Oracle OKE' : 'self-managed K8s',
      notes: 'Sized for app pods + system overhead. Mattermost Operator manages the app lifecycle.',
    });
  }

  return rows;
}
