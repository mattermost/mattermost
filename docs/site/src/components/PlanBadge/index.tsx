import React from 'react';
import styles from './styles.module.css';

type Plan = 'free' | 'professional' | 'enterprise' | 'cloud' | 'self-hosted';

const META: Record<Plan, {label: string; tone: 'neutral' | 'accent' | 'inverse'}> = {
  'free':         {label: 'Free',         tone: 'neutral'},
  'professional': {label: 'Professional', tone: 'accent'},
  'enterprise':   {label: 'Enterprise',   tone: 'inverse'},
  'cloud':        {label: 'Cloud',        tone: 'neutral'},
  'self-hosted':  {label: 'Self-hosted',  tone: 'neutral'},
};

export default function PlanBadge({plan}: {plan: Plan}) {
  const m = META[plan];
  return <span className={`${styles.badge} ${styles[m.tone]}`}>{m.label}</span>;
}
