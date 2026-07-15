import React, {useEffect, useRef, useState} from 'react';
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

function collectRows(table: HTMLTableElement): {rows: RowRef[]; versions: string[]} {
  const rows: RowRef[] = [];
  const versions: string[] = [];
  let lastVersion: string | null = null;

  table.querySelectorAll('tbody tr').forEach((tr) => {
    const cells = tr.querySelectorAll('td');
    if (cells.length > 1) {
      const versionText = cells[0].textContent?.trim() ?? '';
      const versionMatch = versionText.match(/v(\d+\.\d+)/);
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

export default function UpgradeNotesFilter() {
  const rowsRef = useRef<RowRef[]>([]);
  const [versions, setVersions] = useState<string[]>([]);
  const [sourceVersion, setSourceVersion] = useState('all');
  const [targetVersion, setTargetVersion] = useState('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const table = document.querySelector<HTMLTableElement>('.upgrade-notes-table');
    if (!table) {
      return;
    }

    const {rows, versions: foundVersions} = collectRows(table);
    rowsRef.current = rows;
    setVersions(foundVersions);
  }, []);

  const showAllRows = () => {
    rowsRef.current.forEach(({row}) => row.classList.remove('filtered'));
  };

  const applyFilter = () => {
    setError(null);

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

    rowsRef.current.forEach(({row, version}) => {
      const rowV = parseVersion(version);
      const isRelevant =
        (sourceVersion === 'all' ||
          rowV.major > sourceV.major ||
          (rowV.major === sourceV.major && rowV.minor >= sourceV.minor)) &&
        (targetVersion === 'all' ||
          rowV.major < targetV.major ||
          (rowV.major === targetV.major && rowV.minor <= targetV.minor));

      row.classList.toggle('filtered', !isRelevant);
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
            onChange={(event) => setSourceVersion(event.target.value)}>
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
            onChange={(event) => setTargetVersion(event.target.value)}>
            <option value="all">All versions</option>
            {versions.map((version) => (
              <option key={`target-${version}`} value={version}>
                v{version}
              </option>
            ))}
          </select>
        </label>

        <button type="button" className={styles.applyButton} onClick={applyFilter}>
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
