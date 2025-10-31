// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';

import {getUser} from 'mattermost-redux/selectors/entities/users';

import store from 'stores/redux_store';

/**
 * Regex pattern for official tunag integration admin usernames.
 * Pattern: tunag-{5digits}-{lowercase_alphanumeric_hyphens}-admin
 * Subdomain rules: lowercase letters, numbers, hyphens
 * Example: tunag-00002-stmn-admin
 */
const OFFICIAL_INTEGRATION_ADMIN_PATTERN = /^tunag-\d{5}-[a-z0-9-]+-admin$/;

/**
 * Check if a channel is an official tunag channel based on its creator's username.
 * Official channels are created by integration admin users with usernames matching the pattern:
 * tunag-{company_id}-{subdomain}-admin
 *
 * @param {Channel | string | null | undefined} channel - Channel object (string input not supported for creator validation)
 * @returns {boolean} - true if channel is an official tunag channel, false otherwise
 */
export function isOfficialTunagChannel(channel: Channel | string | null | undefined): boolean {
    // If it's a string, we cannot validate creator, so return false
    if (typeof channel === 'string' || !channel) {
        return false;
    }

    // Check if channel has creator_id
    if (!channel.creator_id) {
        return false;
    }

    // Get the creator user from Redux store
    const state = store.getState();
    const creator = getUser(state, channel.creator_id);

    if (!creator || !creator.username) {
        return false;
    }

    // Check if creator's username matches the integration admin pattern
    return OFFICIAL_INTEGRATION_ADMIN_PATTERN.test(creator.username);
}
