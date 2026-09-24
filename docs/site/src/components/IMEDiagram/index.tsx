import React, {useEffect, useState} from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';
import type {Cell as CellData, FooterStrip, IconName, IMEContent, Intro, Layer, Logo} from './types';
import {getIcon} from './icons';
import {getVariant, variants} from './content';

/**
 * Interactive Intelligent Mission Environment (IME) diagram.
 *
 * The visual is a pure function of an `IMEContent` object; all copy,
 * icons, and structure live in `content/*.ts`. The default export is a
 * small wrapper that adds an audience toggle so visitors can switch
 * between variants at read time.
 */

/**
 * `<img>` wrapper that resolves `src` against Docusaurus' configured
 * `baseUrl`, so mission assets keep working when the site is deployed
 * under a subpath (e.g. staging previews) rather than the domain root.
 */
function Img({src, alt, className}: {src: string; alt: string; className?: string}) {
  return <img src={useBaseUrl(src)} alt={alt} className={className} />;
}

function CellIcon({iconSrc, icon, alt}: {iconSrc?: string; icon?: IconName; alt?: string}) {
  if (iconSrc) {
    return <span className={`${styles.icon} ${styles.iconImg}`} aria-hidden><Img src={iconSrc} alt={alt ?? ''} /></span>;
  }
  const svg = getIcon(icon);
  if (!svg) return null;
  return <span className={styles.icon} aria-hidden>{svg}</span>;
}

function Cell({data}: {data: CellData}) {
  const body = (
    <>
      <CellIcon iconSrc={data.iconSrc} icon={data.icon} alt={data.title} />
      <div className={styles.cellBody}>
        <strong className={styles.cellTitle}>{data.title}</strong>
        {(data.body || data.bullets) && (
          <div className={styles.cellText}>
            {data.body}
            {data.bullets && (
              <ul>
                {data.bullets.map((b) => <li key={b}>{b}</li>)}
              </ul>
            )}
          </div>
        )}
        {data.logos && <LogoStrip logos={data.logos} />}
      </div>
    </>
  );

  if (data.to) {
    return <Link to={data.to} className={styles.cell}>{body}</Link>;
  }
  return <div className={`${styles.cell} ${styles.cellStatic}`}>{body}</div>;
}

function IntroPanel({data}: {data: Intro}) {
  return (
    <div className={styles.intro}>
      <h3>
        {data.iconSrc
          ? <span className={`${styles.introIcon} ${styles.introIconImg}`}><Img src={data.iconSrc} alt="" /></span>
          : (getIcon(data.icon) && <span className={styles.introIcon}>{getIcon(data.icon)}</span>)}
        {data.title}
      </h3>
      {data.body && <p>{data.body}</p>}
      {data.logos && <LogoStrip logos={data.logos} />}
    </div>
  );
}

function LogoStrip({logos}: {logos: Logo[]}) {
  return (
    <div className={styles.logoStrip} aria-label="Related brands">
      {logos.map((logo) => (
        logo.src
          ? <Img key={logo.alt} src={logo.src} alt={logo.alt} className={styles.logoImg} />
          : <span key={logo.alt} className={styles.logoBadge}>{logo.alt}</span>
      ))}
    </div>
  );
}

function FooterCell({data}: {data: FooterStrip}) {
  const icon = getIcon(data.icon);
  const inner = (
    <>
      {icon && <span className={styles.footerIcon}>{icon}</span>}
      <span>{data.text}</span>
      {data.logos && <LogoStrip logos={data.logos} />}
    </>
  );
  if (data.to) {
    return <Link to={data.to} className={styles.footerCell}>{inner}</Link>;
  }
  return <div className={`${styles.footerCell} ${styles.footerCellStatic}`}>{inner}</div>;
}

