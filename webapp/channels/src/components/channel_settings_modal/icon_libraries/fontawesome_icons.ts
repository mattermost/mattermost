// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Font Awesome Free - Solid & Regular icons
// https://fontawesome.com - CC BY 4.0 License (icons), SIL OFL 1.1 (fonts), MIT (code)

import * as fasSolid from '@fortawesome/free-solid-svg-icons';
import * as fasRegular from '@fortawesome/free-regular-svg-icons';

import type {
    IconLibrary,
    IconCategory,
    IconMetadata,
    SearchResult,
    SearchOptions,
} from './types';
import {DEFAULT_SEARCH_OPTIONS, matchesSearch} from './types';

// Font Awesome icon type
type FAIcon = {
    prefix: string;
    iconName: string;
    icon: [number, number, string[], string, string | string[]]; // [width, height, ligatures, unicode, svgPathData]
};

// Build the icon data maps
const FA_PATHS: Record<string, string> = {};
const ALL_FA_ICONS: string[] = [];
const FA_METADATA: Record<string, IconMetadata> = {};

// Category mappings based on Font Awesome's official categories
const FA_CATEGORIES: Record<string, string[]> = {
    'accessibility': ['wheelchair', 'wheelchair-move', 'universal-access', 'audio-description', 'braille', 'closed-captioning', 'deaf', 'hands-asl-interpreting', 'question', 'circle-info', 'circle-question'],
    'arrows': ['arrow-up', 'arrow-down', 'arrow-left', 'arrow-right', 'arrows-rotate', 'arrow-rotate-left', 'arrow-rotate-right', 'chevron-up', 'chevron-down', 'chevron-left', 'chevron-right', 'angles-up', 'angles-down', 'angles-left', 'angles-right', 'caret-up', 'caret-down', 'caret-left', 'caret-right', 'circle-arrow-up', 'circle-arrow-down', 'circle-arrow-left', 'circle-arrow-right', 'arrow-up-long', 'arrow-down-long', 'arrow-left-long', 'arrow-right-long', 'up-down', 'left-right', 'arrow-up-right-from-square', 'arrow-right-to-bracket', 'arrow-right-from-bracket', 'reply', 'share', 'retweet', 'rotate', 'rotate-left', 'rotate-right'],
    'buildings': ['house', 'home', 'building', 'building-columns', 'landmark', 'city', 'hospital', 'school', 'church', 'mosque', 'synagogue', 'store', 'warehouse', 'industry', 'hotel', 'igloo', 'monument', 'place-of-worship', 'shop'],
    'business': ['briefcase', 'chart-line', 'chart-bar', 'chart-pie', 'chart-area', 'coins', 'money-bill', 'money-bill-wave', 'wallet', 'credit-card', 'piggy-bank', 'handshake', 'building-columns', 'sack-dollar', 'file-invoice', 'file-invoice-dollar', 'receipt', 'landmark', 'scale-balanced', 'gavel', 'stamp', 'pen-to-square', 'calculator', 'percent'],
    'communication': ['comment', 'comments', 'message', 'envelope', 'envelope-open', 'paper-plane', 'phone', 'phone-volume', 'mobile', 'mobile-screen', 'fax', 'inbox', 'at', 'hashtag', 'quote-left', 'quote-right', 'bullhorn', 'tower-broadcast', 'satellite-dish', 'rss', 'podcast', 'voicemail'],
    'connectivity': ['wifi', 'signal', 'satellite', 'tower-cell', 'tower-broadcast', 'ethernet', 'network-wired', 'cloud', 'cloud-arrow-up', 'cloud-arrow-down', 'database', 'server', 'sitemap', 'share-nodes'],
    'editing': ['pen', 'pencil', 'pen-to-square', 'eraser', 'highlighter', 'marker', 'paintbrush', 'palette', 'fill-drip', 'eye-dropper', 'crop', 'crop-simple', 'scissors', 'cut', 'copy', 'paste', 'clone', 'wand-magic', 'wand-magic-sparkles', 'brush', 'spray-can', 'swatchbook'],
    'files': ['file', 'file-lines', 'file-pdf', 'file-word', 'file-excel', 'file-powerpoint', 'file-image', 'file-video', 'file-audio', 'file-code', 'file-zipper', 'file-csv', 'folder', 'folder-open', 'folder-plus', 'folder-minus', 'folder-tree', 'box-archive', 'book', 'book-open', 'bookmark', 'newspaper', 'note-sticky'],
    'interfaces': ['gear', 'gears', 'sliders', 'toggle-on', 'toggle-off', 'bars', 'bars-progress', 'list', 'list-ul', 'list-ol', 'list-check', 'table', 'table-cells', 'table-columns', 'table-list', 'grip', 'grip-lines', 'grip-vertical', 'ellipsis', 'ellipsis-vertical', 'plus', 'minus', 'xmark', 'check', 'magnifying-glass', 'filter', 'sort', 'expand', 'compress', 'maximize', 'minimize', 'window-maximize', 'window-minimize', 'window-restore'],
    'logistics': ['truck', 'truck-fast', 'truck-ramp-box', 'truck-loading', 'box', 'boxes-stacked', 'boxes-packing', 'dolly', 'pallet', 'warehouse', 'barcode', 'qrcode', 'clipboard-list', 'route', 'map-location', 'map-location-dot', 'location-dot', 'location-pin', 'location-crosshairs', 'shipping-fast', 'cart-shopping', 'basket-shopping', 'store', 'cash-register'],
    'maps': ['map', 'map-location', 'map-location-dot', 'location-dot', 'location-pin', 'location-crosshairs', 'compass', 'globe', 'earth-americas', 'earth-europe', 'earth-asia', 'earth-africa', 'earth-oceania', 'mountain', 'mountain-sun', 'tree', 'tree-city', 'road', 'route', 'signs-post', 'flag', 'flag-checkered'],
    'medical': ['heart', 'heart-pulse', 'stethoscope', 'syringe', 'pills', 'capsules', 'tablets', 'prescription-bottle', 'prescription-bottle-medical', 'flask', 'vial', 'vials', 'dna', 'virus', 'viruses', 'bacteria', 'bacterium', 'biohazard', 'radiation', 'hospital', 'hospital-user', 'bed-pulse', 'wheelchair', 'crutch', 'user-doctor', 'user-nurse', 'tooth', 'teeth', 'teeth-open', 'lungs', 'brain', 'bone', 'x-ray'],
    'media': ['play', 'pause', 'stop', 'forward', 'backward', 'forward-step', 'backward-step', 'forward-fast', 'backward-fast', 'volume-high', 'volume-low', 'volume-off', 'volume-xmark', 'music', 'headphones', 'microphone', 'microphone-slash', 'record-vinyl', 'radio', 'podcast', 'video', 'film', 'tv', 'camera', 'camera-retro', 'photo-film', 'image', 'images', 'panorama', 'circle-play', 'circle-pause', 'circle-stop'],
    'money': ['dollar-sign', 'euro-sign', 'sterling-sign', 'yen-sign', 'ruble-sign', 'rupee-sign', 'bitcoin-sign', 'money-bill', 'money-bill-wave', 'money-bills', 'money-check', 'money-check-dollar', 'coins', 'coin', 'piggy-bank', 'vault', 'wallet', 'credit-card', 'sack-dollar', 'sack-xmark', 'hand-holding-dollar', 'file-invoice-dollar', 'receipt', 'cash-register', 'chart-line'],
    'nature': ['sun', 'moon', 'star', 'cloud', 'cloud-sun', 'cloud-moon', 'cloud-rain', 'cloud-showers-heavy', 'cloud-bolt', 'snowflake', 'umbrella', 'wind', 'temperature-half', 'temperature-high', 'temperature-low', 'tree', 'leaf', 'seedling', 'flower', 'clover', 'mountain', 'water', 'fire', 'fire-flame-curved', 'rainbow'],
    'security': ['lock', 'lock-open', 'unlock', 'key', 'shield', 'shield-halved', 'user-shield', 'user-lock', 'eye', 'eye-slash', 'mask', 'fingerprint', 'id-card', 'id-badge', 'passport', 'file-shield', 'vault', 'door-open', 'door-closed', 'ban', 'circle-exclamation', 'triangle-exclamation', 'skull-crossbones', 'biohazard', 'radiation'],
    'shapes': ['circle', 'square', 'square-full', 'heart', 'star', 'diamond', 'play', 'certificate', 'bookmark', 'shield', 'cloud', 'comment', 'bolt', 'location-dot', 'crown', 'gem', 'bell', 'cube', 'cubes', 'shapes'],
    'social': ['thumbs-up', 'thumbs-down', 'heart', 'star', 'share', 'share-nodes', 'retweet', 'comment', 'comments', 'at', 'hashtag', 'user', 'users', 'user-plus', 'user-group', 'people-group', 'handshake', 'hands-clapping', 'face-smile', 'face-grin', 'face-laugh', 'face-sad-tear', 'face-angry', 'face-meh'],
    'sports': ['basketball', 'football', 'baseball', 'baseball-bat-ball', 'bowling-ball', 'golf-ball-tee', 'hockey-puck', 'table-tennis-paddle-ball', 'volleyball', 'futbol', 'trophy', 'medal', 'ranking-star', 'stopwatch', 'flag-checkered', 'person-running', 'person-swimming', 'person-biking', 'person-skiing', 'person-snowboarding', 'dumbbell', 'person-walking', 'bicycle'],
    'text': ['font', 'bold', 'italic', 'underline', 'strikethrough', 'text-height', 'text-width', 'align-left', 'align-center', 'align-right', 'align-justify', 'indent', 'outdent', 'list-ul', 'list-ol', 'quote-left', 'quote-right', 'paragraph', 'heading', 'subscript', 'superscript', 'spell-check', 'highlighter', 'font-awesome'],
    'time': ['clock', 'hourglass', 'hourglass-start', 'hourglass-half', 'hourglass-end', 'stopwatch', 'calendar', 'calendar-days', 'calendar-check', 'calendar-plus', 'calendar-minus', 'calendar-xmark', 'bell', 'bell-slash', 'alarm-clock', 'history', 'timeline'],
    'toggle': ['toggle-on', 'toggle-off', 'check', 'xmark', 'circle-check', 'circle-xmark', 'square-check', 'square-xmark', 'thumbs-up', 'thumbs-down', 'eye', 'eye-slash', 'star', 'heart', 'bookmark', 'bell', 'bell-slash'],
    'travel': ['plane', 'plane-departure', 'plane-arrival', 'helicopter', 'rocket', 'car', 'car-side', 'taxi', 'bus', 'bus-simple', 'train', 'train-subway', 'ship', 'ferry', 'anchor', 'sailboat', 'bicycle', 'motorcycle', 'truck', 'van-shuttle', 'caravan', 'campground', 'tent', 'mountain-sun', 'umbrella-beach', 'suitcase', 'suitcase-rolling', 'passport', 'ticket', 'map'],
    'users': ['user', 'user-plus', 'user-minus', 'user-xmark', 'user-check', 'user-clock', 'user-gear', 'user-lock', 'user-shield', 'user-tie', 'user-secret', 'user-ninja', 'user-astronaut', 'user-doctor', 'user-nurse', 'users', 'user-group', 'people-group', 'people-arrows', 'children', 'person', 'person-dress', 'id-card', 'id-badge', 'address-card', 'address-book'],
};

