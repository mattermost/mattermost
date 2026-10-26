// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';
import type {IDMappedObjects} from '@mattermost/types/utilities';

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getAllChannels, getMyChannelMemberships} from 'mattermost-redux/selectors/entities/channels';
import {isProductRailEnabled} from 'mattermost-redux/selectors/entities/general';
import {getBool, isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {calculateUnreadCount} from 'mattermost-redux/utils/channel_utils';

import {Preferences} from 'utils/constants';

import type {GlobalState} from 'types/store';
import type {ProductRailSection, ProductRailTab} from 'types/store/views';

/**
 * A plugin's claim that the channels its matcher accepts are of a kind, such as 'board', as
 * plugins register with registerChannelKind. That API comes with the Boards work, so this reads
 * the registrations without depending on it: until it's in, there are none, and the rail shows no
 * Home or Boards split. Once it is, this can use its ChannelKindRegistration and isBoardChannel.
 */
export type ChannelKindRegistration = {
    id: string;
    pluginId: string;
    kind: string;
    matcher: (state: GlobalState, channel: Channel) => boolean;
};

const emptyRegistrations: ChannelKindRegistration[] = [];

function getChannelKindRegistrations(state: GlobalState): ChannelKindRegistration[] {
    const components = state.plugins?.components as Record<string, unknown> | undefined;
    return (components?.ChannelKind as ChannelKindRegistration[] | undefined) ?? emptyRegistrations;
}

// As with registerChannelKind: the first registration whose matcher accepts the channel decides its
// kind, and a matcher that throws is skipped.
function isBoardChannel(state: GlobalState, channel: Channel, registrations: ChannelKindRegistration[]): boolean {
    for (const registration of registrations) {
        try {
            if (registration.matcher(state, channel) === true) {
                return registration.kind === 'board';
            }
        } catch {
            // Treat a failing matcher as not matching.
        }
    }
    return false;
}

/** Whether a plugin has registered a matcher for board channels. */
export function hasBoardChannelKind(state: GlobalState): boolean {
    return getChannelKindRegistrations(state).some((registration) => registration.kind === 'board');
}

/**
 * The ids of every loaded channel a plugin's matcher calls a board.
 *
 * The matchers take the whole state, so this can't be a plain createSelector. It recomputes when
 * the channels, the registrations or the registering plugins' own state (where a matcher like
 * Boards' looks its boards up) change, which covers what the matchers read in practice.
 */
export const getBoardChannelIds: (state: GlobalState) => Set<string> = (() => {
    let lastChannels: IDMappedObjects<Channel> | undefined;
    let lastRegistrations: ChannelKindRegistration[] | undefined;
    let lastPluginStates: unknown[] = [];
    let lastResult = new Set<string>();

    return (state: GlobalState) => {
        const channels = getAllChannels(state);
        const registrations = getChannelKindRegistrations(state);
        const pluginStates = registrations.map((registration) => (state as unknown as Record<string, unknown>)[`plugins-${registration.pluginId}`]);

        if (
            channels === lastChannels &&
            registrations === lastRegistrations &&
            pluginStates.length === lastPluginStates.length &&
            pluginStates.every((pluginState, i) => pluginState === lastPluginStates[i])
        ) {
            return lastResult;
        }

        const result = new Set<string>();
        if (registrations.some((registration) => registration.kind === 'board')) {
            for (const channel of Object.values(channels)) {
                if (isBoardChannel(state, channel, registrations)) {
                    result.add(channel.id);
                }
            }
        }

        lastChannels = channels;
        lastRegistrations = registrations;
        lastPluginStates = pluginStates;
        lastResult = result;
        return result;
    };
})();

/**
 * The section of the product rail the channel sidebar is showing, or null when the rail doesn't
 * split the sidebar: it's off, or no plugin registers boards, so there's nothing to split.
 */
export function getProductRailSection(state: GlobalState): ProductRailSection | null {
    if (!isProductRailEnabled(state) || !hasBoardChannelKind(state)) {
        return null;
    }
    return state.views.productRail.section;
}

export type ProductRailFilter = Exclude<ProductRailSection, 'home'> | null;

/** Which kind of channel the sidebar is narrowed to: Home, like no split at all, shows both. */
export function getProductRailFilter(state: GlobalState): ProductRailFilter {
    const section = getProductRailSection(state);
    return section === 'home' ? null : section;
}

/** Whether the user has hidden the team sidebar, so the product rail shows a team menu in its place. */
export function isTeamSidebarHidden(state: GlobalState): boolean {
    return isProductRailEnabled(state) && getBool(state, Preferences.CATEGORY_SIDEBAR_SETTINGS, Preferences.HIDE_TEAM_SIDEBAR, false);
}

export function getProductRailLastPath(state: GlobalState, tab: ProductRailTab, teamId: string): string | undefined {
    return state.views.productRail.lastPathByTeam[tab]?.[teamId];
}

export function getProductRailLastPaths(state: GlobalState): Record<string, Record<string, string>> {
    return state.views.productRail.lastPathByTeam;
}

export function areProductRailLastPathsLoaded(state: GlobalState): boolean {
    return state.views.productRail.lastPathsLoaded;
}

/** Keeps the ids belonging in `section`: boards in Boards, everything else in Channels. */
export function filterChannelIdsForSection(channelIds: string[], section: ProductRailFilter, boardChannelIds: Set<string>): string[] {
    if (!section) {
        return channelIds;
    }
    const wantBoards = section === 'boards';
    const filtered = channelIds.filter((id) => boardChannelIds.has(id) === wantBoards);
    return filtered.length === channelIds.length ? channelIds : filtered;
}

export type SectionUnreads = {
    mentions: number;
    hasUrgent: boolean;
    unread: boolean;
};

/** Unread state for the channels and the boards of the current team, for the rail's badges. */
export const getProductRailSectionUnreads: (state: GlobalState) => Record<ProductRailSection, SectionUnreads> = createSelector(
    'getProductRailSectionUnreads',
    getCurrentTeamId,
    getAllChannels,
    getMyChannelMemberships,
    (state: GlobalState) => state.entities.channels.messageCounts,
    isCollapsedThreadsEnabled,
    getBoardChannelIds,
    (currentTeamId, channels, memberships, messageCounts, crtEnabled, boardChannelIds) => {
        const result: Record<ProductRailSection, SectionUnreads> = {
            home: {mentions: 0, hasUrgent: false, unread: false},
            channels: {mentions: 0, hasUrgent: false, unread: false},
            boards: {mentions: 0, hasUrgent: false, unread: false},
        };

        for (const channel of Object.values(channels)) {
            if (channel.team_id !== currentTeamId || channel.delete_at > 0) {
                continue;
            }

            const unreads = calculateUnreadCount(messageCounts[channel.id], memberships[channel.id], crtEnabled);
            const sectionUnreads = result[boardChannelIds.has(channel.id) ? 'boards' : 'channels'];
            sectionUnreads.mentions += unreads.mentions;
            sectionUnreads.hasUrgent = sectionUnreads.hasUrgent || unreads.hasUrgent;
            sectionUnreads.unread = sectionUnreads.unread || unreads.showUnread;
        }

        // Home holds both.
        result.home = {
            mentions: result.channels.mentions + result.boards.mentions,
            hasUrgent: result.channels.hasUrgent || result.boards.hasUrgent,
            unread: result.channels.unread || result.boards.unread,
        };

        return result;
    },
);

/** The first board, by name, in the current team that the user is a member of, to open from the rail. */
export const getFirstBoardInCurrentTeam: (state: GlobalState) => Channel | undefined = createSelector(
    'getFirstBoardInCurrentTeam',
    getCurrentTeamId,
    getAllChannels,
    getMyChannelMemberships,
    getBoardChannelIds,
    (currentTeamId, channels, memberships, boardChannelIds) => {
        return [...boardChannelIds].
            map((id) => channels[id]).
            filter((channel) => channel && channel.team_id === currentTeamId && channel.delete_at === 0 && memberships[channel.id]).
            sort((a, b) => a.display_name.localeCompare(b.display_name))[0];
    },
);
