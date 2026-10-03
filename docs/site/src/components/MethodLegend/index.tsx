import React from 'react';
import MethodBadge from '@site/src/components/MethodBadge';
import styles from './styles.module.css';

const METHODS: Array<{verb: string; meaning: string}> = [
  {verb: 'GET',    meaning: 'Read'},
  {verb: 'POST',   meaning: 'Create / action'},
  {verb: 'PUT',    meaning: 'Replace'},
  {verb: 'PATCH',  meaning: 'Update fields'},
  {verb: 'DELETE', meaning: 'Remove'},
];

/**
 * Inline legend that decodes the HTTP method colors used throughout
 * the API sidebar and endpoint pages. Most readers internalize these
 * fast — but the first 30 seconds on the API landing matter, and the
 * legend collapses that ramp.
 */
export default function MethodLegend() {
  return (
    <ul className={styles.legend}>
      {METHODS.map((m) => (
        <li key={m.verb} className={styles.item}>
          <MethodBadge method={m.verb} size="md" />
          <span className={styles.meaning}>{m.meaning}</span>
        </li>
      ))}
    </ul>
  );
}