const CATEGORY_NAMES: Record<string, string> = {
    'accessibility': 'Accessibility',
    'arrows': 'Arrows',
    'buildings': 'Buildings',
    'business': 'Business',
    'communication': 'Communication',
    'connectivity': 'Connectivity',
    'editing': 'Editing',
    'files': 'Files',
    'interfaces': 'Interfaces',
    'logistics': 'Logistics',
    'maps': 'Maps',
    'medical': 'Medical',
    'media': 'Media',
    'money': 'Money',
    'nature': 'Nature',
    'security': 'Security',
    'shapes': 'Shapes',
    'social': 'Social',
    'sports': 'Sports',
    'text': 'Text',
    'time': 'Time',
    'toggle': 'Toggle',
    'travel': 'Travel',
    'users': 'Users',
};

// Reverse mapping for quick category lookup
const ICON_TO_CATEGORY: Record<string, string> = {};
for (const [category, icons] of Object.entries(FA_CATEGORIES)) {
    for (const icon of icons) {
        ICON_TO_CATEGORY[icon] = category;
    }
}

// Process solid icons
for (const [key, icon] of Object.entries(fasSolid)) {
    if (key.startsWith('fa') && typeof icon === 'object' && icon !== null && 'iconName' in icon) {
        const faIcon = icon as FAIcon;
        if (faIcon.iconName && faIcon.icon) {
            const name = faIcon.iconName;
            // Skip if already added (prefer solid over regular)
            if (FA_PATHS[name]) {
                continue;
            }

            // Get the path data (last element of the icon array)
            const pathData = faIcon.icon[4];
            const path = Array.isArray(pathData) ? pathData.join(' ') : pathData;

            FA_PATHS[name] = path;
            ALL_FA_ICONS.push(name);

            // Generate tags
            const tags: string[] = [];
            const category = ICON_TO_CATEGORY[name];
            if (category) {
                tags.push(CATEGORY_NAMES[category] || category);
            }

            // Generate aliases from name parts
            const nameParts = name.split('-').filter((p) => p.length > 2);

            FA_METADATA[name] = {
                name,
                tags,
                aliases: nameParts,
            };
        }
    }
}

