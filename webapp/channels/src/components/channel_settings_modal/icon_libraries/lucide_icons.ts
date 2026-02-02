// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Lucide Icons - All 1500+ icons from lucide-static
// https://lucide.dev - ISC License

import type {
    IconLibrary,
    IconCategory,
    IconMetadata,
    SearchResult,
    SearchOptions,
} from './types';
import {DEFAULT_SEARCH_OPTIONS, matchesSearch} from './types';

// Type for Lucide icon node structure (element type + attributes)
// Lucide uses various SVG elements (path, circle, rect, etc.)
type LucideNode = [string, Record<string, string | undefined>];

// Use require for JSON imports to avoid TypeScript module resolution issues
/* eslint-disable @typescript-eslint/no-var-requires */
const iconNodes = require('lucide-static/icon-nodes.json') as Record<string, LucideNode[]>;
const iconTags = require('lucide-static/tags.json') as Record<string, string[]>;
/* eslint-enable @typescript-eslint/no-var-requires */

// Build the icon data map
const LUCIDE_PATHS: Record<string, string[]> = {};
const ALL_LUCIDE_ICONS: string[] = [];
const LUCIDE_METADATA: Record<string, IconMetadata> = {};

for (const [name, nodes] of Object.entries(iconNodes)) {
    const paths: string[] = [];

    for (const [, attrs] of nodes) {
        if (attrs.d) {
            paths.push(attrs.d);
        }
    }

    LUCIDE_PATHS[name] = paths;
    ALL_LUCIDE_ICONS.push(name);

    // Get tags from tags.json
    const tags = iconTags[name] || [];

    // Generate aliases from name parts
    const nameParts = name.split('-').filter((p) => p.length > 2);

    LUCIDE_METADATA[name] = {
        name,
        tags,
        aliases: nameParts,
    };
}

ALL_LUCIDE_ICONS.sort();

export function getLucideIconPaths(name: string): string[] | undefined {
    return LUCIDE_PATHS[name];
}

export function getLucideIconMetadata(name: string): IconMetadata | undefined {
    return LUCIDE_METADATA[name];
}

export function getAllLucideIconNames(): string[] {
    return ALL_LUCIDE_ICONS;
}

// Search implementation
function searchLucide(query: string, options?: Partial<SearchOptions>): SearchResult[] {
    const opts: SearchOptions = {...DEFAULT_SEARCH_OPTIONS, ...options};
    const results: SearchResult[] = [];
    const q = query.trim();

    if (!q) {
        return results;
    }

    for (const name of ALL_LUCIDE_ICONS) {
        if (results.length >= (opts.limit || 100)) {
            break;
        }

        const metadata = LUCIDE_METADATA[name];
        if (!metadata) {
            continue;
        }

        const match = matchesSearch(metadata, q, opts);
        if (match.matched && match.field && match.value) {
            results.push({
                library: 'lucide',
                name,
                matchedField: match.field,
                matchedValue: match.value,
            });
        }
    }

    return results;
}

