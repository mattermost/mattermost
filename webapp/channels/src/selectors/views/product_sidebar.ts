// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getFeatureFlagValue} from 'mattermost-redux/selectors/entities/general';
import {get} from 'mattermost-redux/selectors/entities/preferences';

import {selectProducts} from 'selectors/products';

import {Preferences} from 'utils/constants';

import type {GlobalState} from 'types/store';

export function isProductSidebarEnabled(state: GlobalState): boolean {
    return getFeatureFlagValue(state, 'EnableProductSidebar') === 'true';
}

// First-party product IDs that should be pinned by default when installed
const FIRST_PARTY_PRODUCT_IDS = ['boards', 'playbooks', 'copilot'];

/**
 * Returns an array of pinned product IDs from user preferences.
 * If no preference exists (first time), returns default pinned products:
 * - Always includes 'channels' (hardcoded)
 * - Includes 'boards', 'playbooks', 'copilot' if those products are registered
 */
export const getPinnedProductIds = createSelector(
    'getPinnedProductIds',
    (state: GlobalState) => get(state, Preferences.PINNED_PRODUCTS_CATEGORY, Preferences.PINNED_PRODUCTS_NAME, ''),
    (state: GlobalState) => selectProducts(state),
    (pinnedPreference: string, products): string[] => {
        // If preference exists, parse comma-separated IDs
        if (pinnedPreference) {
            return pinnedPreference.split(',').filter(Boolean);
        }

        // Default pinning logic for first-time users
        // Always include 'channels'
        const defaultPinned = ['channels'];

        // Get registered product IDs
        const registeredProductIds = new Set(products?.map((p) => p.id) || []);

        // Include first-party products if they are registered
        for (const productId of FIRST_PARTY_PRODUCT_IDS) {
            if (registeredProductIds.has(productId)) {
                defaultPinned.push(productId);
            }
        }

        return defaultPinned;
    },
);

/**
 * Returns true if the given product ID is pinned.
 */
export function isProductPinned(state: GlobalState, productId: string): boolean {
    const pinnedIds = getPinnedProductIds(state);
    return pinnedIds.includes(productId);
}
