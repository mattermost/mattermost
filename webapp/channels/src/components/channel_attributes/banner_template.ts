// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ResolvedChannelAttribute} from 'mattermost-redux/selectors/entities/properties';
import {getPropertyFieldLabel} from 'mattermost-redux/utils/property_utils';

// Attribute references are written as {{field_name}}, keyed on the field's
// machine name rather than its display name: display names are renameable and
// translatable, and a rename must not silently empty a channel's banner.
//
// Built per call rather than shared: a global regex carries lastIndex between
// uses, and both test() and matchAll() read it, so a shared instance makes the
// answer depend on who asked last.
const tokenPattern = () => /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

// The separators the cleanup below is allowed to touch. Deliberately excludes
// "-" and "/": a banner authored as "- {{classification}}" is a markdown list,
// and stripping its marker would rewrite what the author wrote.
const SEPARATORS = '·|';

export function attributeToken(fieldName: string): string {
    return `{{${fieldName}}}`;
}

/**
 * Whether the text references any attribute. Text with no tokens is a literal
 * and is passed through untouched, which is what keeps every banner written
 * before this feature rendering exactly as it did.
 */
export function hasAttributeTokens(text: string): boolean {
    return tokenPattern().test(text);
}

export function referencedFieldNames(text: string): string[] {
    const names: string[] = [];
    for (const match of text.matchAll(tokenPattern())) {
        if (!names.includes(match[1])) {
            names.push(match[1]);
        }
    }
    return names;
}

/**
 * Renders a banner template against a channel's resolved attribute values.
 *
 * An unset or unknown attribute collapses to nothing rather than leaving the raw
 * token on screen: a banner is read as a statement about the channel, and
 * "{{program}}" in the middle of one is worse than a shorter banner. Separators
 * left stranded by a collapsed token are cleaned up for the same reason.
 */
export function renderBannerTemplate(template: string, attributes: ResolvedChannelAttribute[]): string {
    if (!template || !hasAttributeTokens(template)) {
        return template;
    }

    const byName = new Map<string, ResolvedChannelAttribute>();
    for (const attribute of attributes) {
        byName.set(attribute.field.name, attribute);
    }

    const substituted = template.replace(tokenPattern(), (_full, name: string) => {
        return byName.get(name)?.displayValue ?? '';
    });

    return tidySeparators(substituted);
}

// Collapses the punctuation a removed token leaves behind: runs of separators
// with nothing between them, and any left dangling at either end. Deliberately
// conservative — it only touches the separators the composer itself offers, so a
// hand-written banner keeps whatever punctuation its author chose.
function tidySeparators(text: string): string {
    const run = new RegExp(`(?:\\s*[${SEPARATORS}]\\s*){2,}`, 'g');
    const leading = new RegExp(`^[\\s${SEPARATORS}]+`);
    const trailing = new RegExp(`[\\s${SEPARATORS}]+$`);

    return text.

        // Keep the first separator of a run, with single spaces around it.
        replace(run, (match) => ` ${match.trim().charAt(0)} `).
        replace(leading, '').
        replace(trailing, '').
        replace(/\s{2,}/g, ' ');
}

/**
 * The attributes a banner composer should offer as tokens: those designated to
 * display somewhere, since offering an attribute that is stored but never shown
 * invites a banner that silently references nothing.
 */
export function tokenSuggestions(attributes: ResolvedChannelAttribute[]): Array<{name: string; label: string}> {
    return attributes.map((attribute) => ({
        name: attribute.field.name,
        label: getPropertyFieldLabel(attribute.field),
    }));
}
