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
// Form input blocks (`text_input`, `select`, `bool_input`, etc.) identify fields by `name` and
// accumulate values for batch form submission (Interactive Dialog / Apps Form parity). Immediate
// post actions continue to use `action_id` on `button` (subtype `execute`, the default) and
// `static_select`. Buttons with subtype `submit` send typed form field values as `form_values`
// (forwarded on the upstream integration request under `context.form_values`); block `query` stays separate (URL params).
//
// Cookie handling:
// - Native mm_blocks: the client sends `props.mm_blocks_actions` (string) as the post-action cookie.
// - Legacy attachments translated into mm_blocks: each control may carry `cookie` copied from
//   `props.attachments[].actions[].cookie` (encrypted PostAction cookie per button/select).

/** Semantic attachment / integration action colors. Hex colors use the same `style` field (`#RRGGBB`). */
export type MmButtonStyle = 'default' | 'primary' | 'danger' | 'good' | 'success' | 'warning';

/**
 * Button behavior subtype.
 * - `execute` (default): immediate action via `action_id` (existing post-action behavior).
 * - `submit`: sends all form input values as typed `form_values` (forwarded under `context.form_values` on the upstream request).
 */
export type MmButtonSubtype = 'execute' | 'submit';

// ---------------------------------------------------------------------------
// Interactive controls (immediate-fire post actions)
// ---------------------------------------------------------------------------

export type MmStaticSelectOption = {
    text: string;
    value: string;
};

