// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Simple Icons - 3000+ brand icons
// https://simpleicons.org - CC0 1.0 Universal License

import * as simpleIcons from 'simple-icons';

import type {
    IconLibrary,
    IconCategory,
    IconMetadata,
    SearchResult,
    SearchOptions,
} from './types';
import {DEFAULT_SEARCH_OPTIONS, matchesSearch} from './types';

// Simple icon type from the library
type SimpleIcon = {
    title: string;
    slug: string;
    svg: string;
    path: string;
    source: string;
    hex: string;
    guidelines?: string;
};

// Build the icon data map
const SIMPLE_PATHS: Record<string, string> = {};
const ALL_SIMPLE_ICONS: string[] = [];
const SIMPLE_METADATA: Record<string, IconMetadata> = {};
const SIMPLE_TITLES: Record<string, string> = {};

// Category mappings for brand icons
const BRAND_CATEGORIES: Record<string, string[]> = {
    'social': ['twitter', 'facebook', 'instagram', 'linkedin', 'tiktok', 'snapchat', 'pinterest', 'reddit', 'tumblr', 'mastodon', 'threads', 'bluesky'],
    'development': ['github', 'gitlab', 'bitbucket', 'docker', 'kubernetes', 'npm', 'yarn', 'nodejs', 'python', 'javascript', 'typescript', 'rust', 'go', 'java', 'react', 'vue', 'angular', 'svelte', 'nextdotjs', 'vercel', 'netlify', 'aws', 'googlecloud', 'azure', 'digitalocean', 'heroku', 'mongodb', 'postgresql', 'mysql', 'redis', 'elasticsearch', 'graphql', 'apollo', 'prisma', 'firebase', 'supabase'],
    'communication': ['slack', 'discord', 'telegram', 'whatsapp', 'signal', 'zoom', 'microsoftteams', 'googlemeet', 'skype', 'messenger', 'wechat', 'line', 'viber'],
    'productivity': ['notion', 'trello', 'asana', 'jira', 'confluence', 'airtable', 'clickup', 'monday', 'todoist', 'evernote', 'googledocs', 'googlesheets', 'googleslides', 'microsoftword', 'microsoftexcel', 'microsoftpowerpoint', 'dropbox', 'googledrive', 'onedrive', 'box', 'figma', 'canva', 'adobephotoshop', 'adobeillustrator', 'adobexd', 'sketch'],
    'media': ['youtube', 'twitch', 'vimeo', 'spotify', 'applemusic', 'soundcloud', 'deezer', 'tidal', 'pandora', 'netflix', 'amazonprime', 'disneyplus', 'hulu', 'hbomax', 'appletv', 'plex', 'vlcmediaplayer'],
    'gaming': ['steam', 'epicgames', 'gog', 'origin', 'ubisoft', 'playstation', 'xbox', 'nintendo', 'riotgames', 'unity', 'unrealengine', 'godotengine', 'roblox', 'minecraft'],
    'ecommerce': ['shopify', 'woocommerce', 'magento', 'bigcommerce', 'stripe', 'paypal', 'squarespace', 'wix', 'amazon', 'ebay', 'etsy'],
    'browsers': ['googlechrome', 'firefox', 'safari', 'microsoftedge', 'opera', 'brave', 'vivaldi', 'tor'],
    'os': ['windows', 'apple', 'linux', 'ubuntu', 'fedora', 'debian', 'archlinux', 'centos', 'android', 'ios'],
};

// Categorize slugs
const SLUG_TO_CATEGORY: Record<string, string> = {};
for (const [category, slugs] of Object.entries(BRAND_CATEGORIES)) {
    for (const slug of slugs) {
        SLUG_TO_CATEGORY[slug] = category;
    }
}

for (const [key, icon] of Object.entries(simpleIcons)) {
    if (key.startsWith('si') && typeof icon === 'object' && icon !== null) {
        const si = icon as SimpleIcon;
        if (si.slug && si.path && si.title) {
            const name = si.slug;
            SIMPLE_PATHS[name] = si.path;
            SIMPLE_TITLES[name] = si.title;
            ALL_SIMPLE_ICONS.push(name);

            // Determine category
            const category = SLUG_TO_CATEGORY[name] || 'Other';

            // Generate tags from title
            const titleParts = si.title.toLowerCase().split(/\s+/).filter((p) => p.length > 2);

            SIMPLE_METADATA[name] = {
                name,
                tags: [category, si.title],
                aliases: titleParts,
            };
        }
    }
}

ALL_SIMPLE_ICONS.sort();

export function getSimpleIconPath(name: string): string | undefined {
    return SIMPLE_PATHS[name];
}

export function getSimpleIconMetadata(name: string): IconMetadata | undefined {
    return SIMPLE_METADATA[name];
}

export function getSimpleIconTitle(name: string): string | undefined {
    return SIMPLE_TITLES[name];
}

export function getAllSimpleIconNames(): string[] {
    return ALL_SIMPLE_ICONS;
}

// Search implementation
function searchSimple(query: string, options?: Partial<SearchOptions>): SearchResult[] {
    const opts: SearchOptions = {...DEFAULT_SEARCH_OPTIONS, ...options};
    const results: SearchResult[] = [];
    const q = query.trim();

    if (!q) {
        return results;
    }

    for (const name of ALL_SIMPLE_ICONS) {
        if (results.length >= (opts.limit || 100)) {
            break;
        }

        const metadata = SIMPLE_METADATA[name];
        if (!metadata) {
            continue;
        }

        const match = matchesSearch(metadata, q, opts);
        if (match.matched && match.field && match.value) {
            results.push({
                library: 'simple',
                name,
                matchedField: match.field,
                matchedValue: match.value,
            });
        }
    }

    return results;
}

// Build categories
function buildCategories(): IconCategory[] {
    const categoryMap: Record<string, string[]> = {};

    for (const name of ALL_SIMPLE_ICONS) {
        const category = SLUG_TO_CATEGORY[name] || 'other';
        if (!categoryMap[category]) {
            categoryMap[category] = [];
        }
        if (categoryMap[category].length < 100) {
            categoryMap[category].push(name);
        }
    }

    const categoryNames: Record<string, string> = {
        'social': 'Social Media',
        'development': 'Development',
        'communication': 'Communication',
        'productivity': 'Productivity',
        'media': 'Media & Entertainment',
        'gaming': 'Gaming',
        'ecommerce': 'E-commerce',
        'browsers': 'Browsers',
        'os': 'Operating Systems',
        'other': 'Other Brands',
    };

    return Object.entries(categoryMap)
        .filter(([_, icons]) => icons.length > 0)
        .map(([id, iconNames]) => ({
            id,
            name: categoryNames[id] || id,
            iconNames,
        }))
        .sort((a, b) => {
            // Put 'other' last
            if (a.id === 'other') {
                return 1;
            }
            if (b.id === 'other') {
                return -1;
            }
            return a.name.localeCompare(b.name);
        });
}

const SIMPLE_CATEGORIES = buildCategories();

export const simpleLibrary: IconLibrary = {
    id: 'simple',
    name: 'Brands',
    prefix: 'simple:',
    iconCount: ALL_SIMPLE_ICONS.length,
    categories: SIMPLE_CATEGORIES,
    getIconPath: getSimpleIconPath,
    getIconMetadata: getSimpleIconMetadata,
    getAllIconNames: getAllSimpleIconNames,
    search: searchSimple,
};
