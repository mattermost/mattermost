import React from 'react';
import styles from './styles.module.css';

type Kind = 'note' | 'tip' | 'important' | 'warning' | 'security';

const COPY: Record<Kind, {label: string; icon: string}> = {
  note:      {label: 'Note',      icon: 'i'},
  tip:       {label: 'Tip',       icon: '+'},
  important: {label: 'Important', icon: '!'},
  warning:   {label: 'Warning',   icon: '!'},
  security:  {label: 'Security',  icon: 'S'},
};

export default function Callout({
  kind = 'note',
  title,
  children,
}: {
  kind?: Kind;
  title?: string;
  children: React.ReactNode;
}) {
  const meta = COPY[kind];
  return (
    <aside className={`${styles.callout} ${styles[kind]}`} role="note">
      <div className={styles.bar} aria-hidden>
        <span className={styles.icon}>{meta.icon}</span>
      </div>
      <div className={styles.body}>
        <div className={styles.label}>{title ?? meta.label}</div>
        <div className={styles.content}>{children}</div>
      </div>
    </aside>
  );
}

// Convenience wrappers used like <Note>...</Note> in MDX.
export const Note      = (p: {title?: string; children: React.ReactNode}) => <Callout kind="note"      {...p} />;
export const Tip       = (p: {title?: string; children: React.ReactNode}) => <Callout kind="tip"       {...p} />;
export const Important = (p: {title?: string; children: React.ReactNode}) => <Callout kind="important" {...p} />;
export const Warning   = (p: {title?: string; children: React.ReactNode}) => <Callout kind="warning"   {...p} />;
export const Security  = (p: {title?: string; children: React.ReactNode}) => <Callout kind="security"  {...p} />;
