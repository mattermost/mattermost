// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Tabler Icons - 5000+ icons
// https://tabler.io/icons - MIT License

import type {
    IconLibrary,
    IconCategory,
    IconMetadata,
    SearchResult,
    SearchOptions,
} from './types';
import {DEFAULT_SEARCH_OPTIONS, matchesSearch} from './types';

// Type for Tabler node structure
type TablerNode = [string, Record<string, string>];

// Use direct path to bypass @tabler/icons exports field which redirects to ./icons/*
// The JSON files are at the package root but not properly exported
/* eslint-disable @typescript-eslint/no-var-requires */
const tablerNodes = require('@tabler/icons/tabler-nodes-outline') as Record<string, TablerNode[]>;
const tablerMeta = require('@tabler/icons/icons') as Record<string, {category?: string; tags?: (string | number)[]}>;
/* eslint-enable @typescript-eslint/no-var-requires */

// Build the icon data map
const TABLER_PATHS: Record<string, string[]> = {};
const ALL_TABLER_ICONS: string[] = [];
const TABLER_METADATA: Record<string, IconMetadata> = {};
const TABLER_CATEGORIES: Record<string, string[]> = {};

// Process nodes to extract paths
for (const [name, nodes] of Object.entries(tablerNodes as Record<string, TablerNode[]>)) {
    const paths: string[] = [];

    for (const [, attrs] of nodes) {
        if (attrs.d) {
            paths.push(attrs.d);
        }
    }

    if (paths.length > 0) {
        TABLER_PATHS[name] = paths;
        ALL_TABLER_ICONS.push(name);

        // Get metadata from icons.json
        const meta = (tablerMeta as Record<string, {category?: string; tags?: (string | number)[]}>)[name];
        const category = meta?.category || 'Other';
        const tags = meta?.tags?.map((t) => String(t)) || [];

        // Add to category
        if (!TABLER_CATEGORIES[category]) {
            TABLER_CATEGORIES[category] = [];
        }
        if (TABLER_CATEGORIES[category].length < 100) {
            TABLER_CATEGORIES[category].push(name);
        }

        // Generate aliases from name parts
        const nameParts = name.split('-').filter((p) => p.length > 2);

        TABLER_METADATA[name] = {
            name,
            tags: [category, ...tags],
            aliases: nameParts,
        };
    }
}

ALL_TABLER_ICONS.sort();

export function getTablerIconPaths(name: string): string[] | undefined {
    return TABLER_PATHS[name];
}

export function getTablerIconMetadata(name: string): IconMetadata | undefined {
    return TABLER_METADATA[name];
}

export function getAllTablerIconNames(): string[] {
    return ALL_TABLER_ICONS;
}

// Search implementation
function searchTabler(query: string, options?: Partial<SearchOptions>): SearchResult[] {
    const opts: SearchOptions = {...DEFAULT_SEARCH_OPTIONS, ...options};
    const results: SearchResult[] = [];
    const q = query.trim();

    if (!q) {
        return results;
    }

    for (const name of ALL_TABLER_ICONS) {
        if (results.length >= (opts.limit || 100)) {
            break;
        }

        const metadata = TABLER_METADATA[name];
        if (!metadata) {
            continue;
        }

        const match = matchesSearch(metadata, q, opts);
        if (match.matched && match.field && match.value) {
            results.push({
                library: 'tabler',
                name,
                matchedField: match.field,
                matchedValue: match.value,
            });
        }
    }

    return results;
}

// Build categories from collected data
function buildCategories(): IconCategory[] {
    const categoryNames: Record<string, string> = {
        'Arrows': 'Arrows',
        'Brand': 'Brands',
        'Buildings': 'Buildings',
        'Charts': 'Charts',
        'Communication': 'Communication',
        'Computers': 'Computers',
        'Currency': 'Currency',
        'Database': 'Database',
        'Design': 'Design',
        'Devices': 'Devices',
        'Document': 'Documents',
        'E-commerce': 'E-commerce',
        'Filled': 'Filled',
        'Food': 'Food',
        'Health': 'Health',
        'Letters': 'Letters',
        'Logic': 'Logic',
        'Map': 'Map',
        'Math': 'Math',
        'Media': 'Media',
        'Mood': 'Mood',
        'Nature': 'Nature',
        'Numbers': 'Numbers',
        'Photography': 'Photography',
        'Shapes': 'Shapes',
        'Sport': 'Sport',
        'System': 'System',
        'Text': 'Text',
        'Vehicles': 'Vehicles',
        'Version control': 'Version Control',
        'Weather': 'Weather',
    };

    return Object.entries(TABLER_CATEGORIES)
        .filter(([_, icons]) => icons.length > 0)
        .map(([id, iconNames]) => ({
            id: id.toLowerCase().replace(/\s+/g, '-'),
            name: categoryNames[id] || id,
            iconNames,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

const CATEGORIES = buildCategories();

export const tablerLibrary: IconLibrary = {
    id: 'tabler',
    name: 'Tabler',
    prefix: 'tabler:',
    iconCount: ALL_TABLER_ICONS.length,
    categories: CATEGORIES,
    getIconPath: getTablerIconPaths,
    getIconMetadata: getTablerIconMetadata,
    getAllIconNames: getAllTablerIconNames,
    search: searchTabler,
};
