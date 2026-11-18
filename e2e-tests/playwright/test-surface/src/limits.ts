// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * How far the scan follows code before it stops, in one place. A stop leaves something unknown (a value, a
 * callee, a scope), never something wrong; one that cuts a set of values short says so (rule `truncated`, stat
 * `truncatedValues`). Raising a limit costs scan time; lowering one loses what the webapp needs today (see each).
 */

// ---- values (values.ts) ----------------------------------------------------------------------------------------

/**
 * Steps (a conditional, a template, a prop read) when resolving one value. A post's scope reaches a file tile in a
 * spillage report's post preview through about ten components, which needs more than 32.
 */
export const MAX_RESOLVE_DEPTH = 48;

/** Values a template built from two lists may take (a cross product); past it the rest are `truncated`. */
export const MAX_TEMPLATE_VALUES = 256;

/** Values gathered across a component's usages, or a template with one single-valued side: linear, so much higher. */
export const MAX_USAGE_VALUES = 8192;

/** Return statements a small helper may have for its returns to be read as the call's values (`withRole(…)`). */
export const MAX_HELPER_RETURNS = 8;

/** Spreads followed into an array literal (`[...base, ...extra]`) when listing a fixed list's items. */
export const MAX_ARRAY_SPREAD_DEPTH = 4;

/** Calls followed back from a helper's parameter to the object literals passed for it. */
export const MAX_PARAM_OBJECT_DEPTH = 3;

/** Hops (a function's returns, a factory, a variable) when listing the keys a `connect` map returns. */
export const MAX_OBJECT_KEYS_DEPTH = 4;

// ---- client catalog (routes.ts) ---------------------------------------------------------------------------

/** Steps when evaluating a client method's URL (route helpers calling route helpers). */
export const MAX_URL_DEPTH = 12;

/** Nested type arguments when writing a response body's type with its imports. */
export const MAX_BODY_TYPE_DEPTH = 6;

// ---- where testids land, and the scopes components render (scan.ts, roles.ts) ------------------------------------

/** Components a testid's props spread is followed through to the element it lands on. */
export const MAX_LANDING_HOPS = 6;

/**
 * Names a JSX child is followed through to the elements it holds (`const a = b; const b = useMemo(() => [c])`, a hook's
 * returned property, a prop at its mount). Cycles stop on their own; running out of this is reported, never silent.
 */
export const MAX_HELD_JSX_HOPS = 64;

/** `styled(X)` wrappers followed to the element or library component they render. */
export const MAX_STYLED_HOPS = 4;

/** Usages descended through when listing the scopes a component renders for one instance. */
export const MAX_SCOPE_PATH = 8;

/** Usages whose render conditions count for an element: the first ones on its chain, or a component's few call sites. */
export const MAX_CONDITION_USAGES = 3;

/** Local values inlined when classifying a render condition (`const show = canDelete && !isSystem`). */
export const MAX_CONDITION_INLINE_DEPTH = 2;
