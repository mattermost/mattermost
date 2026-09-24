/**
 * Data schema for the Intelligent Mission Environment diagram.
 *
 * The diagram is deliberately content-driven: the React component in
 * `index.tsx` is a pure renderer, and each audience/SKU lives as its
 * own content module under `content/`. To add a new variant, create a
 * new file that exports an `IMEContent` object — no JSX required.
 */

/** Icon key that must exist in `icons.tsx`. */
export type IconName =
  | 'chat'
  | 'checklist'
  | 'call'
  | 'target'
  | 'sparkles'
  | 'shield'
  | 'code'
  | 'server'
  | 'compass'
  | 'layers'
  | 'plug'
  | 'globe'
  | 'devices'
  | 'video'
  | 'users'
  | 'star'
  | 'lock'
  | 'network';

/** A single brand mark rendered inside a logo strip. */
export type Logo = {
  alt: string;
  /** Optional image path (typically under `/img/logos/`). Falls back to a text badge when omitted. */
  src?: string;
};

/** A clickable card. `to` is optional so non-navigational cards can render as plain panels. */
export type Cell = {
  title: string;
  /**
   * Optional leading term rendered underlined immediately before `body`
   * (e.g. "Channels" in "Channels: ChatOps and automation"). Mirrors
   * the deck's convention of underlining the product name inside each
   * Applications tile.
   */
  bodyLead?: string;
  body?: string;
  bullets?: string[];
  /** Named icon rendered as SVG (from `icons.tsx`). */
  icon?: IconName;
  /** Image icon path (e.g. `/img/ime/logos/icon-chat.png`). Takes precedence over `icon` when set. */
  iconSrc?: string;
  to?: string;
  /** Logo strip rendered below the body. Layout controlled by `logoLayout`. */
  logos?: Logo[];
  /**
   * How to arrange the `logos` array below the body.
   * - `'strip'` (default): wrap horizontally in reading order.
   * - `'grid'`: fixed-column CSS grid (see `logoColumns`).
   */
  logoLayout?: 'strip' | 'grid';
  /** Column count when `logoLayout === 'grid'`. Defaults to 3. */
  logoColumns?: number;
  /**
   * How to arrange the cell body relative to the logo grid.
   * - `'stack'` (default): logos render below the bullets/body text.
   * - `'side-by-side'`: bullets/body on the left, logos on the right.
   *   Used by Layered Extensibility on the entadv variant so the
   *   ecosystem grid sits next to the bullet list rather than under
   *   it, matching the source slide.
   */
  bodyLayout?: 'stack' | 'side-by-side';
  /**
   * Extra logo constellation absolutely positioned in the top-right
   * corner of the cell. Used for the AI-vendor icons on the
   * Enterprise-to-Edge card in the entadv variant.
   */
  cornerLogos?: Logo[];
};

/** A non-clickable intro column (left-most in Application / Interoperability / Deployment layers). */
export type Intro = {
  title: string;
  body?: string;
  icon?: IconName;
  iconSrc?: string;
  /** Optional logo constellation shown below the intro title (mirrors the deck's decorative badge rows). */
  logos?: Logo[];
};

/** A footer strip inside a layer (e.g. "Web, Desktop, Mobile & MS Teams"). */
export type FooterStrip = {
  text: string;
  icon?: IconName;
  to?: string;
  logos?: Logo[];
};

/** One row of the diagram. `cells` are the tiles; `intro` (if set) renders as the left column. */
export type Layer = {
  id: string;
  label: string;
  intro?: Intro;
  cells: Cell[];
  footers?: FooterStrip[];
  /** Column count for the primary cell grid. Defaults to `cells.length` when omitted. */
  columns?: number;
  /**
   * Explicit `grid-template-columns` value for the cell grid — e.g.
   * `'1.2fr 1fr 0.85fr'` for uneven card widths. Overrides `columns`
   * when set.
   */
  columnsTemplate?: string;
};

/** Top-level content for one variant of the diagram. */
export type IMEContent = {
  id: string;
  title?: string;
  tagline?: string;
  layers: Layer[];
};

/** Registry entry used by the audience toggle. */
export type Variant = {
  id: string;
  label: string;
  content: IMEContent;
};
