import React, {useCallback, useEffect, useRef, useState} from 'react';
import styles from './styles.module.css';

type VersionParts = {major: number; minor: number};
type RowRef = {row: HTMLTableRowElement; version: string};

function sortVersions(versions: string[]): string[] {
  return [...versions].sort((a, b) => {
    const [majorA, minorA] = a.split('.').map(Number);
    const [majorB, minorB] = b.split('.').map(Number);
    if (majorA !== majorB) {
      return majorB - majorA;
    }
    return minorB - minorA;
  });
}

function parseVersion(version: string): VersionParts {
  if (version === 'all') {
    return {major: 0, minor: 0};
  }
  const [major, minor] = version.split('.').map(Number);
  return {major, minor};
}

function isVersionRelevant(
  version: string,
  sourceVersion: string,
  targetVersion: string,
): boolean {
  const rowV = parseVersion(version);
  const sourceV = parseVersion(sourceVersion);
  const targetV = parseVersion(targetVersion);

  return (
    (sourceVersion === 'all' ||
      rowV.major > sourceV.major ||
      (rowV.major === sourceV.major && rowV.minor >= sourceV.minor)) &&
    (targetVersion === 'all' ||
      rowV.major < targetV.major ||
      (rowV.major === targetV.major && rowV.minor <= targetV.minor))
  );
}

function collectRows(table: HTMLTableElement): {rows: RowRef[]; versions: string[]} {
  const rows: RowRef[] = [];
  const versions: string[] = [];
  let lastVersion: string | null = null;

  table.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach((tr) => {
    const cells = tr.querySelectorAll('td');
    if (cells.length > 1) {
      const versionText = cells[0].textContent?.trim() ?? '';
      const versionMatch = versionText.match(/^v(\d+\.\d+)$/);
      if (versionMatch) {
        const version = versionMatch[1];
        if (!versions.includes(version)) {
          versions.push(version);
        }
        lastVersion = version;
        rows.push({row: tr, version});
        return;
      }
    }

    if (lastVersion && cells.length >= 1) {
      rows.push({row: tr, version: lastVersion});
    }
  });

  rows.forEach(({row, version}) => {
    row.dataset.version = version;
  });

  return {rows, versions: sortVersions(versions)};
}

function findUpgradeNotesTable(): HTMLTableElement | null {
  return document.querySelector<HTMLTableElement>('.upgrade-notes-table');
}

export default function UpgradeNotesFilter() {
  const rowsRef = useRef<RowRef[]>([]);
  const [versions, setVersions] = useState<string[]>([]);
  const [sourceVersion, setSourceVersion] = useState('all');
  const [targetVersion, setTargetVersion] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const initializeRows = useCallback(() => {
    const table = findUpgradeNotesTable();
    if (!table || table.querySelectorAll('tbody tr').length === 0) {
      return false;
    }

    const {rows, versions: foundVersions} = collectRows(table);
    if (rows.length === 0 || foundVersions.length === 0) {
      return false;
    }

    rowsRef.current = rows;
    setVersions(foundVersions);
    setReady(true);
    return true;
  }, []);

  useEffect(() => {
    if (initializeRows()) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      if (initializeRows()) {
        window.clearInterval(timer);
      }
    }, 100);

    return () => window.clearInterval(timer);
  }, [initializeRows]);

  const showAllRows = () => {
    rowsRef.current.forEach(({row}) => row.classList.remove('filtered'));
  };

  const applyFilter = () => {
    setError(null);

    if (!ready || rowsRef.current.length === 0) {
      if (!initializeRows()) {
        setError('Error: Upgrade notes table is still loading. Try again in a moment.');
        return;
      }
    }

    if (sourceVersion === 'all' && targetVersion === 'all') {
      showAllRows();
      return;
    }

    const sourceV = parseVersion(sourceVersion);
    const targetV = parseVersion(targetVersion);

    if (
      targetV.major < sourceV.major ||
      (targetV.major === sourceV.major && targetV.minor < sourceV.minor)
    ) {
      setError('Error: Target version must be greater than or equal to source version.');
      return;
    }

    const versionVisibility = new Map<string, boolean>();
    versions.forEach((version) => {
      versionVisibility.set(
        version,
        isVersionRelevant(version, sourceVersion, targetVersion),
      );
    });

    rowsRef.current.forEach(({row, version}) => {
      row.classList.toggle('filtered', !versionVisibility.get(version));
    });
  };

  const resetFilter = () => {
    setSourceVersion('all');
    setTargetVersion('all');
    setError(null);
    showAllRows();
  };

  return (
    <div className={styles.filters}>
      <h3 className={styles.title}>Filter Upgrade Notes</h3>
      <p className={styles.description}>
        Select source and target versions to see only relevant upgrade notes
      </p>
      <div className={styles.controls}>
        <label className={styles.field} htmlFor="source-version">
          From version:
          <select
            id="source-version"
            value={sourceVersion}
            onChange={(event) => setSourceVersion(event.target.value)}
            disabled={!ready}>
            <option value="all">All versions</option>
            {versions.map((version) => (
              <option key={`source-${version}`} value={version}>
                v{version}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field} htmlFor="target-version">
          To version:
          <select
            id="target-version"
            value={targetVersion}
            onChange={(event) => setTargetVersion(event.target.value)}
            disabled={!ready}>
            <option value="all">All versions</option>
            {versions.map((version) => (
              <option key={`target-${version}`} value={version}>
                v{version}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className={styles.applyButton}
          onClick={applyFilter}
          disabled={!ready}>
          Apply Filter
        </button>
        <button type="button" className={styles.resetButton} onClick={resetFilter}>
          Reset
        </button>
      </div>
      {error ? <div className={styles.error}>{error}</div> : null}
    </div>
  );
}
