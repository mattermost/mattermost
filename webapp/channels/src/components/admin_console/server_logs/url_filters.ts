// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {TimeRange} from './types';
import {LEVEL_GROUPS, SEARCH_MAX_LENGTH} from './utils';
import type {LevelGroup} from './utils';

// Only the filters are shared. Live tail and display preferences stay with each browser
export type UrlFilters = {
    search: string;
    enabledLevels: Set<string>;
    node: string;
    timeRange: TimeRange;
};

const PARAMS = ['search', 'levels', 'node', 'range', 'from', 'to'] as const;

// An offset is required so a shared range means the same moment in every timezone
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

function parseDate(value: string | null): number | null {
    if (value === null || !ISO_DATE.test(value)) {
        return null;
    }
    const time = Date.parse(value);
    return Number.isNaN(time) || !isRealDate(value) ? null : time;
}

// Date.parse rolls a date like February 30 over into March instead of rejecting it
function isRealDate(value: string): boolean {
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isLevelGroup(level: string): level is LevelGroup {
    return LEVEL_GROUPS.includes(level as LevelGroup);
}

// Invalid values are left out, so the viewer falls back to what it would show without them
export function parseUrlFilters(query: string, presetMinutes: readonly number[]): Partial<UrlFilters> {
    const params = new URLSearchParams(query);
    const filters: Partial<UrlFilters> = {};

    const search = params.get('search');

    // The server counts characters, not UTF-16 code units
    if (search && Array.from(search).length <= SEARCH_MAX_LENGTH) {
        filters.search = search;
    }

    const levels = params.get('levels')?.split(',').filter(isLevelGroup);
    if (levels?.length) {
        filters.enabledLevels = new Set(levels);
    }

    const node = params.get('node');
    if (node) {
        filters.node = node;
    }

    const from = parseDate(params.get('from'));
    const to = parseDate(params.get('to'));
    const range = Number(params.get('range'));
    if (from !== null && to !== null && from < to) {
        filters.timeRange = {from, to};
    } else if (presetMinutes.includes(range)) {
        filters.timeRange = range;
    }

    return filters;
}

// Keeps any other parameters, and leaves out filters at their defaults. Null removes every filter
export function withUrlFilters(query: string, filters: UrlFilters | null): string {
    const params = new URLSearchParams(query);
    PARAMS.forEach((param) => params.delete(param));

    if (filters) {
        const {search, enabledLevels, node, timeRange} = filters;
        if (search) {
            params.set('search', search);
        }
        if (!LEVEL_GROUPS.every((level) => enabledLevels.has(level))) {
            params.set('levels', LEVEL_GROUPS.filter((level) => enabledLevels.has(level)).join(','));
        }
        if (node) {
            params.set('node', node);
        }
        if (typeof timeRange === 'number') {
            params.set('range', String(timeRange));
        } else if (timeRange) {
            params.set('from', new Date(timeRange.from).toISOString());
            params.set('to', new Date(timeRange.to).toISOString());
        }
    }

    // Commas and colons are allowed in a query string, and keep shared links readable
    const next = params.toString().replace(/%2C/g, ',').replace(/%3A/g, ':');
    return next ? `?${next}` : '';
}
