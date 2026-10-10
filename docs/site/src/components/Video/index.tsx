import React, {useEffect, useId, useRef} from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

type Props = {
  /**
   * Site-absolute path to the MP4 under `static/`, e.g. `/images/send-a-message.mp4`.
   *
   * Wrap it in `useBaseUrl()` at the call site:
   *   <Video src={useBaseUrl('/images/send-a-message.mp4')} alt="…" />
   * A bare `src="/images/…"` string is rejected by `npm run check:base-url-attrs`,
   * which cannot tell a component prop from a raw `<img src>`. The extra
   * `useBaseUrl()` here is harmless — it is idempotent (it skips a baseUrl that is
   * already present) — and keeps the component correct at call sites the guard
   * does not scan.
   */
  src: string;
  /**
   * Text alternative. Becomes the video's accessible name. When converting a GIF,
   * carry the original `![alt](…)` text through verbatim — do not reword it.
   */
  alt: string;
  /** Maximum rendered width in px. Defaults to 720, the cap authored images get. */
  width?: number;
  /**
   * CSS `aspect-ratio` for the player box, e.g. `'1280 / 720'`. Optional but
   * recommended: without it the browser reserves a 300×150 box and reflows once
   * metadata arrives. The Phase 1 encode script knows the output dimensions and
   * should emit this.
   */
  aspectRatio?: string;
};

/**
 * Silent looping screen capture, replacing an animated GIF.
 *
 * Deliberately has **no `autoplay`** and **no `poster`**. The absence of autoplay is
 * what keeps these pages clear of WCAG 2.2.2 (pause/stop for motion lasting over five
 * seconds), which the GIFs it replaces could not satisfy at all; poster stills were
 * measured at 3.75 MB across the set to save a 1–2 second blank frame and were dropped
 * (29 Sep 2026). Do not add either.
 *
 * Usage:
 *   <Video
 *     src={useBaseUrl('/images/message-formatting-toolbar.mp4')}
 *     alt="The message formatting toolbar makes formatting message text fast and easy."
 *     width={700}
 *     aspectRatio="1280 / 720"
 *   />
 *
 * Add `import useBaseUrl from '@docusaurus/useBaseUrl';` directly below the frontmatter
 * in any page that does not already import it.
 */
export default function Video({
  src,
  alt,
  width = 720,
  aspectRatio,
}: Props): React.ReactElement {
  const url = useBaseUrl(src);
  const labelId = useId();
  const ref = useRef<HTMLVideoElement>(null);

  // Reduced motion drops the loop, not playback: nothing moves until the reader
  // presses play, so suppressing a deliberate action would be wrong — but an
  // endless repeat after one click is motion they did not ask for. Applied as a
  // DOM property after hydration because `matchMedia` does not exist during SSR.
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      if (ref.current) {
        ref.current.loop = !query.matches;
      }
    };
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  return (
    <div className={styles.wrapper} style={{maxWidth: `${width}px`}}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- silent video; the
          accessible name is supplied by aria-labelledby. See .planning/phase-2. */}
      <video
        ref={ref}
        className={styles.video}
        src={url}
        controls
        loop
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
