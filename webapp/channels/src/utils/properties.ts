// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserPropertyField} from '@mattermost/types/properties';

/**
 * Returns the user-facing label for a CPA field.
 * Prefers attrs.display_name (trimmed); falls back to name for legacy
 * fields that have not been backfilled yet.
 *
 * Use for ALL human-readable label rendering (visible text, aria-label,
 * title, section headings, etc.).
 *
 * Do NOT use for:
 *   - CEL expression construction  → use field.name
 *   - React keys                   → use field.id or field.name
 *   - HTML element ids             → use field.name or field.id
 *   - Comparison with currentAttribute in ABAC selectors → use field.name
 */
export function getUserPropertyFieldLabel(
    field: Pick<UserPropertyField, 'name' | 'attrs'>,
): string {
    const displayName = field.attrs?.display_name?.trim();
    return displayName || field.name;
}

// SOURCE OF TRUTH: server/public/model/custom_profile_attributes.go lines 81-97
// CPAFieldNamePattern and CPAFieldNameReservedWords are Go->TS transcriptions.
// If the Go source changes, update BOTH the regex and the Set below, then update
// the hard-coded assertions in properties.test.ts (describe 'CPA field name constants').
// DO NOT change these constants without a corresponding server-side change.
//
// Grandfather contract:
// CPA name validation only fires when `name` changes from its initial server-persisted value.
// After a successful rename, `current.data[field.id].name` is refreshed by the table's
// readIO.setData(newData) call, which moves the field into the strictly-validated regime
// for all subsequent edits. The regression guard for this contract is in
// user_properties_table.test.tsx - search for 'rename of legacy field clears grandfather'.

/**
 * Mirrors server CPAFieldNamePattern (^[A-Za-z_][A-Za-z0-9_]*$).
 * Source: server/public/model/custom_profile_attributes.go:81
 */
export const CPA_FIELD_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Mirrors server CPAFieldNameReservedWords.
 * Source: server/public/model/custom_profile_attributes.go:90-97
 * 21 CEL keywords. Case-sensitive: only lowercase forms are reserved.
 */
export const CPA_FIELD_NAME_RESERVED_WORDS = new Set<string>([
    'true', 'false', 'null',
    'in', 'as',
    'break', 'const', 'continue', 'else',
    'for', 'function', 'if', 'import',
    'let', 'loop', 'package', 'namespace',
    'return', 'var', 'void', 'while',
]);

/** Max runes for a CPA field name. Mirrors server PropertyFieldNameMaxRunes. */
export const CPA_FIELD_NAME_MAX_RUNES = 255;

/**
 * Strips characters that are not valid in a CEL identifier and
 * prefixes a leading digit with underscore. Unlike slugifyForCEL,
 * this does NOT collapse/trim underscores — it is designed for
 * live keystroke filtering where the user controls spacing.
 */
export function filterCELIdentifier(input: string): string {
    let stripped = input.replace(/[^A-Za-z0-9_]/g, '');
    if (stripped.length > 0 && (/^[0-9]/).test(stripped)) {
        stripped = '_' + stripped;
    }
    return stripped;
}

export type CPAFieldNameValidationError =
    {kind: 'invalid_charset'} |
    {kind: 'reserved_word'; word: string} |
    {kind: 'too_long'; max: number};

/**
 * Client-side mirror of server ValidateCPAFieldName.
 * Returns null when the name is valid; returns an error descriptor otherwise.
 *
 * Length is checked here (against CPA_FIELD_NAME_MAX_RUNES = 255) even though
 * the server's ValidateCPAFieldName does not - this provides an early guard
 * matching the server's total rejection behavior.
 *
 * Lenient grandfather: callers must only invoke this when field.name has
 * changed from its server-persisted value (mirrors App.PatchCPAField behavior).
 */
export function validateCPAFieldName(name: string): CPAFieldNameValidationError | null {
    if ([...name].length > CPA_FIELD_NAME_MAX_RUNES) {
        return {kind: 'too_long', max: CPA_FIELD_NAME_MAX_RUNES};
    }
    if (!CPA_FIELD_NAME_PATTERN.test(name)) {
        return {kind: 'invalid_charset'};
    }
    if (CPA_FIELD_NAME_RESERVED_WORDS.has(name)) {
        return {kind: 'reserved_word', word: name};
    }
    return null;
}

/**
 * Converts an arbitrary string into a snake_case CEL-safe identifier for
 * use as a duplicate-field base name. Camel/PascalCase boundaries are
 * converted to underscore separators (e.g. 'MyField' -> 'my_field',
 * 'XMLParser' -> 'xml_parser'), the result is lowercased, and any
 * remaining non-identifier characters are replaced with underscores.
 * A leading digit is prefixed with underscore. Consecutive underscores
 * collapse to one and trailing underscores are trimmed (a leading
 * underscore is preserved). Result is guaranteed to match
 * CPA_FIELD_NAME_PATTERN if the input is non-empty; returns '_copy' if
 * the entire input normalizes to empty.
 */
export function slugifyForCEL(name: string): string {
    let slug = name.
        replace(/([a-z0-9])([A-Z])/g, '$1_$2').
        replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2').
        toLowerCase().
        replace(/[^a-z0-9_]/g, '_');
    if ((/^[0-9]/).test(slug)) {
        slug = '_' + slug;
    }
    slug = slug.replace(/_+/g, '_').replace(/_+$/, '');
    return slug || '_copy';
}