// Build categories dynamically
function buildCategories(): IconCategory[] {
    const categoryMap: Record<string, string[]> = {
        'arrows': [],
        'charts': [],
        'communication': [],
        'devices': [],
        'development': [],
        'editing': [],
        'files': [],
        'layout': [],
        'media': [],
        'nature': [],
        'people': [],
        'places': [],
        'security': [],
        'shapes': [],
        'shopping': [],
        'social': [],
        'text': [],
        'time': [],
        'tools': [],
        'transport': [],
    };

    const categoryFilters: Record<string, (name: string, tags: string[]) => boolean> = {
        'arrows': (n, t) => n.includes('arrow') || n.includes('chevron') || n.includes('move') || t.some((tag) => tag.includes('arrow')),
        'charts': (n, t) => n.includes('chart') || n.includes('graph') || n.includes('bar') || n.includes('trending') || t.some((tag) => tag.includes('chart') || tag.includes('data')),
        'communication': (n, t) => n.includes('message') || n.includes('mail') || n.includes('phone') || n.includes('bell') || n.includes('send') || t.some((tag) => tag.includes('message') || tag.includes('chat')),
        'devices': (n, t) => n.includes('monitor') || n.includes('laptop') || n.includes('tablet') || n.includes('smartphone') || n.includes('tv') || t.some((tag) => tag.includes('device')),
        'development': (n, t) => n.includes('code') || n.includes('terminal') || n.includes('git') || n.includes('database') || n.includes('server') || n.includes('bug') || t.some((tag) => tag.includes('code') || tag.includes('developer')),
        'editing': (n, t) => n.includes('edit') || n.includes('pen') || n.includes('pencil') || n.includes('eraser') || n.includes('crop') || n.includes('scissors') || t.some((tag) => tag.includes('edit')),
        'files': (n, t) => n.includes('file') || n.includes('folder') || n.includes('archive') || t.some((tag) => tag.includes('file') || tag.includes('document')),
        'layout': (n, t) => n.includes('layout') || n.includes('grid') || n.includes('sidebar') || n.includes('panel') || n.includes('columns') || t.some((tag) => tag.includes('layout')),
        'media': (n, t) => n.includes('play') || n.includes('pause') || n.includes('video') || n.includes('music') || n.includes('volume') || n.includes('mic') || n.includes('camera') || t.some((tag) => tag.includes('media') || tag.includes('audio') || tag.includes('video')),
        'nature': (n, t) => n.includes('sun') || n.includes('moon') || n.includes('cloud') || n.includes('leaf') || n.includes('tree') || n.includes('flower') || t.some((tag) => tag.includes('weather') || tag.includes('nature')),
        'people': (n, t) => n.includes('user') || n.includes('users') || n.includes('person') || t.some((tag) => tag.includes('person') || tag.includes('user')),
        'places': (n, t) => n.includes('home') || n.includes('building') || n.includes('store') || n.includes('map') || n.includes('globe') || t.some((tag) => tag.includes('place') || tag.includes('location')),
        'security': (n, t) => n.includes('lock') || n.includes('unlock') || n.includes('key') || n.includes('shield') || n.includes('eye') || t.some((tag) => tag.includes('security') || tag.includes('password')),
        'shapes': (n, t) => n.includes('circle') || n.includes('square') || n.includes('triangle') || n.includes('hexagon') || n.includes('star') || n.includes('heart') || t.some((tag) => tag.includes('shape')),
        'shopping': (n, t) => n.includes('shopping') || n.includes('cart') || n.includes('bag') || n.includes('credit') || n.includes('wallet') || t.some((tag) => tag.includes('shop') || tag.includes('commerce')),
        'social': (n, t) => n.includes('share') || n.includes('thumb') || n.includes('bookmark') || n.includes('rss') || t.some((tag) => tag.includes('social') || tag.includes('share')),
        'text': (n, t) => n.includes('text') || n.includes('type') || n.includes('font') || n.includes('bold') || n.includes('italic') || n.includes('heading') || t.some((tag) => tag.includes('text') || tag.includes('font')),
        'time': (n, t) => n.includes('clock') || n.includes('calendar') || n.includes('timer') || n.includes('alarm') || n.includes('watch') || t.some((tag) => tag.includes('time') || tag.includes('date')),
        'tools': (n, t) => n.includes('wrench') || n.includes('hammer') || n.includes('settings') || n.includes('cog') || n.includes('sliders') || t.some((tag) => tag.includes('tool') || tag.includes('settings')),
        'transport': (n, t) => n.includes('car') || n.includes('bus') || n.includes('train') || n.includes('plane') || n.includes('bike') || n.includes('ship') || n.includes('truck') || n.includes('rocket') || t.some((tag) => tag.includes('transport') || tag.includes('vehicle')),
    };

    const categoryNames: Record<string, string> = {
        'arrows': 'Arrows',
        'charts': 'Charts / Data',
        'communication': 'Communication',
        'devices': 'Devices',
        'development': 'Development',
        'editing': 'Editing',
        'files': 'Files / Folders',
        'layout': 'Layout',
        'media': 'Media',
        'nature': 'Nature',
        'people': 'People',
        'places': 'Places',
        'security': 'Security',
        'shapes': 'Shapes',
        'shopping': 'Shopping',
        'social': 'Social',
        'text': 'Text / Typography',
        'time': 'Time / Calendar',
        'tools': 'Tools',
        'transport': 'Transportation',
    };

    // Populate categories
    for (const name of ALL_LUCIDE_ICONS) {
        const tags = LUCIDE_METADATA[name]?.tags || [];
        for (const [catId, filter] of Object.entries(categoryFilters)) {
            if (filter(name, tags) && categoryMap[catId].length < 100) {
                categoryMap[catId].push(name);
            }
        }
    }

    return Object.entries(categoryMap)
        .filter(([_, icons]) => icons.length > 0)
        .map(([id, iconNames]) => ({
            id,
            name: categoryNames[id] || id,
            iconNames,
        }));
}

const LUCIDE_CATEGORIES = buildCategories();

export const lucideLibrary: IconLibrary = {
    id: 'lucide',
    name: 'Lucide',
    prefix: 'lucide:',
    iconCount: ALL_LUCIDE_ICONS.length,
    categories: LUCIDE_CATEGORIES,
    getIconPath: getLucideIconPaths,
    getIconMetadata: getLucideIconMetadata,
    getAllIconNames: getAllLucideIconNames,
    search: searchLucide,
};
