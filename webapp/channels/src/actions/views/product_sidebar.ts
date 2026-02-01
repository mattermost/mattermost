// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {getPinnedProductIds} from 'selectors/views/product_sidebar';

import {Preferences} from 'utils/constants';

import type {ActionFuncAsync} from 'types/store';

/**
 * Toggles the pin state of a product in the sidebar.
 * If the product is pinned, it will be unpinned, and vice versa.
 * The updated pin state is persisted to the server via user preferences.
 */
export function toggleProductPin(productId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const currentUserId = getCurrentUserId(state);
        const currentPinned = getPinnedProductIds(state);

        let newPinned: string[];
        if (currentPinned.includes(productId)) {
            // Unpin the product
            newPinned = currentPinned.filter((id) => id !== productId);
        } else {
            // Pin the product
            newPinned = [...currentPinned, productId];
        }

        const preference = {
            user_id: currentUserId,
            category: Preferences.PINNED_PRODUCTS_CATEGORY,
            name: Preferences.PINNED_PRODUCTS_NAME,
            value: newPinned.join(','),
        };

        return dispatch(savePreferences(currentUserId, [preference]));
    };
}
