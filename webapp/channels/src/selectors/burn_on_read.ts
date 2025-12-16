// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getInt} from 'mattermost-redux/selectors/entities/preferences';

import type {GlobalState} from 'types/store';

// Preference category for storing whether user has seen the Burn-on-Read tour tip
export const BURN_ON_READ_TOUR_TIP_PREFERENCE = 'burn_on_read_tour_tip';

/**
 * Returns whether the Burn-on-Read feature is enabled system-wide.
 * When enabled, users can send messages that auto-delete after being read by recipients.
 */
export const isBurnOnReadEnabled = (state: GlobalState): boolean => {
    const config = getConfig(state);
    return config.EnableBurnOnRead === 'true';
};

/**
 * Returns the configured duration (in minutes) that Burn-on-Read messages
 * remain visible after being opened by a recipient before auto-deleting.
 * Converts from backend seconds storage to user-friendly minutes.
 */
export const getBurnOnReadDurationMinutes = (state: GlobalState): number => {
    const config = getConfig(state);
    const seconds = parseInt(config.BurnOnReadDurationSeconds || '600', 10);
    return Math.floor(seconds / 60);
};

/**
 * Returns whether the current user has permission to send Burn-on-Read messages.
 * In the current MVP implementation, all users can send BoR messages when the feature is enabled.
 * Future versions may implement user/group-level restrictions.
 */
export const canUserSendBurnOnRead = (state: GlobalState): boolean => {
    // For MVP: All users can send BoR when feature is enabled
    return isBurnOnReadEnabled(state);
};

/**
 * Returns whether the current user has already seen the Burn-on-Read feature tour tip.
 * Used to determine if the tour tip pulsating dot should be displayed.
 */
export const hasSeenBurnOnReadTourTip = (state: GlobalState): boolean => {
    const currentUserId = getCurrentUserId(state);
    const value = getInt(state, BURN_ON_READ_TOUR_TIP_PREFERENCE, currentUserId, 0);
    return value === 1;
};
