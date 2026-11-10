import React from 'react';
import styles from './styles.module.css';

const METHODS: Array<{verb: string; tone: string; meaning: string}> = [
  {verb: 'GET',    tone: 'get',    meaning: 'Read'},
  {verb: 'POST',   tone: 'post',   meaning: 'Create / action'},
  {verb: 'PUT',    tone: 'put',    meaning: 'Replace'},
  {verb: 'PATCH',  tone: 'patch',  meaning: 'Update fields'},
  {verb: 'DELETE', tone: 'delete', meaning: 'Remove'},
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
          <span className={`${styles.badge} ${styles[m.tone]}`}>{m.verb}</span>
          <span className={styles.meaning}>{m.meaning}</span>
        </li>
      ))}
    </ul>
  );
}
