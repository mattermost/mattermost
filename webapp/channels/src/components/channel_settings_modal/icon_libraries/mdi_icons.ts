// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Material Design Icons - All 7400+ icons from @mdi/js
// https://materialdesignicons.com - Apache 2.0 / MIT License

import * as mdiIcons from '@mdi/js';

import type {
    IconLibrary,
    IconCategory,
    IconMetadata,
    SearchResult,
    SearchOptions,
    SearchField,
} from './types';
import {DEFAULT_SEARCH_OPTIONS, matchesSearch} from './types';

// Convert mdiIconName to icon-name (e.g., mdiAccountAlert -> account-alert)
function mdiNameToIconName(mdiName: string): string {
    return mdiName
        .replace(/^mdi/, '')
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .toLowerCase();
}

// Build the icon map from all mdi exports
const MDI_ICON_MAP: Record<string, string> = {};
const ALL_MDI_ICONS: string[] = [];
const MDI_METADATA: Record<string, IconMetadata> = {};

for (const [key, value] of Object.entries(mdiIcons)) {
    if (key.startsWith('mdi') && typeof value === 'string') {
        const iconName = mdiNameToIconName(key);
        MDI_ICON_MAP[iconName] = value;
        ALL_MDI_ICONS.push(iconName);

        // Generate metadata from icon name
        // Split name into searchable parts (e.g., "account-alert" -> ["account", "alert"])
        const nameParts = iconName.split('-');

        // Generate tags from name patterns
        const tags: string[] = [];
        if (iconName.includes('account') || iconName.includes('user') || iconName.includes('human')) {
            tags.push('Account / User');
        }
        if (iconName.includes('alert') || iconName.includes('error') || iconName.includes('warning')) {
            tags.push('Alert / Error');
        }
        if (iconName.includes('arrow') || iconName.includes('chevron')) {
            tags.push('Arrow');
        }
        if (iconName.includes('music') || iconName.includes('audio') || iconName.includes('volume') || iconName.includes('speaker')) {
            tags.push('Audio');
        }
        if (iconName.includes('github') || iconName.includes('google') || iconName.includes('facebook') ||
            iconName.includes('twitter') || iconName.includes('discord') || iconName.includes('youtube')) {
            tags.push('Brand / Logo');
        }
        if (iconName.includes('calendar') || iconName.includes('clock') || iconName.includes('time')) {
            tags.push('Date / Time');
        }
        if (iconName.includes('code') || iconName.includes('console') || iconName.includes('terminal') ||
            iconName.includes('database') || iconName.includes('server') || iconName.includes('git')) {
            tags.push('Developer / Languages');
        }
        if (iconName.includes('laptop') || iconName.includes('phone') || iconName.includes('tablet') ||
            iconName.includes('computer') || iconName.includes('monitor')) {
            tags.push('Device / Tech');
        }
        if (iconName.includes('file') || iconName.includes('folder') || iconName.includes('document')) {
            tags.push('Files / Folders');
        }
        if (iconName.includes('food') || iconName.includes('pizza') || iconName.includes('coffee') ||
            iconName.includes('drink') || iconName.includes('cup')) {
            tags.push('Food / Drink');
        }
        if (iconName.includes('game') || iconName.includes('controller') || iconName.includes('dice') ||
            iconName.includes('chess') || iconName.includes('puzzle')) {
            tags.push('Gaming / RPG');
        }
        if (iconName.includes('heart') || iconName.includes('medical') || iconName.includes('hospital') ||
            iconName.includes('pill') || iconName.includes('health')) {
            tags.push('Health / Beauty');
        }
        if (iconName.includes('home') || iconName.includes('house') || iconName.includes('building')) {
            tags.push('Home Automation');
        }
        if (iconName.includes('lock') || iconName.includes('key') || iconName.includes('shield') ||
            iconName.includes('security')) {
            tags.push('Lock');
        }
        if (iconName.includes('map') || iconName.includes('location') || iconName.includes('pin') ||
            iconName.includes('earth') || iconName.includes('globe')) {
            tags.push('Navigation');
        }
        if (iconName.includes('weather') || iconName.includes('sun') || iconName.includes('cloud') ||
            iconName.includes('rain') || iconName.includes('snow')) {
            tags.push('Weather');
        }
        if (iconName.includes('video') || iconName.includes('movie') || iconName.includes('camera') ||
            iconName.includes('film')) {
            tags.push('Video / Movie');
        }
        if (iconName.includes('message') || iconName.includes('chat') || iconName.includes('comment') ||
            iconName.includes('email') || iconName.includes('phone') || iconName.includes('bell')) {
            tags.push('Communication');
        }
        if (iconName.includes('cart') || iconName.includes('shop') || iconName.includes('store') ||
            iconName.includes('basket') || iconName.includes('credit')) {
            tags.push('Shopping');
        }
        if (iconName.includes('car') || iconName.includes('bus') || iconName.includes('train') ||
            iconName.includes('airplane') || iconName.includes('plane') || iconName.includes('truck')) {
            tags.push('Transportation');
        }
        if (iconName.includes('wrench') || iconName.includes('hammer') || iconName.includes('tool') ||
            iconName.includes('cog') || iconName.includes('settings')) {
            tags.push('Hardware / Tools');
        }

        MDI_METADATA[iconName] = {
            name: iconName,
            tags,
            aliases: nameParts.filter((p) => p.length > 2), // Use name parts as pseudo-aliases
        };
    }
}

