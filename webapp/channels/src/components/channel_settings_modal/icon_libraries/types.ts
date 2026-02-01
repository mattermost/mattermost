// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type IconDefinition = {
    name: string;
    path: string;
    aliases?: string[];
};

export type IconCategory = {
    id: string;
    name: string;
    icons: IconDefinition[];
};

export type IconLibrary = {
    id: 'mdi' | 'lucide';
    name: string;
    prefix: string;
    categories: IconCategory[];
};

export type IconFormat = 'mdi' | 'lucide' | 'svg' | 'none';

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