// Process regular icons (only if not already in solid)
for (const [key, icon] of Object.entries(fasRegular)) {
    if (key.startsWith('fa') && typeof icon === 'object' && icon !== null && 'iconName' in icon) {
        const faIcon = icon as FAIcon;
        if (faIcon.iconName && faIcon.icon) {
            const name = faIcon.iconName;
            // Skip if already added from solid
            if (FA_PATHS[name]) {
                continue;
            }

            const pathData = faIcon.icon[4];
            const path = Array.isArray(pathData) ? pathData.join(' ') : pathData;

            FA_PATHS[name] = path;
            ALL_FA_ICONS.push(name);

            const tags: string[] = [];
            const category = ICON_TO_CATEGORY[name];
            if (category) {
                tags.push(CATEGORY_NAMES[category] || category);
            }

            const nameParts = name.split('-').filter((p) => p.length > 2);

            FA_METADATA[name] = {
                name,
                tags,
                aliases: nameParts,
            };
        }
    }
}

ALL_FA_ICONS.sort();

export function getFontAwesomeIconPath(name: string): string | undefined {
    return FA_PATHS[name];
}

export function getFontAwesomeIconMetadata(name: string): IconMetadata | undefined {
    return FA_METADATA[name];
}

export function getAllFontAwesomeIconNames(): string[] {
    return ALL_FA_ICONS;
}