export type MmButtonBlock = {
    type: 'button';
    text: string;
    action_id: string;

    /** Omitted is equivalent to `execute`. */
    subtype?: MmButtonSubtype;

    /** Semantic name (`MmButtonStyle`) or `#RRGGBB` hex (legacy attachment parity). */
    style?: MmButtonStyle | string;
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
// Form input blocks (Interactive Dialog / Apps Form parity)
// ---------------------------------------------------------------------------

/**
 * Shared props for form input blocks. Field identity is `name` (submission key), matching
 * Interactive Dialog elements and Apps Form fields — not `action_id`.
 */
export type MmFormFieldProps = {
    name: string;

    /** Field label. Empty string hides the label (and required/optional markers) in the UI. */
    label: string;
    help_text?: string;
    optional?: boolean;
    disabled?: boolean;

    /** Action id to execute when the field value changes (e.g. form refresh). */
    onChange?: string;
};

export type MmTextInputSubtype = 'text' | 'email' | 'number' | 'password' | 'tel' | 'url';

/** Single- or multi-line text field. Dialog `text` / `textarea` both map here (`multiline` for textarea). */
export type MmTextInputBlock = MmFormFieldProps & {
    type: 'text_input';
    subtype?: MmTextInputSubtype;
    multiline?: boolean;
    min_length?: number;
    max_length?: number;
    placeholder?: string;
    initial_value?: string;
};

/** Checkbox. Dialog `bool`. */
export type MmBoolInputBlock = MmFormFieldProps & {
    type: 'bool_input';

    /** Hint text shown beside the checkbox (dialog `placeholder`). */
    placeholder?: string;
    initial_value?: boolean;
};

/**
 * Presentation for form `select` (Adaptive Cards `Input.ChoiceSet` style).
 * - `compact` (default): dropdown.
 * - `expanded`: radio list when single-select; checkbox list when `multiselect`.
 */
export type MmSelectInputStyle = 'compact' | 'expanded';

/** Grouped options for form `select` (Block Kit `option_groups` parity). */
export type MmSelectOptionGroup = {
    label: string;
    options: MmStaticSelectOption[];
};

/**
 * Form choice field with deferred submission. Dialog `select` / `radio`, Adaptive Cards
 * `Input.ChoiceSet`. Distinct from immediate-fire `static_select` (post actions).
 *
 * Provide either `options` or `option_groups`, not both (Block Kit rule).
 */
export type MmSelectInputBlock = MmFormFieldProps & {
    type: 'select';
    placeholder?: string;

    /** Omitted is equivalent to `compact`. */
    style?: MmSelectInputStyle;

    options?: MmStaticSelectOption[];
    option_groups?: MmSelectOptionGroup[];

    /** `users`, `channels`, `dynamic`, or a custom data source string. */
    data_source?: 'users' | 'channels' | 'dynamic' | string;

    /** Action id used to fetch options when `data_source` is `dynamic`. */
    data_source_action?: string;
    multiselect?: boolean;
    initial_option?: string;
    initial_options?: string[];
};

/** Date / datetime constraints (dialog `datetime_config`; no deprecated top-level aliases). */
export type MmDateTimeConfig = {
    min_date?: string;
    max_date?: string;
    time_interval?: number;
    location_timezone?: string;
    manual_time_entry?: boolean;
};

/** Date picker. Dialog `date`. */
export type MmDateInputBlock = MmFormFieldProps & {
    type: 'date_input';
    placeholder?: string;
    initial_value?: string;
    datetime_config?: MmDateTimeConfig;
};

/** Date and time picker. Dialog `datetime`. */
export type MmDateTimeInputBlock = MmFormFieldProps & {
    type: 'datetime_input';
    placeholder?: string;
    initial_value?: string;
    datetime_config?: MmDateTimeConfig;
};

/** File upload. Dialog `file`. */
export type MmFileInputBlock = MmFormFieldProps & {
    type: 'file_input';
    placeholder?: string;
    allow_multiple?: boolean;

    /** Comma-separated file IDs (dialog `default`). */
    initial_value?: string;
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
export type MmImageSize = 'auto' | 'xsmall' | 'small' | 'medium' | 'large' | 'stretch';

export type MmImageBlock = {
    type: 'image';

    /** Adaptive Cards `url` / Block Kit `image_url`. */
    url: string;

    /** Block Kit `alt_text` / Adaptive Cards `altText`. */
    alt_text?: string;

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

/** Spacing between flex children (CSS `gap`) in containers, columns, and column sets. */
export type MmContainerGap = 'none' | 'small' | 'medium' | 'large' | 'xlarge';

export type MmColumnBlock = {
    type: 'column';
    items: MmBlock[];
    width?: 'auto' | 'stretch';

    /** Space between items inside the column (via inner container). Defaults to `medium` when omitted in the renderer. */
    gap?: MmContainerGap;
};

export type MmColumnSetBlock = {
    type: 'column_set';
    columns: MmColumnBlock[];

    /** Space between columns. Defaults to `medium` when omitted in the renderer. */
    gap?: MmContainerGap;
};

export type MmContainerBackground = 'none' | 'gray';

/** Preset left accent bar colors (theme-aligned). */
export type MmContainerAccentSemantic =
    | 'default' |
    'primary' |
    'good' |
    'warning' |
    'danger';

export type MmContainerBlock = {
    type: 'container';
    content: MmBlock[];

    /** Optional full container border; independent of `accent_color` */
    border?: boolean;

    /**
     * Left bar color: `MmContainerAccentSemantic`, or a CSS color such as `#RRGGBB` / `rgb()` / `var(--…)`.
     * Attachments translator passes the webhook `color` string (often hex or `rgba(var(--link-color-rgb), 0.5)`).
     */
    accent_color?: MmContainerAccentSemantic | string;

    flow?: 'horizontal' | 'vertical';

    /** Space between items in the container flex layout. Defaults to `none`. */
    gap?: MmContainerGap;

    /** Subtle fill when `gray`; omitted or `none` is unchanged. */
    background?: MmContainerBackground;

    /**
     * Maximum height preset for the container. `none` (default) has no cap; other presets scroll when content overflows.
     */
    max_height?: MmContainerMaxHeight;
};

/** Preset maximum heights for `MmContainerBlock.max_height`. */
export type MmContainerMaxHeight = 'none' | 'small' | 'medium' | 'large';

export type MmCollapsibleBlock = {
    type: 'collapsible';
    header: MmBlock[];
    content: MmBlock[];
    collapsed?: boolean;
};

export type MmBlock =
    | MmTextBlock |
    MmImageBlock |
    MmDividerBlock |
    MmButtonBlock |
    MmStaticSelectBlock |
    MmTextInputBlock |
    MmBoolInputBlock |
    MmSelectInputBlock |
    MmDateInputBlock |
    MmDateTimeInputBlock |
    MmFileInputBlock |
    MmColumnSetBlock |
    MmColumnBlock |
    MmContainerBlock |
    MmCollapsibleBlock;