function LayerBlock({layer}: {layer: Layer}) {
  const cols = layer.columns ?? layer.cells.length;

  const cells = (
    // `--ime-cols` drives grid-template-columns in the stylesheet so we
    // can override it in media queries without fighting inline style
    // specificity. `data-cols` lets the tablet breakpoint keep single-
    // column layers single-column instead of collapsing them to two.
    <div
      className={styles.cellGrid}
      data-cols={cols}
      style={{['--ime-cols' as string]: cols}}
    >
      {layer.cells.map((c) => <Cell key={c.title} data={c} />)}
    </div>
  );

  // With intro: two-column layout (intro | cells). Without: cells span full width.
  const body = layer.intro ? (
    <div className={styles.layerContentWithIntro}>
      <IntroPanel data={layer.intro} />
      {cells}
    </div>
  ) : cells;

  return (
    <div className={`${styles.layer} ${styles[`layer_${layer.id}`] || ''}`}>
      <div className={styles.layerLabel}>{layer.label}</div>
      <div className={styles.layerBody}>
        {body}
        {layer.footers && (
          <div
            className={styles.footerRow}
            data-cols={layer.footers.length}
            style={{['--ime-cols' as string]: layer.footers.length}}
          >
            {layer.footers.map((f) => <FooterCell key={f.text} data={f} />)}
          </div>
        )}
      </div>
    </div>
  );
}

export type IMEDiagramProps = {
  /** Variant id from `content/index.ts`. Ignored when `content` is passed. */
  variant?: string;
  /** Override the entire content model — useful for tests and the PNG renderer. */
  content?: IMEContent;
  /** Show/hide the audience toggle. Ignored (forced false) when `variant` or `content` is set. */
  toggle?: boolean;
};

/**
 * Renders a single IME variant. When neither `variant` nor `content`
 * is passed, an audience toggle is shown above the diagram.
 */
export default function IMEDiagram({variant, content, toggle}: IMEDiagramProps) {
  const [activeId, setActiveId] = useState<string>(variant ?? variants[0].id);
  const [urlOverride, setUrlOverride] = useState<{variant?: string; hideToggle?: boolean}>({});

  // Allow the PNG renderer (and deep links) to pick a variant via query
  // string: ?imeVariant=<id>&imeExport=1 hides the toggle for capture.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const v = params.get('imeVariant') ?? undefined;
    const hide = params.get('imeExport') === '1';
    if (v || hide) {
      setUrlOverride({variant: v, hideToggle: hide});
      if (v) setActiveId(v);
    }
  }, []);

  // Normalize every possible variant source (prop, URL, state) through
  // `getVariant` so unknown IDs fall back to the default. `active` and
  // `aria-selected` share the same resolved variant, so the toggle can
  // never claim a tab that doesn't match the rendered diagram.
  const resolvedVariant = getVariant(variant ?? urlOverride.variant ?? activeId);
  const active = content ?? resolvedVariant.content;

  // When the parent supplies `variant` or `content`, the diagram is
  // fully controlled — clicking the toggle would otherwise mutate
  // local state without changing what renders. Also hide the toggle
  // when there is only a single variant registered (nothing to switch
  // to). Force it off regardless of the `toggle` prop.
  const isControlled = Boolean(content || variant);
  const hasMultipleVariants = variants.length > 1;
  const showToggle = !isControlled && !urlOverride.hideToggle && hasMultipleVariants && (toggle ?? true);

  return (
    <div className={styles.wrapper}>
      {showToggle && (
        <div className={styles.toggleRow} role="tablist" aria-label="Diagram audience">
          {variants.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={resolvedVariant.id === v.id}
              className={`${styles.toggleButton} ${resolvedVariant.id === v.id ? styles.toggleButtonActive : ''}`}
              onClick={() => setActiveId(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}
      <section
        className={styles.diagram}
        data-variant={active.id}
        data-ready="true"
        aria-label={`${active.title ?? 'Intelligent Mission Environment'} overview`}
      >
        {(active.title || active.tagline) && (
          <BannerHeader title={active.title} tagline={active.tagline} />
        )}
        {active.layers.map((layer) => <LayerBlock key={layer.id} layer={layer} />)}
      </section>
    </div>
  );
}

function BannerHeader({title, tagline}: {title?: string; tagline?: string}) {
  const bgUrl = useBaseUrl('/img/ime/banner-bg.jpg');
  return (
    <header className={styles.banner} style={{backgroundImage: `url(${bgUrl})`}}>
      <div className={styles.bannerInner}>
        {title && <h2 className={styles.bannerTitle}>{title}</h2>}
        {tagline && <p className={styles.bannerTagline}>{tagline}</p>}
      </div>
    </header>
  );
}
