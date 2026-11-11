// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {TimeRange} from './types';
import {FIELD_MAX_LENGTH, FIELD_MAX_VALUES, LEVEL_GROUPS, PLUGIN_ID_FIELD, SEARCH_MAX_LENGTH} from './utils';
import type {LevelGroup} from './utils';

// Only the filters are shared. Live tail and display preferences stay with each browser
export type UrlFilters = {
    search: string;
    enabledLevels: Set<string>;
    node: string;
    timeRange: TimeRange;
    plugins: string[];
};

const PARAMS = ['search', 'levels', 'node', 'range', 'from', 'to'] as const;

// A field filter is one parameter per value, such as field.plugin_id=github. Only the plugin is read, as it's
// the only field the viewer shows a filter for, so a link can't filter the view in a way the admin can't see or clear
const FIELD_PARAM_PREFIX = 'field.';
const PLUGIN_PARAM = FIELD_PARAM_PREFIX + PLUGIN_ID_FIELD;

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

    // Values the server would reject are left out, keeping the first ones up to its limit
    const plugins = Array.from(new Set(params.getAll(PLUGIN_PARAM))).
        filter((id) => id && Array.from(id).length <= FIELD_MAX_LENGTH).
        slice(0, FIELD_MAX_VALUES);
    if (plugins.length) {
        filters.plugins = plugins;
    }

    return filters;
}

// Keeps any other parameters, and leaves out filters at their defaults. Null removes every filter
export function withUrlFilters(query: string, filters: UrlFilters | null): string {
    const params = new URLSearchParams(query);
    PARAMS.forEach((param) => params.delete(param));
    Array.from(params.keys()).filter((param) => param.startsWith(FIELD_PARAM_PREFIX)).forEach((param) => params.delete(param));

    if (filters) {
        const {search, enabledLevels, node, timeRange, plugins} = filters;
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
        plugins.forEach((id) => params.append(PLUGIN_PARAM, id));
    }

    // Commas and colons are allowed in a query string, and keep shared links readable
    const next = params.toString().replace(/%2C/g, ',').replace(/%3A/g, ':');
    return next ? `?${next}` : '';
}
