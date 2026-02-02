// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export * from './types';
export {mdiLibrary, getMdiIconPath, getMdiIconMetadata, getAllMdiIconNames} from './mdi_icons';
export {lucideLibrary, getLucideIconPaths, getLucideIconMetadata, getAllLucideIconNames} from './lucide_icons';
export {tablerLibrary, getTablerIconPaths, getTablerIconMetadata, getAllTablerIconNames} from './tabler_icons';
export {featherLibrary, getFeatherIconSvg, getFeatherIconMetadata, getAllFeatherIconNames} from './feather_icons';
export {simpleLibrary, getSimpleIconPath, getSimpleIconMetadata, getAllSimpleIconNames} from './simple_icons';
export {fontawesomeLibrary, getFontAwesomeIconPath, getFontAwesomeIconMetadata, getAllFontAwesomeIconNames} from './fontawesome_icons';

import {mdiLibrary} from './mdi_icons';
import {lucideLibrary} from './lucide_icons';
import {tablerLibrary} from './tabler_icons';
import {featherLibrary} from './feather_icons';
import {simpleLibrary} from './simple_icons';
import {fontawesomeLibrary} from './fontawesome_icons';
import type {IconLibrary, IconLibraryId, SearchResult, SearchOptions, SearchField} from './types';
import {DEFAULT_SEARCH_OPTIONS} from './types';

// All available libraries
export const iconLibraries: IconLibrary[] = [
    mdiLibrary,
    lucideLibrary,
    tablerLibrary,
    featherLibrary,
    fontawesomeLibrary,
    simpleLibrary,
];

// Get a library by ID
export function getIconLibrary(id: IconLibraryId): IconLibrary | undefined {
    return iconLibraries.find((lib) => lib.id === id);
}

// Search all icons across all libraries
export function searchAllLibraries(
    query: string,
    options?: Partial<SearchOptions>,
): SearchResult[] {
    const opts: SearchOptions = {...DEFAULT_SEARCH_OPTIONS, ...options};
    const results: SearchResult[] = [];
    const q = query.trim();

    if (!q) {
        return results;
    }

    const perLibraryLimit = Math.ceil((opts.limit || 100) / iconLibraries.length);

    for (const library of iconLibraries) {
        if (results.length >= (opts.limit || 100)) {
            break;
        }

        const libraryResults = library.search(q, {
            ...opts,
            limit: perLibraryLimit,
        });

        results.push(...libraryResults);
    }

    return results.slice(0, opts.limit || 100);
}

// Get total icon count across all libraries
export function getTotalIconCount(): number {
    return iconLibraries.reduce((total, lib) => total + lib.iconCount, 0);
}

// Get categories that match a search term (for highlighting)
export function getMatchingCategories(
    library: IconLibrary,
    searchTerm: string,
): string[] {
    if (!searchTerm.trim()) {
        return [];
    }

    const term = searchTerm.toLowerCase();
    const matching: string[] = [];

    for (const category of library.categories) {
        // Check if category name matches
        if (category.name.toLowerCase().includes(term)) {
            matching.push(category.id);
            continue;
        }

        // Check if any icon in the category has matching tags
        for (const iconName of category.iconNames.slice(0, 10)) { // Sample first 10
            const metadata = library.getIconMetadata(iconName);
            if (metadata?.tags.some((tag) => tag.toLowerCase().includes(term))) {
                matching.push(category.id);
                break;
            }
        }
    }

    return matching;
}

// Get search field label for display
export function getSearchFieldLabel(field: SearchField): string {
    switch (field) {
    case 'name':
        return 'Name';
    case 'tags':
        return 'Tag';
    case 'aliases':
        return 'Alias';
    default:
        return field;
    }
}
