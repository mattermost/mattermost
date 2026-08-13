// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ResolvedChannelAttribute} from 'mattermost-redux/selectors/entities/properties';
import {getPropertyFieldLabel} from 'mattermost-redux/utils/property_utils';

// Keyed on the machine name, not the display name: display names are renameable
// and translatable, and a rename must not silently empty a channel's banner.
//
// Built per call because a global regex carries lastIndex, and both test() and
// matchAll() read it — a shared instance makes the answer depend on who asked last.
const tokenPattern = () => /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

// Excludes "-" and "/": a banner authored as "- {{classification}}" is a markdown
// list, and stripping its marker would rewrite what the author wrote.
const SEPARATORS = '·|';

export function attributeToken(fieldName: string): string {
    return `{{${fieldName}}}`;
}

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
 * Renders a banner template against a channel's resolved values. An unset or
 * unknown attribute collapses to nothing rather than leaving "{{program}}" on
 * screen, and separators it strands are cleaned up for the same reason.
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

// Collapses the punctuation a removed token leaves behind. Only touches the
// separators the composer offers, so a hand-written banner keeps its own.
function tidySeparators(text: string): string {
    const run = new RegExp(`(?:\\s*[${SEPARATORS}]\\s*){2,}`, 'g');
    const leading = new RegExp(`^[\\s${SEPARATORS}]+`);
    const trailing = new RegExp(`[\\s${SEPARATORS}]+$`);

    return text.

        replace(run, (match) => ` ${match.trim().charAt(0)} `).
        replace(leading, '').
        replace(trailing, '').
        replace(/\s{2,}/g, ' ');
}

// Token name plus the label to show for it. Callers decide which attributes to offer.
export function tokenSuggestions(attributes: ResolvedChannelAttribute[]): Array<{name: string; label: string}> {
    return attributes.map((attribute) => ({
        name: attribute.field.name,
        label: getPropertyFieldLabel(attribute.field),
    }));
}