// Search implementation
function searchFontAwesome(query: string, options?: Partial<SearchOptions>): SearchResult[] {
    const opts: SearchOptions = {...DEFAULT_SEARCH_OPTIONS, ...options};
    const results: SearchResult[] = [];
    const q = query.trim();

    if (!q) {
        return results;
    }

    for (const name of ALL_FA_ICONS) {
        if (results.length >= (opts.limit || 100)) {
            break;
        }

        const metadata = FA_METADATA[name];
        if (!metadata) {
            continue;
        }

        const match = matchesSearch(metadata, q, opts);
        if (match.matched && match.field && match.value) {
            results.push({
                library: 'fontawesome',
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
    const categories: IconCategory[] = [];

    for (const [id, iconNames] of Object.entries(FA_CATEGORIES)) {
        // Filter to only include icons we actually have
        const validIcons = iconNames.filter((name) => FA_PATHS[name]);
        if (validIcons.length > 0) {
            categories.push({
                id,
                name: CATEGORY_NAMES[id] || id,
                iconNames: validIcons,
            });
        }
    }

    return categories.sort((a, b) => a.name.localeCompare(b.name));
}

const FA_CATEGORIES_LIST = buildCategories();

export const fontawesomeLibrary: IconLibrary = {
    id: 'fontawesome',
    name: 'Font Awesome',
    prefix: 'fontawesome:',
    iconCount: ALL_FA_ICONS.length,
    categories: FA_CATEGORIES_LIST,
    getIconPath: getFontAwesomeIconPath,
    getIconMetadata: getFontAwesomeIconMetadata,
    getAllIconNames: getAllFontAwesomeIconNames,
    search: searchFontAwesome,
};
