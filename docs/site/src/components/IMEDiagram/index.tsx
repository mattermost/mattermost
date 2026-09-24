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
  const isSideBySide = data.bodyLayout === 'side-by-side' && data.logos;
  const isTitleLeft = data.titlePlacement === 'left';

  const textBlock = (data.body || data.bullets || data.bodyLead) && (
    <div className={styles.cellText}>
      {(data.bodyLead || data.body) && (
        <span>
          {data.bodyLead && <u className={styles.bodyLead}>{data.bodyLead}</u>}
          {data.bodyLead && data.body ? ': ' : ''}
          {data.body}
        </span>
      )}
      {data.bullets && (
        <ul>
          {data.bullets.map((b) => <li key={b}>{b}</li>)}
        </ul>
      )}
    </div>
  );

  const logoBlock = data.logos && (
    <LogoStrip logos={data.logos} layout={data.logoLayout} columns={data.logoColumns} />
  );

  const corner = data.cornerLogos && (
    <div className={styles.cornerLogos} aria-hidden>
      {data.cornerLogos.map((logo) => (
        logo.src
          ? <Img key={logo.alt} src={logo.src} alt={logo.alt} className={styles.cornerLogo} />
          : <span key={logo.alt} className={styles.logoBadge}>{logo.alt}</span>
      ))}
    </div>
  );

  const title = <strong className={styles.cellTitle}>{data.title}</strong>;

  const body = isTitleLeft ? (
    <>
      {corner}
      <div className={styles.cellTitleSplit}>
        <div className={styles.cellTitleAside}>{title}</div>
        <div className={styles.cellBody}>
          {textBlock}
          {logoBlock}
        </div>
      </div>
    </>
  ) : (
    <>
      {corner}
      <CellIcon iconSrc={data.iconSrc} icon={data.icon} alt={data.title} />
      <div className={styles.cellBody}>
        {title}
        {isSideBySide ? (
          <div className={styles.cellSplit}>
            {textBlock}
            {logoBlock}
          </div>
        ) : (
          <>
            {textBlock}
            {logoBlock}
          </>
        )}
      </div>
    </>
  );

  const cls = `${styles.cell}${isTitleLeft ? ` ${styles.cellTitleLeft}` : ''}`;
  if (data.to) {
    return <Link to={data.to} className={cls}>{body}</Link>;
  }
  return <div className={`${cls} ${styles.cellStatic}`}>{body}</div>;
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

function LogoStrip({logos, layout, columns}: {logos: Logo[]; layout?: 'strip' | 'grid'; columns?: number}) {
  const isGrid = layout === 'grid';
  const cls = isGrid ? `${styles.logoStrip} ${styles.logoGrid}` : styles.logoStrip;
  const style = isGrid ? {['--ime-logo-cols' as string]: columns ?? 3} : undefined;
  return (
    <div className={cls} style={style} aria-label="Related brands">
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

  // `--ime-cols` drives grid-template-columns in the stylesheet so we
  // can override it in media queries without fighting inline style
  // specificity. `data-cols` lets the tablet breakpoint keep single-
  // column layers single-column instead of collapsing them to two.
  // When `columnsTemplate` is set (uneven widths), it takes precedence
  // via an explicit inline `grid-template-columns` value.
  const gridStyle: React.CSSProperties = layer.columnsTemplate
    ? {gridTemplateColumns: layer.columnsTemplate}
    : {['--ime-cols' as string]: cols};

  const cells = (
    <div
      className={styles.cellGrid}
      data-cols={layer.columnsTemplate ? 'custom' : cols}
      style={gridStyle}
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
  const [hideToggleFromUrl, setHideToggleFromUrl] = useState<boolean>(false);

  // Allow the PNG renderer (and deep links) to pick a variant via query
  // string: ?imeVariant=<id>&imeExport=1 hides the toggle for capture.
  // The URL variant seeds `activeId` once — from then on, `activeId` is
  // the single source of truth so tab clicks can override the URL
  // choice without the resolve chain snapping it back.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const v = params.get('imeVariant');
    if (v) setActiveId(v);
    if (params.get('imeExport') === '1') setHideToggleFromUrl(true);
  }, []);

  // Normalize every possible variant source (prop, state) through
  // `getVariant` so unknown IDs fall back to the default. `active` and
  // `aria-selected` share the same resolved variant, so the toggle can
  // never claim a tab that doesn't match the rendered diagram.
  const resolvedVariant = getVariant(variant ?? activeId);
  const active = content ?? resolvedVariant.content;

  // When the parent supplies `variant` or `content`, the diagram is
  // fully controlled — clicking the toggle would otherwise mutate
  // local state without changing what renders. Also hide the toggle
  // when there is only a single variant registered (nothing to switch
  // to). Force it off regardless of the `toggle` prop.
  const isControlled = Boolean(content || variant);
  const hasMultipleVariants = variants.length > 1;
  const showToggle = !isControlled && !hideToggleFromUrl && hasMultipleVariants && (toggle ?? true);

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
