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

// Separators cleaned when an adjacent attribute collapses. "*" is excluded so
// markdown emphasis survives; "-" is excluded so a leading markdown list marker
// is not stripped from authored text. One or two of these in a row (e.g. "·",
// ".", "/", "?", "||") count as a removable separator.
const SEPARATOR_CHARS = '·|./?';

export function attributeToken(fieldName: string): string {
    return `{{${fieldName}}}`;
}

export function hasAttributeTokens(text: string): boolean {
    return tokenPattern().test(text);
}

export type BannerSegment = {type: 'text'; text: string} | {type: 'token'; name: string};

/**
 * Splits a template into the pieces the chip editor renders. Whitespace inside a
 * token is dropped here, so editing and re-serializing normalises `{{ a }}` to
 * `{{a}}` rather than leaving two spellings of the same reference.
 */
export function parseBannerTemplate(template: string): BannerSegment[] {
    const segments: BannerSegment[] = [];
    let index = 0;

    for (const match of template.matchAll(tokenPattern())) {
        const start = match.index ?? 0;
        if (start > index) {
            segments.push({type: 'text', text: template.slice(index, start)});
        }
        segments.push({type: 'token', name: match[1]});
        index = start + match[0].length;
    }

    if (index < template.length) {
        segments.push({type: 'text', text: template.slice(index)});
    }

    return segments;
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
// short separator symbols authors put between attributes.
function tidySeparators(text: string): string {
    const sep = `[${SEPARATOR_CHARS}]{1,2}`;
    const unit = `(?:\\s*${sep}\\s*)`;
    const run = new RegExp(`${unit}{2,}`, 'g');
    const leading = new RegExp(`^(?:\\s*${sep}\\s*)+`);
    const trailing = new RegExp(`(?:\\s*${sep}\\s*)+$`);
    const firstSep = new RegExp(sep);

    return text.
        replace(run, (match) => {
            const found = match.match(firstSep);
            return found ? ` ${found[0]} ` : ' ';
        }).
        replace(leading, '').
        replace(trailing, '').
        replace(/\s{2,}/g, ' ');
}

/**
 * Seeds a template with tokens for every attribute designated for the banner.
 *
 * Designation is a default, not an enforcement: missing tokens are appended so a
 * fresh channel banner starts with them, but an author may remove any of them.
 */
export function withRequiredTokens(template: string, fieldNames: string[]): string {
    if (fieldNames.length === 0) {
        return template;
    }

    const present = referencedFieldNames(template);
    const missing = fieldNames.filter((name) => !present.includes(name));
    if (missing.length === 0) {
        return template;
    }

    const additions = missing.map(attributeToken).join(' · ');
    const existing = template.trim();

    return existing ? `${existing} · ${additions}` : additions;
}

// Token name plus the label to show for it. Callers decide which attributes to offer.
export function tokenSuggestions(attributes: ResolvedChannelAttribute[]): Array<{name: string; label: string}> {
    return attributes.map((attribute) => ({
        name: attribute.field.name,
        label: getPropertyFieldLabel(attribute.field),
    }));
}
