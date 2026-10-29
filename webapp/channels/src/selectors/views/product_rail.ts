// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';
import type {IDMappedObjects} from '@mattermost/types/utilities';

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getAllChannels, getMyChannelMemberships} from 'mattermost-redux/selectors/entities/channels';
import {isProductRailEnabled} from 'mattermost-redux/selectors/entities/general';
import {getBool, isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeamId, getMySortedTeamIds} from 'mattermost-redux/selectors/entities/teams';
import {calculateUnreadCount} from 'mattermost-redux/utils/channel_utils';

import {getCurrentLocale} from 'selectors/i18n';
import {getPreviousTeamId} from 'selectors/local_storage';
import {getIsMobileView} from 'selectors/views/browser';

import {Preferences} from 'utils/constants';

import type {GlobalState} from 'types/store';
import type {ProductRailSection, ProductRailTab} from 'types/store/views';

/**
 * A plugin's claim that the channels its matcher accepts are of a kind, such as 'board', as
 * plugins register with registerChannelKind. That API comes with the Boards work, so this reads
 * the registrations without depending on it: until it's in, there are none, and the rail shows no
 * Boards split. Once it is, this can use its ChannelKindRegistration and isBoardChannel.
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
    // On mobile the rail is hidden, so there'd be no way to switch sections: show everything.
    if (!isProductRailEnabled(state) || !hasBoardChannelKind(state) || getIsMobileView(state)) {
        return null;
    }
    return state.views.productRail.section;
}

export type ProductRailFilter = ProductRailSection | null;

/** Whether the user has chosen to list boards in the Channels view too. */
export function areBoardsShownInChannels(state: GlobalState): boolean {
    return getBool(state, Preferences.CATEGORY_SIDEBAR_SETTINGS, Preferences.SHOW_BOARDS_IN_CHANNELS, false);
}

/**
 * Which kind of channel the sidebar is narrowed to, or null when it shows them all: the rail
 * doesn't split it, or Channels has been set to list boards too.
 */
export function getProductRailFilter(state: GlobalState): ProductRailFilter {
    const section = getProductRailSection(state);
    if (section === 'channels' && areBoardsShownInChannels(state)) {
        return null;
    }
    return section;
}

/** Whether the rail is on screen: it needs a team, and is hidden at mobile widths. */
export function isProductRailShown(state: GlobalState): boolean {
    return isProductRailEnabled(state) && Boolean(getCurrentTeamId(state)) && !getIsMobileView(state);
}

/**
 * The team to select when none is, as after loading a global product's page (Agents, say), whose
 * URL names no team: the last one the user was in, or else their first. Empty while a team is
 * selected.
 */
export function getProductRailTeamIdToRestore(state: GlobalState): string {
    if (getCurrentTeamId(state)) {
        return '';
    }
    const myTeamIds = getMySortedTeamIds(state, getCurrentLocale(state));
    const previousTeamId = getPreviousTeamId(state);
    if (previousTeamId && myTeamIds.includes(previousTeamId)) {
        return previousTeamId;
    }
    return myTeamIds[0] ?? '';
}

/** Whether the user has hidden the team sidebar, so the product rail shows a team menu in its place. */
export function isTeamSidebarHidden(state: GlobalState): boolean {
    // On mobile the rail, and its team menu, are hidden, so the team sidebar stays to switch teams.
    return isProductRailEnabled(state) && !getIsMobileView(state) &&
        getBool(state, Preferences.CATEGORY_SIDEBAR_SETTINGS, Preferences.HIDE_TEAM_SIDEBAR, false);
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

/**
 * Translates a drop index in a list the rail has filtered (what @hello-pangea/dnd reports) into an
 * index in the full list, keeping the dropped item next to the same visible neighbours. Both
 * indices count the list without the dragged item, as dnd does for a move within one list.
 */
export function toFullListIndex(visibleIds: string[], fullIds: string[], draggedId: string, visibleIndex: number): number {
    // Dropped back where it was: keep its place, rather than moving it past hidden neighbours.
    if (visibleIds.indexOf(draggedId) === visibleIndex) {
        return fullIds.indexOf(draggedId);
    }

    const visible = visibleIds.filter((id) => id !== draggedId);
    const full = fullIds.filter((id) => id !== draggedId);

    // Dropped before a visible item: go right before it in the full list.
    if (visibleIndex < visible.length) {
        return full.indexOf(visible[visibleIndex]);
    }

    // Dropped after the last visible item: go right after it, or first if nothing is visible.
    if (visible.length === 0) {
        return 0;
    }
    return full.indexOf(visible[visible.length - 1]) + 1;
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
