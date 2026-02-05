// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSelector} from 'reselect';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import type {GlobalState} from 'types/store';

/**
 * Returns true if ThreadsInSidebar behavior should be active.
 * This is true if either:
 * - ThreadsInSidebar feature flag is enabled, OR
 * - GuildedChatLayout feature flag is enabled (auto-enables ThreadsInSidebar)
 */
export const isThreadsInSidebarActive = createSelector(
    'isThreadsInSidebarActive',
    getConfig,
    (config): boolean => {
        return (
            config.FeatureFlagThreadsInSidebar === 'true' ||
            config.FeatureFlagGuildedChatLayout === 'true'
        );
    },
);

/**
 * Returns true if the full Guilded layout is enabled (feature flag only, ignores viewport).
 */
export const isGuildedLayoutEnabled = createSelector(
    'isGuildedLayoutEnabled',
    getConfig,
    (config): boolean => {
        return config.FeatureFlagGuildedChatLayout === 'true';
    },
);

/**
 * Returns the mobile breakpoint for Guilded layout.
 */
export const GUILDED_MOBILE_BREAKPOINT = 768;

// Guilded layout view state selectors
export const getGuildedLayoutState = (state: GlobalState) => state.views.guildedLayout;

export const isTeamSidebarExpanded = createSelector(
    'isTeamSidebarExpanded',
    getGuildedLayoutState,
    (guildedLayout) => guildedLayout?.isTeamSidebarExpanded ?? false,
);

export const isDmMode = createSelector(
    'isDmMode',
    getGuildedLayoutState,
    (guildedLayout) => guildedLayout?.isDmMode ?? false,
);

export const getRhsActiveTab = createSelector(
    'getRhsActiveTab',
    getGuildedLayoutState,
    (guildedLayout) => guildedLayout?.rhsActiveTab ?? 'members',
);

export const getActiveModal = createSelector(
    'getActiveModal',
    getGuildedLayoutState,
    (guildedLayout) => guildedLayout?.activeModal ?? null,
);

export const getModalData = createSelector(
    'getModalData',
    getGuildedLayoutState,
    (guildedLayout) => guildedLayout?.modalData ?? {},
);
