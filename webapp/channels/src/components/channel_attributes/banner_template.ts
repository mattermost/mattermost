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

/**
 * True when a template can never put anything on screen: no attribute reference
 * to fill in later, and nothing left but separators and whitespace.
 *
 * Deleting the last attribute chip leaves the separators that sat between them
 * behind, so "· ·" reads as authored text to every length check. A template that
 * still references an attribute is not blank whatever it renders to today —
 * that is the banner waiting for a value, which is the point of the feature.
 */
export function isBlankTemplate(template: string): boolean {
    if (hasAttributeTokens(template)) {
        return false;
    }
    return template.replace(new RegExp(`[\\s${SEPARATOR_CHARS}]`, 'g'), '') === '';
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
        // Separator residue is not content, but anything else an author typed is
        // theirs and passes through untouched.
        return isBlankTemplate(template) ? '' : template;
    }

    const byName = new Map<string, ResolvedChannelAttribute>();
    for (const attribute of attributes) {
        byName.set(attribute.field.name, attribute);
    }

    const reservedText = [template, ...attributes.map((attribute) => attribute.displayValue)].join('');
    let emptyTokenMarker = '\uE000';
    while (reservedText.includes(emptyTokenMarker)) {
        emptyTokenMarker += '\uE000';
    }

    let collapsed = false;
    const substituted = template.replace(tokenPattern(), (_full, name: string) => {
        const value = byName.get(name)?.displayValue;
        if (!value) {
            collapsed = true;
            return emptyTokenMarker;
        }
        return value;
    });

    return collapsed ? tidySeparators(substituted, emptyTokenMarker) : substituted;
}

// Only a separator directly next to a collapsed token is removable. Keep the
// separator on the left when both sides have one, preserving the author's choice.
function tidySeparators(substituted: string, marker: string): string {
    let text = substituted;
    const leftSeparator = new RegExp(`(?:^|\\s)[${SEPARATOR_CHARS}]{1,2}\\s*$`);
    const rightSeparator = new RegExp(`^\\s*[${SEPARATOR_CHARS}]{1,2}(?=\\s|$)\\s*`);
    let index = text.indexOf(marker);

    while (index !== -1) {
        let before = text.slice(0, index);
        let after = text.slice(index + marker.length);
        const left = before.match(leftSeparator);
        const right = after.match(rightSeparator);

        if (right) {
            after = after.slice(right[0].length);
        } else if (left) {
            before = before.slice(0, -left[0].length);
        }

        const gap = before && after && ((/\s$/).test(before) || (/^\s/).test(after)) ? ' ' : '';
        text = before.replace(/\s+$/, '') + gap + after.replace(/^\s+/, '');
        index = text.indexOf(marker);
    }

    return text;
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
