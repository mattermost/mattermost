// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// mm_blocks — canonical block schema for the Interactive Messages framework.
// The server treats mm_blocks as opaque data; all validation and rendering is client-side.
//
// Native payloads use `props.mm_blocks` as a `MmBlock[]`. Each interactive control carries its
// own dispatch data: post actions use `action_id` (and optional `value` / `query`); client-side URL
// opens use `url`. Optional per-control `query` is sent in the post-action API body alongside
// `selected_option`, `cookie`, and `integration_format` (e.g. `mm_block`).
//
// Cookie handling:
// - Native mm_blocks: the client sends `props.mm_blocks_actions` (string) as the post-action cookie.
// - Legacy attachments translated into mm_blocks: each control may carry `cookie` copied from
//   `props.attachments[].actions[].cookie` (encrypted PostAction cookie per button/select).
//
// Legacy bundled `{ blocks, actions }` inside `mm_blocks` and top-level `mm_actions` are merged
// into controls client-side when still present.

export type MmButtonStyle = 'default' | 'primary' | 'danger';

// ---------------------------------------------------------------------------
// Interactive controls
// ---------------------------------------------------------------------------

export type MmStaticSelectOption = {
    text: string;
    value: string;
};

export type MmButtonBlock = {
    type: 'button';
    text: string;
    action_id: string;
    style?: MmButtonStyle;
    tooltip?: string;
    disabled?: boolean;
    query?: Record<string, string>;

    /**
     * Legacy attachment actions only: encrypted cookie from `attachments[].actions[].cookie`.
     * Omitted for native mm_blocks (use post `mm_blocks_actions` instead).
     */
    cookie?: string;
};

export type MmStaticSelectBlock = {
    type: 'static_select';
    action_id: string;
    query?: Record<string, string>;
    placeholder: string;
    options?: MmStaticSelectOption[];
    initial_option?: string;
    disabled?: boolean;
    data_source?: string;

    /**
     * Legacy attachment actions only: encrypted cookie from `attachments[].actions[].cookie`.
     * Omitted for native mm_blocks (use post `mm_blocks_actions` instead).
     */
    cookie?: string;
};

// ---------------------------------------------------------------------------
// Top-level block types
// ---------------------------------------------------------------------------

export type MmTextSize = 'small' | 'default';

export type MmTextBlock = {
    type: 'text';
    text: string;

    /** Muted color only; does not change font size. */
    is_subtle?: boolean;

    /** Typography scale; omitted is equivalent to `default`. */
    size?: MmTextSize;
};

/**
 * Rich image block — combines ideas from Block Kit `image` and Adaptive Cards `Image`.
 *
 * Block Kit: `image_url` → `url`, `alt_text`, optional `title` (plain text).
 * Adaptive Cards: `url`, `altText` → `alt_text`, `size`, `style`, `horizontalAlignment`, explicit `width`/`height`.
 */
export type MmImageSize = 'auto' | 'small' | 'medium' | 'large' | 'stretch';

export type MmImageBlock = {
    type: 'image';

    /** Adaptive Cards `url` / Block Kit `image_url`. */
    url: string;

    /** Block Kit `alt_text` / Adaptive Cards `altText`. */
    alt_text: string;

    /** Block Kit image `title` (plain text); surfaced as the HTML `title` attribute. */
    title?: string;

    /**
     * Adaptive Cards `size`. `stretch` matches legacy attachment `image_url` bounds (500×300 max).
     * Omitted defaults to `stretch`.
     */
    size?: MmImageSize;

    /** Pixel max width (Adaptive Cards `width` when expressed as px). */
    max_width?: number;

    /** Pixel max height (Adaptive Cards `height` when expressed as px). */
    max_height?: number;

    /** Adaptive Cards `style` (`person` = avatar-style crop). */
    image_style?: 'default' | 'person';

    /** Adaptive Cards `horizontalAlignment`. */
    horizontal_alignment?: 'left' | 'center' | 'right';
};

export type MmDividerBlock = {
    type: 'divider';
};

export type MmColumnBlock = {
    type: 'column';
    items: MmBlock[];
    width?: 'auto' | 'stretch';
};

export type MmColumnSetBlock = {
    type: 'column_set';
    columns: MmColumnBlock[];
};

/** Spacing between child blocks inside a container (CSS `gap`). Defaults to `none` when omitted. */
export type MmContainerGap = 'none' | 'small' | 'medium' | 'big';

export type MmContainerBlock = {
    type: 'container';
    content: MmBlock[];

    /** Optional full container border; independent of `accent_color` */
    border?: boolean;

    /**
     * `border-left-color`: hex/rgb/`var(--…)` string for inline style, or named token `good` | `warning` | `danger` for legacy attachment classes.
     * Attachments translator sets a default when the payload omits `color`.
     */
    accent_color?: string;

    flow?: 'horizontal' | 'vertical';

    /** Space between items in the container flex layout. Defaults to `none`. */
    gap?: MmContainerGap;
};

export type MmCollapsibleBlock = {
    type: 'collapsible';
    header: MmBlock[];
    content: MmBlock[];
    collapsed?: boolean;
};

export type MmScrollableHeight = 'small' | 'medium' | 'large';

export type MmScrollableBlock = {
    type: 'scrollable';
    content: MmBlock[];

    /** Scroll region maximum height; defaults to `medium` when omitted. */
    height?: MmScrollableHeight;
};

export type MmBlock =
    | MmTextBlock
    | MmImageBlock
    | MmDividerBlock
    | MmButtonBlock
    | MmStaticSelectBlock
    | MmColumnSetBlock
    | MmColumnBlock
    | MmContainerBlock
    | MmCollapsibleBlock
    | MmScrollableBlock;

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isMmBlockArray(v: unknown): v is MmBlock[] {
    return Array.isArray(v) && v.every(isMmBlock);
}

export function isMmBlock(v: unknown): v is MmBlock {
    if (typeof v !== 'object' || v === null) {
        return false;
    }
    if (!('type' in v) || typeof (v as Record<string, unknown>).type !== 'string') {
        return false;
    }
    return true;
}
