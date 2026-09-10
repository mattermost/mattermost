import React, {useCallback, useEffect, useId, useMemo, useRef, useState} from 'react';

import {
  fetchSecurityUpdates,
  TAB_ORDER,
  type SecurityUpdateRow,
  type SecurityUpdateTab,
  type TabId,
} from './feed';
import styles from './styles.module.css';
import {labelToVersion, rowMatchesVersionRange, type Version} from './versions';

type SortKey = 'issueId' | 'severity' | 'affectedVersions' | 'releaseDate' | 'fixVersions' | 'details';
type SortDir = 'asc' | 'desc';

const PAGE_SIZES = [10, 25, 50, 100];
const SEVERITY_OPTIONS = ['Critical', 'High', 'Medium', 'Low', 'N/A'] as const;
const SEVERITY_RANK: Record<string, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
  'N/A': 0,
};

const VERSION_FILTER_DEBOUNCE_MS = 250;

const EMPTY_FILTERS = {
  issueId: '',
  severity: '',
  affectedVersion: '',
  dateFrom: '',
  dateTo: '',
  fixVersions: '',
  search: '',
};

function parseIssueSort(issueId: string): number[] {
  const parts = issueId.split('-');
  return [
    Number.parseInt(parts[1] || '', 10) || 0,
    Number.parseInt(parts[2] || '', 10) || 0,
    Number.parseInt(parts[3] || '', 10) || 0,
  ];
}

function firstVersionLabel(lines: string[]): string {
  return lines[0] || '';
}

function sortRows(rows: SecurityUpdateRow[], key: SortKey, dir: SortDir): SecurityUpdateRow[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    let result = 0;
    if (key === 'issueId') {
      const pa = parseIssueSort(a.issueId);
      const pb = parseIssueSort(b.issueId);
      result = pa[0] - pb[0] || pa[1] - pb[1] || pa[2] - pb[2] || a.issueId.localeCompare(b.issueId);
    } else if (key === 'severity') {
      result = (SEVERITY_RANK[a.severity] ?? -1) - (SEVERITY_RANK[b.severity] ?? -1);
    } else if (key === 'releaseDate') {
      result = (a.releaseDate || '').localeCompare(b.releaseDate || '');
    } else if (key === 'affectedVersions') {
      result = firstVersionLabel(a.affectedVersions).localeCompare(firstVersionLabel(b.affectedVersions));
    } else if (key === 'fixVersions') {
      result = firstVersionLabel(a.fixVersions).localeCompare(firstVersionLabel(b.fixVersions));
    } else {
      result = a.details.localeCompare(b.details);
    }
    return dir === 'asc' ? result : -result;
  });
  return copy;
}

function rowMatchesFilters(
  row: SecurityUpdateRow,
  filters: typeof EMPTY_FILTERS,
  minV: Version | null,
  maxV: Version | null,
): boolean {
  const search = filters.search.trim().toLowerCase();
  if (search) {
    const haystack = [
      row.issueId,
      row.cveId,
      row.severity,
      row.releaseDate,
      row.details,
      ...row.affectedVersions,
      ...row.fixVersions,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(search)) {
      return false;
    }
  }

  if (filters.issueId.trim()) {
    const q = filters.issueId.trim().toLowerCase();
    const issueHay = `${row.issueId} ${row.cveId || ''}`.toLowerCase();
    if (!issueHay.includes(q)) {
      return false;
    }
  }

  if (filters.severity && row.severity !== filters.severity) {
    return false;
  }

  if (filters.fixVersions.trim()) {
    const q = filters.fixVersions.trim().toLowerCase();
    if (!row.fixVersions.some((line) => line.toLowerCase().includes(q))) {
      return false;
    }
  }

  if (filters.dateFrom && row.releaseDate && row.releaseDate < filters.dateFrom) {
    return false;
  }
  if (filters.dateTo && row.releaseDate && row.releaseDate > filters.dateTo) {
    return false;
  }

  if (!rowMatchesVersionRange(row.affectedRanges, minV, maxV)) {
    return false;
  }

  return true;
}

function buildPagination(current: number, total: number): (number | '…')[] {
  if (total <= 7) {
    return Array.from({length: total}, (_, i) => i + 1);
  }
  const pages: (number | '…')[] = [1];
  const start = Math.max(2, current - 2);
  const end = Math.min(total - 1, current + 2);
  if (start > 2) {
    pages.push('…');
  }
  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }
  if (end < total - 1) {
    pages.push('…');
  }
  pages.push(total);
  return pages;
}

function VersionList({lines}: {lines: string[]}) {
  if (lines.length === 0) {
    return <span className={styles.muted}>—</span>;
  }
  return (
    <ul className={styles.versionList}>
      {lines.map((line, index) => (
        <li key={`${line}-${index}`}>{line}</li>
      ))}
    </ul>
  );
}

function rowKey(row: SecurityUpdateRow): string {
  return `${row.issueId}|${row.releaseDate}|${row.affectedVersions.join(';')}|${row.fixVersions.join(';')}`;
}

