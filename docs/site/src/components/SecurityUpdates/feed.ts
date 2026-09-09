import {parseAffectedLines, type VersionRange} from './versions';

export const FEED_URL = 'https://securityupdates.mattermost.com/security_updates.json';

export type TabId = 'server' | 'desktop' | 'mobile' | 'plugins';

export type SecurityUpdateRow = {
  issueId: string;
  cveId?: string;
  severity: string;
  affectedVersions: string[];
  affectedRanges: VersionRange[];
  releaseDate: string;
  fixVersions: string[];
  details: string;
};

export type SecurityUpdateTab = {
  id: TabId;
  label: string;
  rows: SecurityUpdateRow[];
};

export const TAB_ORDER: {id: TabId; label: string}[] = [
  {id: 'server', label: 'Server'},
  {id: 'desktop', label: 'Desktop'},
  {id: 'mobile', label: 'Mobile'},
  {id: 'plugins', label: 'Plugins'},
];

const PLATFORM_MAP: Record<string, TabId> = {
  'Mattermost Server': 'server',
  'Mattermost Desktop App': 'desktop',
  'Mattermost Mobile Apps': 'mobile',
  'Mattermost Plugins': 'plugins',
};

type FeedItem = {
  issue_id?: string;
  cve_id?: string;
  severity?: string;
  affected_versions?: unknown;
  fix_release_date?: string;
  fix_versions?: unknown;
  details?: string;
  platform?: string;
};

function normalizeVersions(value: unknown): string[] {
  if (value == null || value === '') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry) => normalizeVersions(entry)).map((entry) => entry.trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }
    if (trimmed.startsWith('[')) {
      try {
        return normalizeVersions(JSON.parse(trimmed));
      } catch {
        /* keep as plain string */
      }
    }
    return [trimmed];
  }
  return [String(value)];
}

function normalizeSeverity(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || /^n\/?a$/i.test(trimmed)) {
    return 'N/A';
  }
  return trimmed.replace(/^\w/, (c) => c.toUpperCase());
}

function isHeaderRow(item: FeedItem): boolean {
  const issueId = String(item.issue_id || '').trim();
  const severity = String(item.severity || '').trim();
  const platform = String(item.platform || '').trim();
  return (
    !issueId ||
    /^issue\s*id$/i.test(issueId) ||
    /^severity$/i.test(severity) ||
    /^issue platform$/i.test(platform)
  );
}

function parseIssueParts(issueId: string) {
  const parts = issueId.split('-');
  return {
    year: Number.parseInt(parts[1] || '', 10) || 0,
    num: Number.parseInt(parts[2] || '', 10) || 0,
    extra: Number.parseInt(parts[3] || '', 10) || 0,
  };
}

function toRow(item: FeedItem): SecurityUpdateRow {
  const cveId = String(item.cve_id || '').trim();
  const affectedVersions = normalizeVersions(item.affected_versions);
  const fixVersions = normalizeVersions(item.fix_versions);
  return {
    issueId: String(item.issue_id || '').trim(),
    ...(cveId ? {cveId} : {}),
    severity: normalizeSeverity(String(item.severity || '')),
    affectedVersions,
    affectedRanges: parseAffectedLines(affectedVersions, fixVersions),
    releaseDate: String(item.fix_release_date || '').slice(0, 10),
    fixVersions,
    details: String(item.details || '').replace(/\s+/g, ' ').trim(),
  };
}

function compareFeedItems(a: FeedItem, b: FeedItem): number {
  const dateA = Date.parse(String(a.fix_release_date || '').slice(0, 10)) || 0;
  const dateB = Date.parse(String(b.fix_release_date || '').slice(0, 10)) || 0;
  if (dateA !== dateB) {
    return dateB - dateA;
  }
  const pa = parseIssueParts(String(a.issue_id || ''));
  const pb = parseIssueParts(String(b.issue_id || ''));
  if (pa.year !== pb.year) {
    return pb.year - pa.year;
  }
  if (pa.num !== pb.num) {
    return pb.num - pa.num;
  }
  return pb.extra - pa.extra;
}

export function normalizeFeed(feed: unknown): SecurityUpdateTab[] {
  if (!Array.isArray(feed)) {
    throw new Error('Unexpected feed shape: expected an array of advisories.');
  }

  const tabs = Object.fromEntries(
    TAB_ORDER.map((tab) => [tab.id, {...tab, rows: [] as SecurityUpdateRow[]}]),
  ) as Record<TabId, SecurityUpdateTab>;

  [...(feed as FeedItem[])]
    .sort(compareFeedItems)
    .forEach((item) => {
      if (isHeaderRow(item)) {
        return;
      }
      const tabId = PLATFORM_MAP[String(item.platform || '').trim()];
      if (!tabId) {
        return;
      }
      tabs[tabId].rows.push(toRow(item));
    });

  return TAB_ORDER.map((tab) => tabs[tab.id]);
}

export async function fetchSecurityUpdates(): Promise<{
  tabs: SecurityUpdateTab[];
  lastModified: string | null;
}> {
  const response = await fetch(FEED_URL, {cache: 'no-store'});
  if (!response.ok) {
    throw new Error(`Security updates feed returned ${response.status}.`);
  }
  const payload: unknown = await response.json();
  return {
    tabs: normalizeFeed(payload),
    lastModified: response.headers.get('Last-Modified'),
  };
}
