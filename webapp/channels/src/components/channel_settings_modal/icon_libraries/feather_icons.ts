// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Feather Icons - 287 clean, minimal icons
// https://feathericons.com - MIT License

import type {
    IconLibrary,
    IconCategory,
    IconMetadata,
    SearchResult,
    SearchOptions,
} from './types';
import {DEFAULT_SEARCH_OPTIONS, matchesSearch} from './types';

// Use require for JSON imports to avoid TypeScript module resolution issues
/* eslint-disable @typescript-eslint/no-var-requires */
const featherIcons = require('feather-icons/dist/icons.json') as Record<string, string>;
/* eslint-enable @typescript-eslint/no-var-requires */

// Feather icons are SVG content strings, not path data
// We store the raw SVG content and render it differently
const FEATHER_SVG: Record<string, string> = {};
const ALL_FEATHER_ICONS: string[] = [];
const FEATHER_METADATA: Record<string, IconMetadata> = {};

for (const [name, svgContent] of Object.entries(featherIcons as Record<string, string>)) {
    FEATHER_SVG[name] = svgContent;
    ALL_FEATHER_ICONS.push(name);

    // Generate metadata from icon name
    const nameParts = name.split('-').filter((p) => p.length > 2);

    // Generate tags from name patterns
    const tags: string[] = [];
    if (name.includes('arrow') || name.includes('chevron')) {
        tags.push('Arrows');
    }
    if (name.includes('align') || name.includes('layout') || name.includes('grid')) {
        tags.push('Layout');
    }
    if (name.includes('message') || name.includes('mail') || name.includes('phone') || name.includes('bell')) {
        tags.push('Communication');
    }
    if (name.includes('file') || name.includes('folder') || name.includes('save') || name.includes('download')) {
        tags.push('Files');
    }
    if (name.includes('user') || name.includes('users')) {
        tags.push('Users');
    }
    if (name.includes('edit') || name.includes('pen') || name.includes('type')) {
        tags.push('Editing');
    }
    if (name.includes('play') || name.includes('pause') || name.includes('video') || name.includes('music') || name.includes('volume')) {
        tags.push('Media');
    }
    if (name.includes('sun') || name.includes('moon') || name.includes('cloud') || name.includes('wind')) {
        tags.push('Weather');
    }
    if (name.includes('lock') || name.includes('unlock') || name.includes('key') || name.includes('shield') || name.includes('eye')) {
        tags.push('Security');
    }
    if (name.includes('map') || name.includes('navigation') || name.includes('compass') || name.includes('globe')) {
        tags.push('Navigation');
    }
    if (name.includes('settings') || name.includes('tool') || name.includes('sliders')) {
        tags.push('Tools');
    }
    if (name.includes('circle') || name.includes('square') || name.includes('triangle') || name.includes('hexagon') || name.includes('star') || name.includes('heart')) {
        tags.push('Shapes');
    }
    if (name.includes('github') || name.includes('twitter') || name.includes('facebook') || name.includes('instagram') || name.includes('youtube') || name.includes('linkedin')) {
        tags.push('Social');
    }
    if (name.includes('shopping') || name.includes('cart') || name.includes('credit') || name.includes('dollar')) {
        tags.push('Commerce');
    }

    FEATHER_METADATA[name] = {
        name,
        tags,
        aliases: nameParts,
    };
}

ALL_FEATHER_ICONS.sort();

// Feather returns SVG content, not path data
export function getFeatherIconSvg(name: string): string | undefined {
    return FEATHER_SVG[name];
}

export function getFeatherIconMetadata(name: string): IconMetadata | undefined {
    return FEATHER_METADATA[name];
}

export function getAllFeatherIconNames(): string[] {
    return ALL_FEATHER_ICONS;
}

