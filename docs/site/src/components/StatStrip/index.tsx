import React from 'react';
import styles from './styles.module.css';

type Stat = {
  value: string | number;
  label: string;
  hint?: string;
};

/**
 * Horizontal strip of headline numbers — used at the top of landing
 * pages to surface the size/scope of the section in a single glance.
 *
 * Usage:
 *   <StatStrip stats={[
 *     {value: '549', label: 'Endpoints'},
 *     {value: '38',  label: 'Resource groups'},
 *     {value: '5',   label: 'Languages',  hint: 'curl, PowerShell, Python, Node, Go'},
 *   ]} />
 */
export default function StatStrip({stats}: {stats: Stat[]}) {
  return (
    <ul className={styles.strip}>
      {stats.map((s) => (
        <li key={s.label} className={styles.stat}>
          <span className={styles.value}>{s.value}</span>
          <span className={styles.label}>{s.label}</span>
          {s.hint && <span className={styles.hint}>{s.hint}</span>}
        </li>
      ))}
    </ul>
  );
}
