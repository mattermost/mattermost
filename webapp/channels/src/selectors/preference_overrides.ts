// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

import type {GlobalState} from 'types/store';

/**
 * Get the set of preference keys that have admin-enforced overrides.
 * Returns a Set of "category:name" strings.
 */
export const getOverriddenPreferenceKeys = createSelector(
    'getOverriddenPreferenceKeys',
    (state: GlobalState) => getConfig(state).MattermostExtendedPreferenceOverrideKeys,
    (overrideKeysStr: string | undefined): Set<string> => {
        if (!overrideKeysStr) {
            return new Set();
        }
        const keys = overrideKeysStr.split(',').filter(Boolean);
        return new Set(keys);
    },
);

/**
 * Check if a specific preference is admin-overridden.
 * @param state - The Redux state
 * @param category - The preference category (e.g., "display_settings")
 * @param name - The preference name (e.g., "use_military_time")
 * @returns true if the preference is admin-enforced
 */
export function isPreferenceOverridden(state: GlobalState, category: string, name: string): boolean {
    const overriddenKeys = getOverriddenPreferenceKeys(state);
    return overriddenKeys.has(`${category}:${name}`);
}

/**
 * Selector factory to check if a specific preference is overridden.
 * Use this for connecting to React components.
 * @param category - The preference category
 * @param name - The preference name
 */
export function makeIsPreferenceOverridden(category: string, name: string) {
    return (state: GlobalState): boolean => isPreferenceOverridden(state, category, name);
}
