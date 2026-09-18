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
  body?: string;
  bullets?: string[];
  icon?: IconName;
  to?: string;
  /** Optional logo strip rendered below the body (used by Deployment cards in the mission variant). */
  logos?: Logo[];
};

/** A non-clickable intro column (left-most in Application / Interoperability / Deployment layers). */
export type Intro = {
  title: string;
  body?: string;
  icon?: IconName;
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