ALL_MDI_ICONS.sort();

export function getMdiIconPath(name: string): string | undefined {
    return MDI_ICON_MAP[name];
}

export function getMdiIconMetadata(name: string): IconMetadata | undefined {
    return MDI_METADATA[name];
}

export function getAllMdiIconNames(): string[] {
    return ALL_MDI_ICONS;
}

// Search implementation
function searchMdi(query: string, options?: Partial<SearchOptions>): SearchResult[] {
    const opts: SearchOptions = {...DEFAULT_SEARCH_OPTIONS, ...options};
    const results: SearchResult[] = [];
    const q = query.trim();

    if (!q) {
        return results;
    }

    for (const name of ALL_MDI_ICONS) {
        if (results.length >= (opts.limit || 100)) {
            break;
        }

        const metadata = MDI_METADATA[name];
        if (!metadata) {
            continue;
        }

        const match = matchesSearch(metadata, q, opts);
        if (match.matched && match.field && match.value) {
            results.push({
                library: 'mdi',
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
        'account': [],
        'alert': [],
        'arrow': [],
        'audio': [],
        'brand': [],
        'calendar': [],
        'chat': [],
        'code': [],
        'device': [],
        'file': [],
        'food': [],
        'gaming': [],
        'health': [],
        'home': [],
        'map': [],
        'media': [],
        'nature': [],
        'security': [],
        'shape': [],
        'shopping': [],
        'social': [],
        'sport': [],
        'tools': [],
        'transport': [],
    };

    const categoryFilters: Record<string, (name: string) => boolean> = {
        'account': (n) => n.includes('account') || n.includes('user') || n.includes('human') || n.includes('face'),
        'alert': (n) => n.includes('alert') || n.includes('error') || n.includes('warning'),
        'arrow': (n) => n.includes('arrow') || n.includes('chevron') || n.includes('navigation'),
        'audio': (n) => n.includes('music') || n.includes('audio') || n.includes('volume') || n.includes('speaker') || n.includes('microphone'),
        'brand': (n) => n.includes('github') || n.includes('google') || n.includes('facebook') || n.includes('twitter') || n.includes('discord') || n.includes('youtube') || n.includes('slack') || n.includes('steam'),
        'calendar': (n) => n.includes('calendar') || n.includes('clock') || n.includes('timer') || n.includes('time'),
        'chat': (n) => n.includes('chat') || n.includes('message') || n.includes('comment') || n.includes('forum') || n.includes('email') || n.includes('bell'),
        'code': (n) => n.includes('code') || n.includes('console') || n.includes('terminal') || n.includes('bug') || n.includes('git') || n.includes('database') || n.includes('server'),
        'device': (n) => n.includes('laptop') || n.includes('desktop') || n.includes('monitor') || n.includes('phone') || n.includes('tablet') || n.includes('computer'),
        'file': (n) => n.includes('file') || n.includes('folder') || n.includes('document'),
        'food': (n) => n.includes('food') || n.includes('pizza') || n.includes('coffee') || n.includes('beer') || n.includes('cup') || n.includes('glass'),
        'gaming': (n) => n.includes('gamepad') || n.includes('controller') || n.includes('game') || n.includes('dice') || n.includes('chess') || n.includes('puzzle') || n.includes('sword'),
        'health': (n) => n.includes('heart') || n.includes('medical') || n.includes('hospital') || n.includes('pill') || n.includes('health'),
        'home': (n) => n.includes('home') || n.includes('house') || n.includes('building') || n.includes('office'),
        'map': (n) => n.includes('map') || n.includes('earth') || n.includes('globe') || n.includes('location') || n.includes('pin') || n.includes('compass'),
        'media': (n) => n.includes('video') || n.includes('movie') || n.includes('camera') || n.includes('image') || n.includes('photo') || n.includes('play'),
        'nature': (n) => n.includes('weather') || n.includes('sun') || n.includes('moon') || n.includes('cloud') || n.includes('tree') || n.includes('leaf') || n.includes('flower') || n.includes('water'),
        'security': (n) => n.includes('lock') || n.includes('key') || n.includes('shield') || n.includes('security') || n.includes('safe'),
        'shape': (n) => n.includes('circle') || n.includes('square') || n.includes('triangle') || n.includes('rectangle') || n.includes('hexagon') || n.includes('star'),
        'shopping': (n) => n.includes('cart') || n.includes('shop') || n.includes('store') || n.includes('basket') || n.includes('credit') || n.includes('wallet'),
        'social': (n) => n.includes('thumb') || n.includes('like') || n.includes('share') || n.includes('bookmark') || n.includes('emoticon'),
        'sport': (n) => n.includes('basketball') || n.includes('football') || n.includes('soccer') || n.includes('tennis') || n.includes('golf') || n.includes('run') || n.includes('bike'),
        'tools': (n) => n.includes('wrench') || n.includes('hammer') || n.includes('screwdriver') || n.includes('tool') || n.includes('cog') || n.includes('settings'),
        'transport': (n) => n.includes('car') || n.includes('bus') || n.includes('train') || n.includes('airplane') || n.includes('plane') || n.includes('truck') || n.includes('rocket'),
    };

    const categoryNames: Record<string, string> = {
        'account': 'Account / User',
        'alert': 'Alert / Error',
        'arrow': 'Arrow / Navigation',
        'audio': 'Audio / Music',
        'brand': 'Brand / Logo',
        'calendar': 'Calendar / Date',
        'chat': 'Chat / Communication',
        'code': 'Code / Development',
        'device': 'Device / Tech',
        'file': 'Files / Folders',
        'food': 'Food / Drink',
        'gaming': 'Gaming',
        'health': 'Health / Medical',
        'home': 'Home / Building',
        'map': 'Map / Places',
        'media': 'Media / Video',
        'nature': 'Nature / Weather',
        'security': 'Security / Lock',
        'shape': 'Shapes',
        'shopping': 'Shopping / Commerce',
        'social': 'Social / People',
        'sport': 'Sport / Fitness',
        'tools': 'Tools / Hardware',
        'transport': 'Transportation',
    };

    // Populate categories
    for (const name of ALL_MDI_ICONS) {
        for (const [catId, filter] of Object.entries(categoryFilters)) {
            if (filter(name) && categoryMap[catId].length < 100) {
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

const MDI_CATEGORIES = buildCategories();

export const mdiLibrary: IconLibrary = {
    id: 'mdi',
    name: 'Material Design',
    prefix: 'mdi:',
    iconCount: ALL_MDI_ICONS.length,
    categories: MDI_CATEGORIES,
    getIconPath: getMdiIconPath,
    getIconMetadata: getMdiIconMetadata,
    getAllIconNames: getAllMdiIconNames,
    search: searchMdi,
};
