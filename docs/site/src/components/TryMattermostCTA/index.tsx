import React from 'react';
import styles from './styles.module.css';

const DEFAULT_HREF =
  'https://mattermost.com/sign-up/?utm_source=docs&utm_medium=referral&utm_campaign=for-evaluators';

type Props = {
  /** Override the sign-up URL (use for use-case deep links). */
  href?: string;
  label?: string;
  children?: React.ReactNode;
};

/** Button that starts the hosted 1-hour cloud preview on mattermost.com. */
export default function TryMattermostCTA({
  href = DEFAULT_HREF,
  label = 'Start 1-hour cloud preview',
  children,
}: Props): React.ReactElement {
  return (
    <p className={styles.wrap}>
      <a className={styles.button} href={href} rel="noopener noreferrer">
        {children ?? label}
      </a>
    </p>
  );
}