export default function SecurityUpdates() {
  const formId = useId();
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [tabs, setTabs] = useState<SecurityUpdateTab[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('server');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [versionDraft, setVersionDraft] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('releaseDate');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const loadGeneration = useRef(0);

  const load = useCallback(async () => {
    const generation = (loadGeneration.current += 1);
    setStatus('loading');
    setError(null);
    try {
      const result = await fetchSecurityUpdates();
      if (generation !== loadGeneration.current) {
        return;
      }
      setTabs(result.tabs);
      setStatus('ready');
    } catch (err) {
      if (generation !== loadGeneration.current) {
        return;
      }
      setError(err instanceof Error ? err.message : 'Unable to load security updates.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeRows = useMemo(
    () => tabs.find((tab) => tab.id === activeTab)?.rows ?? [],
    [tabs, activeTab],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((prev) => {
        if (prev.affectedVersion === versionDraft) {
          return prev;
        }
        return {...prev, affectedVersion: versionDraft};
      });
    }, VERSION_FILTER_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [versionDraft]);

  const dateOrderError = useMemo(() => {
    if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
      return 'Released to must be on or after released from.';
    }
    return null;
  }, [filters.dateFrom, filters.dateTo]);

  const filterError = dateOrderError;
  const filterErrorId = `${formId}-filter-error`;

  const filteredRows = useMemo(() => {
    if (filterError) {
      return [];
    }
    const minV = labelToVersion(filters.affectedVersion, 'min');
    const maxV = labelToVersion(filters.affectedVersion, 'max');
    return sortRows(
      activeRows.filter((row) => rowMatchesFilters(row, filters, minV, maxV)),
      sortKey,
      sortDir,
    );
  }, [activeRows, filters, sortKey, sortDir, filterError]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [activeTab, filters, pageSize, sortKey, sortDir]);

  const hasActiveFilters = useMemo(
    () =>
      Object.values(filters).some((value) => value.trim() !== '') || versionDraft.trim() !== '',
    [filters, versionDraft],
  );

  const setFilter = (key: keyof typeof EMPTY_FILTERS, value: string) => {
    setFilters((prev) => ({...prev, [key]: value}));
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setVersionDraft('');
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir(key === 'releaseDate' || key === 'severity' || key === 'issueId' ? 'desc' : 'asc');
  };

  const sortProps = (key: SortKey) => ({
    'aria-sort': sortKey === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none',
  }) as const;

  const renderSortButton = (key: SortKey, label: string) => {
    const direction =
      sortKey === key ? (sortDir === 'asc' ? 'sorted ascending' : 'sorted descending') : 'not sorted';
    return (
      <button
        type="button"
        className={styles.sortButton}
        onClick={() => toggleSort(key)}
        aria-label={`${label}, ${direction}`}
      >
        {label}
        <span className={styles.sortIcons} aria-hidden>
          <span className={sortKey === key && sortDir === 'asc' ? styles.sortActive : undefined}>▲</span>
          <span className={sortKey === key && sortDir === 'desc' ? styles.sortActive : undefined}>▼</span>
        </span>
      </button>
    );
  };

  return (
    <div className={styles.root}>
      <div className={styles.tabs} role="tablist" aria-label="Product">
        {TAB_ORDER.map((tab) => {
          const selected = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${formId}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${formId}-panel`}
              tabIndex={selected ? 0 : -1}
              className={selected ? `${styles.tab} ${styles.tabActive}` : styles.tab}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => {
                const order = TAB_ORDER.map((item) => item.id);
                const index = order.indexOf(tab.id);
                let next = -1;
                if (event.key === 'ArrowRight') {
                  next = (index + 1) % order.length;
                } else if (event.key === 'ArrowLeft') {
                  next = (index - 1 + order.length) % order.length;
                } else if (event.key === 'Home') {
                  next = 0;
                } else if (event.key === 'End') {
                  next = order.length - 1;
                }
                if (next < 0) {
                  return;
                }
                event.preventDefault();
                setActiveTab(order[next]);
                document.getElementById(`${formId}-tab-${order[next]}`)?.focus();
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${formId}-panel`}
        aria-labelledby={`${formId}-tab-${activeTab}`}
      >
      {status === 'loading' && (
        <div className={styles.status} role="status">
          Loading security updates…
        </div>
      )}

      {status === 'error' && (
        <div className={styles.error} role="alert">
          <p>{error}</p>
          <button type="button" className={styles.primaryButton} onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}

      {status === 'ready' && (
        <>
          <form
            className={styles.filters}
            onSubmit={(event) => event.preventDefault()}
            aria-label="Filter security updates"
          >
            <label className={styles.searchField}>
              Search all columns
              <input
                type="search"
                value={filters.search}
                onChange={(event) => setFilter('search', event.target.value)}
                placeholder="Issue ID, CVE, version, or details"
              />
            </label>

            <label>
              Issue ID / CVE
              <input
                type="search"
                value={filters.issueId}
                onChange={(event) => setFilter('issueId', event.target.value)}
                placeholder="MMSA or CVE"
              />
            </label>

            <label>
              Severity
              <select
                value={filters.severity}
                onChange={(event) => setFilter('severity', event.target.value)}
              >
                <option value="">All severities</option>
                {SEVERITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Affected version
              <input
                value={versionDraft}
                onChange={(event) => setVersionDraft(event.target.value)}
                placeholder="e.g. 10.11"
                autoComplete="off"
                spellCheck={false}
              />
            </label>

            <label>
              Released from
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(event) => setFilter('dateFrom', event.target.value)}
                aria-invalid={Boolean(dateOrderError)}
                aria-describedby={dateOrderError ? filterErrorId : undefined}
              />
            </label>

            <label>
              Released to
              <input
                type="date"
                value={filters.dateTo}
                onChange={(event) => setFilter('dateTo', event.target.value)}
                aria-invalid={Boolean(dateOrderError)}
                aria-describedby={dateOrderError ? filterErrorId : undefined}
              />
            </label>

            <label>
              Fix versions
              <input
                type="search"
                value={filters.fixVersions}
                onChange={(event) => setFilter('fixVersions', event.target.value)}
                placeholder="e.g. 10.11.23"
              />
            </label>

            <div className={styles.filterActions}>
              <p className={styles.hint}>
                Shows advisories whose affected range includes this version. Use 10.11 to match the
                10.11 line, or 10.11.23 for that exact patch.
              </p>
              <button
                type="button"
                className={styles.resetButton}
                onClick={clearFilters}
                disabled={!hasActiveFilters}
              >
                Clear filters
              </button>
            </div>
            {filterError ? (
              <p className={styles.filterError} id={filterErrorId} role="alert">
                {filterError}
              </p>
            ) : null}
          </form>

          <div className={styles.toolbar}>
            <label className={styles.pageSize}>
              Rows
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number.parseInt(event.target.value, 10) || 25)}
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <p className={styles.summary} role="status">
              {filteredRows.length === 0
                ? 'No matching advisories'
                : `Showing ${(currentPage - 1) * pageSize + 1}–${(currentPage - 1) * pageSize + pageRows.length} of ${filteredRows.length}`}
            </p>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table} aria-label={`${TAB_ORDER.find((tab) => tab.id === activeTab)?.label} security updates`}>
              <thead>
                <tr>
                  <th scope="col" {...sortProps('issueId')}>
                    {renderSortButton('issueId', 'Issue ID')}
                  </th>
                  <th scope="col" {...sortProps('severity')}>
                    {renderSortButton('severity', 'Severity')}
                  </th>
                  <th scope="col" {...sortProps('affectedVersions')}>
                    {renderSortButton('affectedVersions', 'Affected versions')}
                  </th>
                  <th scope="col" {...sortProps('releaseDate')}>
                    {renderSortButton('releaseDate', 'Release date')}
                  </th>
                  <th scope="col" {...sortProps('fixVersions')}>
                    {renderSortButton('fixVersions', 'Fix versions')}
                  </th>
                  <th scope="col" {...sortProps('details')}>
                    {renderSortButton('details', 'Details')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={styles.empty}>
                      No security updates match these filters.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row) => (
                    <tr key={rowKey(row)}>
                      <td data-label="Issue ID">
                        <span className={styles.issueId}>{row.issueId}</span>
                        {row.cveId ? (
                          <a
                            className={styles.cve}
                            href={`https://nvd.nist.gov/vuln/detail/${row.cveId}`}
                            rel="noopener noreferrer"
                          >
                            {row.cveId}
                          </a>
                        ) : null}
                      </td>
                      <td data-label="Severity">
                        <span
                          className={`${styles.badge} ${
                            styles[`badge${row.severity.replace(/[^A-Za-z]/g, '')}` as keyof typeof styles] ||
                            styles.badgeNA
                          }`}
                        >
                          {row.severity}
                        </span>
                      </td>
                      <td data-label="Affected versions">
                        <VersionList lines={row.affectedVersions} />
                      </td>
                      <td data-label="Release date">{row.releaseDate || '—'}</td>
                      <td data-label="Fix versions">
                        <VersionList lines={row.fixVersions} />
                      </td>
                      <td data-label="Details">{row.details || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <nav className={styles.pagination} aria-label="Security updates pages">
              <ol>
                {buildPagination(currentPage, totalPages).map((item, index) => (
                  <li key={`${item}-${index}`}>
                    {item === '…' ? (
                      <span className={styles.ellipsis}>…</span>
                    ) : (
                      <button
                        type="button"
                        className={item === currentPage ? styles.pageActive : undefined}
                        aria-label={`Page ${item}`}
                        aria-current={item === currentPage ? 'page' : undefined}
                        onClick={() => setPage(item)}
                      >
                        {item}
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          )}
        </>
      )}
      </div>
    </div>
  );
}