// Search implementation
function searchFeather(query: string, options?: Partial<SearchOptions>): SearchResult[] {
    const opts: SearchOptions = {...DEFAULT_SEARCH_OPTIONS, ...options};
    const results: SearchResult[] = [];
    const q = query.trim();

    if (!q) {
        return results;
    }

    for (const name of ALL_FEATHER_ICONS) {
        if (results.length >= (opts.limit || 100)) {
            break;
        }

        const metadata = FEATHER_METADATA[name];
        if (!metadata) {
            continue;
        }

        const match = matchesSearch(metadata, q, opts);
        if (match.matched && match.field && match.value) {
            results.push({
                library: 'feather',
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
        'communication': [],
        'editing': [],
        'files': [],
        'layout': [],
        'media': [],
        'navigation': [],
        'security': [],
        'shapes': [],
        'social': [],
        'commerce': [],
        'tools': [],
        'users': [],
        'weather': [],
    };

    const categoryFilters: Record<string, (name: string) => boolean> = {
        'arrows': (n) => n.includes('arrow') || n.includes('chevron') || n.includes('corner'),
        'communication': (n) => n.includes('message') || n.includes('mail') || n.includes('phone') || n.includes('bell') || n.includes('inbox') || n.includes('send'),
        'editing': (n) => n.includes('edit') || n.includes('pen') || n.includes('type') || n.includes('bold') || n.includes('italic') || n.includes('underline') || n.includes('scissors') || n.includes('clipboard') || n.includes('copy'),
        'files': (n) => n.includes('file') || n.includes('folder') || n.includes('save') || n.includes('download') || n.includes('upload') || n.includes('archive') || n.includes('book'),
        'layout': (n) => n.includes('align') || n.includes('layout') || n.includes('grid') || n.includes('columns') || n.includes('sidebar') || n.includes('maximize') || n.includes('minimize'),
        'media': (n) => n.includes('play') || n.includes('pause') || n.includes('video') || n.includes('music') || n.includes('volume') || n.includes('mic') || n.includes('camera') || n.includes('image'),
        'navigation': (n) => n.includes('map') || n.includes('navigation') || n.includes('compass') || n.includes('globe') || n.includes('home') || n.includes('menu') || n.includes('search') || n.includes('external'),
        'security': (n) => n.includes('lock') || n.includes('unlock') || n.includes('key') || n.includes('shield') || n.includes('eye') || n.includes('alert'),
        'shapes': (n) => n.includes('circle') || n.includes('square') || n.includes('triangle') || n.includes('hexagon') || n.includes('star') || n.includes('heart') || n.includes('octagon'),
        'social': (n) => n.includes('github') || n.includes('twitter') || n.includes('facebook') || n.includes('instagram') || n.includes('youtube') || n.includes('linkedin') || n.includes('slack') || n.includes('dribbble'),
        'commerce': (n) => n.includes('shopping') || n.includes('cart') || n.includes('credit') || n.includes('dollar') || n.includes('gift') || n.includes('percent') || n.includes('tag'),
        'tools': (n) => n.includes('settings') || n.includes('tool') || n.includes('sliders') || n.includes('terminal') || n.includes('code') || n.includes('database') || n.includes('server') || n.includes('cpu'),
        'users': (n) => n.includes('user') || n.includes('users'),
        'weather': (n) => n.includes('sun') || n.includes('moon') || n.includes('cloud') || n.includes('wind') || n.includes('droplet') || n.includes('thermometer') || n.includes('umbrella'),
    };

    const categoryNames: Record<string, string> = {
        'arrows': 'Arrows',
        'communication': 'Communication',
        'editing': 'Editing',
        'files': 'Files',
        'layout': 'Layout',
        'media': 'Media',
        'navigation': 'Navigation',
        'security': 'Security',
        'shapes': 'Shapes',
        'social': 'Social',
        'commerce': 'Commerce',
        'tools': 'Tools',
        'users': 'Users',
        'weather': 'Weather',
    };

    // Populate categories
    for (const name of ALL_FEATHER_ICONS) {
        for (const [catId, filter] of Object.entries(categoryFilters)) {
            if (filter(name) && categoryMap[catId].length < 50) {
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

const FEATHER_CATEGORIES = buildCategories();

export const featherLibrary: IconLibrary = {
    id: 'feather',
    name: 'Feather',
    prefix: 'feather:',
    iconCount: ALL_FEATHER_ICONS.length,
    categories: FEATHER_CATEGORIES,
    getIconPath: getFeatherIconSvg, // Returns SVG content, not path
    getIconMetadata: getFeatherIconMetadata,
    getAllIconNames: getAllFeatherIconNames,
    search: searchFeather,
};
