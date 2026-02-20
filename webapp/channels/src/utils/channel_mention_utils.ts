// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';

import {cleanUpUrlable} from 'utils/url';

const OBFUSCATED_SLUG_PATTERN = /^[a-z0-9]{26}$/;
const MENTION_REGEX = /~([a-z0-9][a-z0-9_-]*)/gi;

/**
 * Returns true if the channel has an obfuscated slug — i.e. its name is a
 * 26-character alphanumeric string AND differs from the default, system-generated slug.
 */
export function hasObfuscatedSlug(channel: Channel): boolean {
    return (
        OBFUSCATED_SLUG_PATTERN.test(channel.name) &&
        channel.name !== cleanUpUrlable(channel.display_name)
    );
}

/**
 * Resolves display-name-based channel mention slugs back to real channel names.
 *
 * When secure channel URLs are enabled, the autocomplete inserts
 * ~cleanUpUrlable(display_name) instead of ~channel.name. Before sending
 * or saving, this function replaces those display slugs with the actual
 * channel.name values.
 *
 * Only channels with obfuscated slugs (26-char alphanumeric names) are
 * considered. Channels with custom or human-readable slugs are left untouched.
 */
export function resolveDisplayMentionsToSlugs(
    message: string,
    channels: Channel[],
): string {
    if (!message) {
        return message;
    }

    const displaySlugToName = new Map<string, string>();
    for (const channel of channels) {
        if (!hasObfuscatedSlug(channel)) {
            continue;
        }
        const displaySlug = cleanUpUrlable(channel.display_name);
        if (displaySlug && !displaySlugToName.has(displaySlug)) {
            displaySlugToName.set(displaySlug, channel.name);
        }
    }

    if (displaySlugToName.size === 0) {
        return message;
    }

    return message.replace(MENTION_REGEX, (match, slug) => {
        const lowerSlug = slug.toLowerCase();
        const resolvedName = displaySlugToName.get(lowerSlug);
        if (resolvedName) {
            return '~' + resolvedName;
        }
        return match;
    });
}

/**
 * Converts real channel name mentions (~channel.name) to display-name-based
 * slugs (~cleanUpUrlable(display_name)) for human-readable editing.
 *
 * This is the reverse of resolveDisplayMentionsToSlugs and is used when
 * loading a post into the editor for editing.
 *
 * Only channels with obfuscated slugs (26-char alphanumeric names) are
 * considered. Channels with custom or human-readable slugs are left untouched.
 *
 * Extracts obfuscated channel slugs from a message that are NOT present
 * in the provided channel list. Returns a deduplicated array of unresolved
 * slug strings.
 */
export function extractUnresolvedObfuscatedSlugs(
    message: string,
    channels: Channel[],
): Set<string> {
    if (!message) {
        return new Set<string>();
    }

    const knownNames = new Set<string>();
    for (const channel of channels) {
        if (OBFUSCATED_SLUG_PATTERN.test(channel.name)) {
            knownNames.add(channel.name);
        }
    }

    const unresolved = new Set<string>();

    let match;
    while ((match = MENTION_REGEX.exec(message)) !== null) {
        const slug = match[1];
        if (OBFUSCATED_SLUG_PATTERN.test(slug) && !knownNames.has(slug)) {
            unresolved.add(slug);
        }
    }

    return unresolved;
}

export function convertSlugsToDisplayMentions(
    message: string,
    channels: Channel[],
): string {
    if (!message) {
        return message;
    }

    const nameToDisplaySlug = new Map<string, string>();
    for (const channel of channels) {
        if (!hasObfuscatedSlug(channel)) {
            continue;
        }
        const displaySlug = cleanUpUrlable(channel.display_name);
        nameToDisplaySlug.set(channel.name, displaySlug);
    }

    if (nameToDisplaySlug.size === 0) {
        return message;
    }

    return message.replace(MENTION_REGEX, (match, slug) => {
        const displaySlug = nameToDisplaySlug.get(slug);
        return displaySlug ? '~' + displaySlug : match;
    });
}
