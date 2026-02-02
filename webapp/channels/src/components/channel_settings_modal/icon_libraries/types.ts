// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Metadata for a single icon
export type IconMetadata = {
    name: string;
    tags: string[];       // Category tags or search keywords
    aliases: string[];    // Alternative names
};

// Icon with its SVG path data
export type IconDefinition = {
    name: string;
    path: string | string[]; // string for single path (MDI), string[] for multi-path (Lucide, etc.)
    tags?: string[];
    aliases?: string[];
};

// Category grouping for browsing
export type IconCategory = {
    id: string;
    name: string;
    iconNames: string[]; // Just names, paths looked up on demand
};

export type IconLibraryId = 'mdi' | 'lucide' | 'tabler' | 'feather' | 'simple' | 'fontawesome';

// What fields can be searched
export type SearchField = 'name' | 'tags' | 'aliases';

// Search options
export type SearchOptions = {
    fields: SearchField[];      // Which fields to search
    caseSensitive?: boolean;    // Default false
    matchMode?: 'contains' | 'startsWith' | 'exact'; // Default 'contains'
    limit?: number;             // Max results, default 100
};

// Search result with match info
export type SearchResult = {
    library: IconLibraryId;
    name: string;
    matchedField: SearchField;
    matchedValue: string;       // The tag/alias that matched (for highlighting)
};

// Icon library interface
export type IconLibrary = {
    id: IconLibraryId;
    name: string;
    prefix: string;
    iconCount: number;

    // Browsing
    categories: IconCategory[];

    // Data access
    getIconPath: (name: string) => string | string[] | undefined;
    getIconMetadata: (name: string) => IconMetadata | undefined;
    getAllIconNames: () => string[];

    // Search within this library
    search: (query: string, options?: Partial<SearchOptions>) => SearchResult[];
};

export type IconFormat = IconLibraryId | 'svg' | 'none';

export function parseIconValue(value: string): {format: IconFormat; name: string} {
    if (!value) {
        return {format: 'none', name: ''};
    }
    if (value.startsWith('mdi:')) {
        return {format: 'mdi', name: value.slice(4)};
    }
    if (value.startsWith('lucide:')) {
        return {format: 'lucide', name: value.slice(7)};
    }
    if (value.startsWith('tabler:')) {
        return {format: 'tabler', name: value.slice(7)};
    }
    if (value.startsWith('feather:')) {
        return {format: 'feather', name: value.slice(8)};
    }
    if (value.startsWith('simple:')) {
        return {format: 'simple', name: value.slice(7)};
    }
    if (value.startsWith('fontawesome:')) {
        return {format: 'fontawesome', name: value.slice(12)};
    }
    if (value.startsWith('svg:')) {
        return {format: 'svg', name: value.slice(4)};
    }
    return {format: 'none', name: ''};
}

export function formatIconValue(format: IconFormat, name: string): string {
    if (format === 'none' || !name) {
        return '';
    }
    if (format === 'svg') {
        return `svg:${name}`;
    }
    return `${format}:${name}`;
}

// Default search options
export const DEFAULT_SEARCH_OPTIONS: SearchOptions = {
    fields: ['name', 'tags', 'aliases'],
    caseSensitive: false,
    matchMode: 'contains',
    limit: 100,
};

// Helper to perform search on a single icon
export function matchesSearch(
    metadata: IconMetadata,
    query: string,
    options: SearchOptions,
): {matched: boolean; field?: SearchField; value?: string} {
    const q = options.caseSensitive ? query : query.toLowerCase();

    const matches = (value: string): boolean => {
        const v = options.caseSensitive ? value : value.toLowerCase();
        switch (options.matchMode) {
        case 'exact':
            return v === q;
        case 'startsWith':
            return v.startsWith(q);
        case 'contains':
        default:
            return v.includes(q);
        }
    };

    // Check name
    if (options.fields.includes('name')) {
        if (matches(metadata.name)) {
            return {matched: true, field: 'name', value: metadata.name};
        }
    }

    // Check aliases
    if (options.fields.includes('aliases')) {
        for (const alias of metadata.aliases) {
            if (matches(alias)) {
                return {matched: true, field: 'aliases', value: alias};
            }
        }
    }

    // Check tags
    if (options.fields.includes('tags')) {
        for (const tag of metadata.tags) {
            if (matches(tag)) {
                return {matched: true, field: 'tags', value: tag};
            }
        }
    }

    return {matched: false};
}
