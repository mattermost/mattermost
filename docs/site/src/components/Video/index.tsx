import React, {useEffect, useId, useState} from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

type Props = {
  /** Site-absolute path under `static/`, e.g. `/images/send-a-message.mp4`. Pass through `useBaseUrl()`. */
  src: string;
  /** Accessible name. When converting a GIF, keep the original alt text. */
  alt: string;
  /** Max rendered width in px. Defaults to 720. */
  width?: number;
  /** CSS `aspect-ratio` for the player box, e.g. `'1280 / 720'`. */
  aspectRatio?: string;
};

/**
 * Silent looping screen capture (GIF replacement).
 *
 * Muted autoplay + loop after hydration when motion is allowed; off for SSR
 * and `prefers-reduced-motion`. Native `controls` cover WCAG 2.2.2.
 */
export default function Video({
  src,
  alt,
  width = 720,
  aspectRatio,
}: Props): React.ReactElement {
  const url = useBaseUrl(src);
  const labelId = useId();
  const [motionOk, setMotionOk] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      setMotionOk(!query.matches);
    };
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  return (
    <div className={styles.wrapper} style={{maxWidth: `${width}px`}}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- silent; name via aria-labelledby */}
      <video
        className={styles.video}
        src={url}
        controls
        autoPlay={motionOk}
        loop={motionOk}
        muted
        playsInline
        preload="metadata"
        aria-labelledby={labelId}
        style={aspectRatio ? {aspectRatio} : undefined}
      >
        <a href={url}>{alt}</a>
      </video>
      <span id={labelId} className={styles.srOnly} aria-hidden="true">
        {alt}
      </span>
    </div>
  );
}
