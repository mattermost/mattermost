import React from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

// Plan-availability and Academy badges. Replaces Sphinx's
//   .. include:: /_static/badges/<slug>.rst
// pattern. Slug values mirror the original badge filenames so the
// mechanical RST→MDX conversion is a 1:1 rewrite.

type PlanData = {
  kind: 'plan';
  text: string;
  linkText: string;
  href: string;
};

type AcademyData = {
  kind: 'academy';
  title: string;
  href: string;
};

const BADGES: Record<string, PlanData | AcademyData> = {
  // Plan-availability banners
  'all-commercial': {
    kind: 'plan',
    text: 'Available on',
    linkText: 'Entry, Professional, Enterprise, and Enterprise Advanced plans',
    href: 'https://mattermost.com/pricing/',
  },
  'ent-plus': {
    kind: 'plan',
    text: 'Available on',
    linkText: 'Enterprise and Enterprise Advanced plans',
    href: 'https://mattermost.com/pricing/',
  },
  'ent-adv': {
    kind: 'plan',
    text: 'Available on',
    linkText: 'Enterprise Advanced plans',
    href: 'https://mattermost.com/pricing/',
  },
  'ent-cloud-dedicated': {
    kind: 'plan',
    text: 'Available only on',
    linkText: 'Enterprise and Enterprise Advanced plans',
    href: 'https://mattermost.com/contact-sales/',
  },
  'entry-adv': {
    kind: 'plan',
    text: 'Available on',
    linkText: 'Entry and Enterprise Advanced plans',
    href: 'https://mattermost.com/pricing/',
  },
  'entry-ent': {
    kind: 'plan',
    text: 'Available on',
    linkText: 'Entry, Enterprise, and Enterprise Advanced plans (not available on Professional)',
    href: 'https://mattermost.com/pricing/',
  },
  'pro-plus': {
    kind: 'plan',
    text: 'Available on',
    linkText: 'Professional, Enterprise, and Enterprise Advanced plans',
    href: 'https://mattermost.com/pricing/',
  },

  // Academy callout cards
  'academy':                  {kind: 'academy', title: 'Free online training available',                                href: 'https://academy.mattermost.com'},
  'academy-calls':            {kind: 'academy', title: 'Learn about Mattermost Calls',                                  href: 'https://academy.mattermost.com/p/new-mattermost-copilot-multi-llm-setup-usage'},
  'academy-channels':         {kind: 'academy', title: 'Learn about Mattermost channels',                               href: 'https://mattermost.com/pl/mattermost-academy-channels-training'},
  'academy-copilot-calls':    {kind: 'academy', title: 'Learn about Mattermost Copilot and Calls',                      href: 'https://academy.mattermost.com/p/streamline-communication-with-mattermost-copilot-calls'},
  'academy-copilot-setup':    {kind: 'academy', title: 'Learn about setting up and configuring Mattermost Copilot with multiple LLMs', href: 'https://academy.mattermost.com/p/new-mattermost-copilot-multi-llm-setup-usage'},
  'academy-customize-ui':     {kind: 'academy', title: 'Learn what you can customize',                                  href: 'https://mattermost.com/pl/mattermost-academy-customization-training'},
  'academy-file-storage':     {kind: 'academy', title: 'Learn about file storage',                                      href: 'https://mattermost.com/pl/mattermost-academy-configure-file-storage-training'},
  'academy-mattermost-database': {kind: 'academy', title: 'Learn about setting up the Mattermost database',             href: 'https://mattermost.com/pl/mattermost-academy-database-configuration-training'},
  'academy-message-formatting': {kind: 'academy', title: 'Learn about message formatting',                              href: 'https://mattermost.com/pl/mattermost-academy-format-messages-training'},
  'academy-msteams':          {kind: 'academy', title: 'Learn about integrating with Microsoft Teams',                  href: 'https://academy.mattermost.com/p/new-mattermost-for-microsoft-teams-integration'},
  'academy-notifications':    {kind: 'academy', title: 'Learn about notifications',                                     href: 'https://mattermost.com/pl/mattermost-academy-notifications-training'},
  'academy-platform-overview':{kind: 'academy', title: 'Learn about Mattermost',                                        href: 'https://mattermost.com/pl/mattermost-academy-intro-training'},
  'academy-playbooks':        {kind: 'academy', title: 'Learn about Mattermost Playbooks',                              href: 'https://academy.mattermost.com/p/mattermost-playbooks-onboarding-training'},
  'academy-search':           {kind: 'academy', title: 'Learn about search',                                            href: 'https://mattermost.com/pl/mattermost-academy-search-training'},
  'academy-tarball-deployment':{kind: 'academy', title: 'Learn about deploying Mattermost using a tarball',             href: 'https://mattermost.com/pl/mattermost-academy-deploy-tarball-training'},
  'academy-tarball-upgrade':  {kind: 'academy', title: 'Learn about upgrading Mattermost using a tarball',              href: 'https://mattermost.com/pl/mattermost-academy-upgrade-tarball-training'},
  'academy-teams':            {kind: 'academy', title: 'Learn about teams',                                             href: 'https://academy.mattermost.com/p/new-mattermost-for-microsoft-teams-integration'},
};

export default function PlanAvailability({slug}: {slug: string}) {
  const flagSrc = useBaseUrl('/img/badges/flag-yellow.svg');
  const academySrc = useBaseUrl('/img/badges/academy-callout.jpg');
  const data = BADGES[slug];

  if (!data) {
    return (
      <div className={`${styles.badge} ${styles.unknown}`} role="note">
        Unknown plan-availability slug: <code>{slug}</code>
      </div>
    );
  }

  if (data.kind === 'plan') {
    return (
      <aside className={`${styles.badge} ${styles.plan}`} role="note">
        <img src={flagSrc} alt="" className={styles.flag} aria-hidden />
        <span>
          {data.text}{' '}
          <Link href={data.href}>{data.linkText}</Link>
          {data.text.endsWith('on') && !data.linkText.endsWith('plans') ? ' plans' : ''}
        </span>
      </aside>
    );
  }

  return (
    <Link href={data.href} className={`${styles.badge} ${styles.academy}`} target="_blank" rel="noopener">
      <img src={academySrc} alt="" className={styles.academyImg} aria-hidden />
      <div className={styles.academyCopy}>
        <span className={styles.academyAccent}>Mattermost Academy</span>
        <span className={styles.academyTitle}>{data.title}</span>
      </div>
    </Link>
  );
}
