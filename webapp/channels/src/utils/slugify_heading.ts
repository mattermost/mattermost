// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Converts text to a URL-safe slug
 * @param text The text to slugify
 * @returns A URL-safe slug
 */
export function slugify(text: string): string {
    return text.
        toLowerCase().
        trim().
        replace(/\s+/g, '-').
        replace(/[^\w-]+/g, '').
        replace(/--+/g, '-').
        replace(/^-+|-+$/g, '');
}

/**
 * Generates a unique heading ID with collision detection
 * @param text The heading text
 * @param existingIds Set of IDs already in use in the document
 * @returns A unique slugified ID
 */
export function slugifyHeading(text: string, existingIds: Set<string>): string {
    if (!text || text.trim() === '') {
        return 'untitled';
    }

    const baseSlug = slugify(text);
    if (!baseSlug) {
        return 'untitled';
    }

    if (!existingIds.has(baseSlug)) {
        return baseSlug;
    }

    let counter = 2;
    let uniqueSlug = `${baseSlug}-${counter}`;
    while (existingIds.has(uniqueSlug)) {
        counter++;
        uniqueSlug = `${baseSlug}-${counter}`;
    }

    return uniqueSlug;
}
