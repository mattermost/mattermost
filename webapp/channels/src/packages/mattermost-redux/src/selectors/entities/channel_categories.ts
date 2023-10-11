// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import shallowEquals from 'shallow-equals';

import type {ChannelCategory, ChannelCategoryType} from '@mattermost/types/channel_categories';
import {CategorySorting} from '@mattermost/types/channel_categories';
import type {Channel, ChannelMembership, ChannelMessageCount} from '@mattermost/types/channels';
import type {GlobalState} from '@mattermost/types/store';
import type {UserProfile} from '@mattermost/types/users';
import type {IDMappedObjects, RelationOneToOne} from '@mattermost/types/utilities';

import {General, Preferences} from 'mattermost-redux/constants';
import {CategoryTypes} from 'mattermost-redux/constants/channel_categories';
import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getChannelMessageCounts, getCurrentChannelId, getMyChannelMemberships, makeGetChannelsForIds} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUserLocale} from 'mattermost-redux/selectors/entities/i18n';
import {getMyPreferences, getTeammateNameDisplaySetting, getVisibleDmGmLimit, isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {
    calculateUnreadCount,
    getUserIdFromChannelName,
    isChannelMuted,
} from 'mattermost-redux/utils/channel_utils';
import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

export function getAllCategoriesByIds(state: GlobalState) {
    return state.entities.channelCategories.byId;
}

export function getCategory(state: GlobalState, categoryId: string) {
    return getAllCategoriesByIds(state)[categoryId];
}

// getCategoryInTeamByType returns the first category found of the given type on the given team. This is intended for use
// with only non-custom types of categories.
export function getCategoryInTeamByType(state: GlobalState, teamId: string, categoryType: ChannelCategoryType) {
    return getCategoryWhere(
        state,
        (category) => category.type === categoryType && category.team_id === teamId,
    );
}

// getCategoryInTeamWithChannel returns the category on a given team containing the given channel ID.
export function getCategoryInTeamWithChannel(state: GlobalState, teamId: string, channelId: string) {
    return getCategoryWhere(
        state,
        (category) => category.team_id === teamId && category.channel_ids.includes(channelId),
    );
}

// getCategoryWhere returns the first category meeting the given condition. This should not be used with a condition
// that matches multiple categories.
export function getCategoryWhere(state: GlobalState, condition: (category: ChannelCategory) => boolean) {
    const categoriesByIds = getAllCategoriesByIds(state);

    return Object.values(categoriesByIds).find(condition);
}

export function getCategoryIdsForTeam(state: GlobalState, teamId: string): string[] {
    return state.entities.channelCategories.orderByTeam[teamId];
}

export function makeGetCategoriesForTeam(): (state: GlobalState, teamId: string) => ChannelCategory[] {
    return createSelector(
        'makeGetCategoriesForTeam',
        getCategoryIdsForTeam,
        (state: GlobalState) => state.entities.channelCategories.byId,
        (categoryIds, categoriesById) => {
            if (!categoryIds) {
                return [];
            }

            return categoryIds.map((id) => categoriesById[id]);
        },
    );
}

// makeFilterArchivedChannels returns a selector that filters a given list of channels based on whether or not the channel
// is archived or is currently being viewed. The selector returns the original array if no channels are filtered out.
export function makeFilterArchivedChannels(): (state: GlobalState, channels: Channel[]) => Channel[] {
    return createSelector(
        'makeFilterArchivedChannels',
        (state: GlobalState, channels: Channel[]) => channels,
        getCurrentChannelId,
        (channels: Channel[], currentChannelId: string) => {
            const filtered = channels.filter((channel) => channel && (channel.id === currentChannelId || channel.delete_at === 0));

            return filtered.length === channels.length ? channels : filtered;
        },
    );
}

export function makeFilterAutoclosedDMs(): (state: GlobalState, channels: Channel[], categoryType: string) => Channel[] {
    return createSelector(
        'makeFilterAutoclosedDMs',
        (state: GlobalState, channels: Channel[]) => channels,
        (state: GlobalState, channels: Channel[], categoryType: string) => categoryType,
        getCurrentChannelId,
        (state: GlobalState) => state.entities.users.profiles,
        getCurrentUserId,
        getMyChannelMemberships,
        getChannelMessageCounts,
        getVisibleDmGmLimit,
        getMyPreferences,
        isCollapsedThreadsEnabled,
        (channels, categoryType, currentChannelId, profiles, currentUserId, myMembers, messageCounts, limitPref, myPreferences, collapsedThreads) => {
            if (categoryType !== CategoryTypes.DIRECT_MESSAGES) {
                // Only autoclose DMs that haven't been assigned to a category
                return channels;
            }

            const getTimestampFromPrefs = (category: string, name: string) => {
                const pref = myPreferences[getPreferenceKey(category, name)];
                return parseInt(pref ? pref.value! : '0', 10);
            };
            const getLastViewedAt = (channel: Channel) => {
                // The server only ever sets the last_viewed_at to the time of the last post in channel, so we may need
                // to use the preferences added for the previous version of autoclosing DMs.
                return Math.max(
                    myMembers[channel.id]?.last_viewed_at,
                    getTimestampFromPrefs(Preferences.CATEGORY_CHANNEL_APPROXIMATE_VIEW_TIME, channel.id),
                    getTimestampFromPrefs(Preferences.CATEGORY_CHANNEL_OPEN_TIME, channel.id),
                );
            };

            let unreadCount = 0;
            let visibleChannels = channels.filter((channel) => {
                if (isUnreadChannel(channel.id, messageCounts, myMembers, collapsedThreads)) {
                    unreadCount++;

                    // Unread DMs/GMs are always visible
                    return true;
                }

                if (channel.id === currentChannelId) {
                    return true;
                }

                // DMs with deactivated users will be visible if you're currently viewing them and they were opened
                // since the user was deactivated
                if (channel.type === General.DM_CHANNEL) {
                    const teammateId = getUserIdFromChannelName(currentUserId, channel.name);
                    const teammate = profiles[teammateId];

                    const lastViewedAt = getLastViewedAt(channel);

                    if (!teammate || teammate.delete_at > lastViewedAt) {
                        return false;
                    }
                }

                return true;
            });

            visibleChannels.sort((channelA, channelB) => {
                // Should always prioritise the current channel
                if (channelA.id === currentChannelId) {
                    return -1;
                } else if (channelB.id === currentChannelId) {
                    return 1;
                }

                // Second priority is for unread channels
                if (isUnreadChannel(channelA.id, messageCounts, myMembers, collapsedThreads) && !isUnreadChannel(channelB.id, messageCounts, myMembers, collapsedThreads)) {
                    return -1;
                } else if (!isUnreadChannel(channelA.id, messageCounts, myMembers, collapsedThreads) && isUnreadChannel(channelB.id, messageCounts, myMembers, collapsedThreads)) {
                    return 1;
                }

                // Third priority is last_viewed_at
                const channelAlastViewed = getLastViewedAt(channelA) || 0;
                const channelBlastViewed = getLastViewedAt(channelB) || 0;

                if (channelAlastViewed > channelBlastViewed) {
                    return -1;
                } else if (channelBlastViewed > channelAlastViewed) {
                    return 1;
                }

                return 0;
            });

            // The limit of DMs user specifies to be rendered in the sidebar
            const remaining = Math.max(limitPref, unreadCount);
            visibleChannels = visibleChannels.slice(0, remaining);

            const visibleChannelsSet = new Set(visibleChannels);
            const filteredChannels = channels.filter((channel) => visibleChannelsSet.has(channel));

            return filteredChannels.length === channels.length ? channels : filteredChannels;
        },
    );
}

export function makeFilterManuallyClosedDMs(): (state: GlobalState, channels: Channel[]) => Channel[] {
    return createSelector(
        'makeFilterManuallyClosedDMs',
        (state: GlobalState, channels: Channel[]) => channels,
        getMyPreferences,
        getCurrentChannelId,
        getCurrentUserId,
        getMyChannelMemberships,
        getChannelMessageCounts,
        isCollapsedThreadsEnabled,
        (channels, myPreferences, currentChannelId, currentUserId, myMembers, messageCounts, collapsedThreads) => {
            const filtered = channels.filter((channel) => {
                let preference;

                if (channel.type !== General.DM_CHANNEL && channel.type !== General.GM_CHANNEL) {
                    return true;
                }

                if (isUnreadChannel(channel.id, messageCounts, myMembers, collapsedThreads)) {
                    // Unread DMs/GMs are always visible
                    return true;
                }

                if (currentChannelId === channel.id) {
                    // The current channel is always visible
                    return true;
                }

                if (channel.type === General.DM_CHANNEL) {
                    const teammateId = getUserIdFromChannelName(currentUserId, channel.name);

                    preference = myPreferences[getPreferenceKey(Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, teammateId)];
                } else {
                    preference = myPreferences[getPreferenceKey(Preferences.CATEGORY_GROUP_CHANNEL_SHOW, channel.id)];
                }

                return preference && preference.value !== 'false';
            });

            // Only return a new array if anything was removed
            return filtered.length === channels.length ? channels : filtered;
        },
    );
}

export function makeCompareChannels(getDisplayName: (channel: Channel) => string, locale: string, myMembers: RelationOneToOne<Channel, ChannelMembership>) {
    return (a: Channel, b: Channel) => {
        // Sort muted channels last
        const aMuted = isChannelMuted(myMembers[a.id]);
        const bMuted = isChannelMuted(myMembers[b.id]);

        if (aMuted && !bMuted) {
            return 1;
        } else if (!aMuted && bMuted) {
            return -1;
        }

        // And then sort alphabetically
        return getDisplayName(a).localeCompare(getDisplayName(b), locale, {numeric: true});
    };
}

export function makeSortChannelsByName(): (state: GlobalState, channels: Channel[]) => Channel[] {
    return createSelector(
        'makeSortChannelsByName',
        (state: GlobalState, channels: Channel[]) => channels,
        (state: GlobalState) => getCurrentUserLocale(state),
        getMyChannelMemberships,
        (channels: Channel[], locale: string, myMembers: RelationOneToOne<Channel, ChannelMembership>) => {
            const getDisplayName = (channel: Channel) => channel.display_name;

            return [...channels].sort(makeCompareChannels(getDisplayName, locale, myMembers));
        },
    );
}

export function makeSortChannelsByNameWithDMs(): (state: GlobalState, channels: Channel[]) => Channel[] {
    return createSelector(
        'makeSortChannelsByNameWithDMs',
        (state: GlobalState, channels: Channel[]) => channels,
        getCurrentUserId,
        (state: GlobalState) => state.entities.users.profiles,
        getTeammateNameDisplaySetting,
        (state: GlobalState) => getCurrentUserLocale(state),
        getMyChannelMemberships,
        (channels: Channel[], currentUserId: string, profiles: IDMappedObjects<UserProfile>, teammateNameDisplay: string, locale: string, myMembers: RelationOneToOne<Channel, ChannelMembership>) => {
            const cachedNames: RelationOneToOne<Channel, string> = {};

            const getDisplayName = (channel: Channel): string => {
                if (cachedNames[channel.id]) {
                    return cachedNames[channel.id];
                }

                let displayName;

                // TODO it might be easier to do this by using channel members to find the users
                if (channel.type === General.DM_CHANNEL) {
                    const teammateId = getUserIdFromChannelName(currentUserId, channel.name);
                    const teammate = profiles[teammateId];

                    displayName = displayUsername(teammate, teammateNameDisplay, false);
                } else if (channel.type === General.GM_CHANNEL) {
                    const usernames = channel.display_name.split(', ');

                    const userDisplayNames = [];
                    for (const username of usernames) {
                        const user = Object.values(profiles).find((profile) => profile.username === username);

                        if (!user) {
                            continue;
                        }

                        if (user.id === currentUserId) {
                            continue;
                        }

                        userDisplayNames.push(displayUsername(user, teammateNameDisplay, false));
                    }

                    displayName = userDisplayNames.sort((a, b) => a.localeCompare(b, locale, {numeric: true})).join(', ');
                } else {
                    displayName = channel.display_name;
                }

                cachedNames[channel.id] = displayName;

                return displayName;
            };

            return [...channels].sort(makeCompareChannels(getDisplayName, locale, myMembers));
        },
    );
}

export function makeSortChannelsByRecency(): (state: GlobalState, channels: Channel[]) => Channel[] {
    return createSelector(
        'makeSortChannelsByRecency',
        (_state: GlobalState, channels: Channel[]) => channels,
        isCollapsedThreadsEnabled,
        (channels, crtEnabled) => {
            return [...channels].sort((a, b) => {
                const aLastPostAt = Math.max(crtEnabled ? (a.last_root_post_at || a.last_post_at) : a.last_post_at, a.create_at);
                const bLastPostAt = Math.max(crtEnabled ? (b.last_root_post_at || b.last_post_at) : b.last_post_at, b.create_at);
                return bLastPostAt - aLastPostAt;
            });
        },
    );
}

export function makeSortChannels() {
    const sortChannelsByName = makeSortChannelsByName();
    const sortChannelsByNameWithDMs = makeSortChannelsByNameWithDMs();
    const sortChannelsByRecency = makeSortChannelsByRecency();

    return (state: GlobalState, originalChannels: Channel[], category: ChannelCategory) => {
        let channels = originalChannels;

        // While this function isn't memoized, sortChannelsByX should be since they know what parts of state
        // will affect sort order.

        if (category.sorting === CategorySorting.Recency) {
            channels = sortChannelsByRecency(state, channels);
        } else if (category.sorting === CategorySorting.Alphabetical || category.sorting === CategorySorting.Default) {
            if (channels.some((channel) => channel.type === General.DM_CHANNEL || channel.type === General.GM_CHANNEL)) {
                channels = sortChannelsByNameWithDMs(state, channels);
            } else {
                channels = sortChannelsByName(state, channels);
            }
        }

        return channels;
    };
}

export function makeGetChannelIdsForCategory() {
    const getChannels = makeGetChannelsForIds();
    const filterAndSortChannelsForCategory = makeFilterAndSortChannelsForCategory();

    let lastChannelIds: string[] = [];

    return (state: GlobalState, category: ChannelCategory) => {
        const channels = getChannels(state, category.channel_ids);

        const filteredChannelIds = filterAndSortChannelsForCategory(state, channels, category).map((channel) => channel.id);

        if (shallowEquals(filteredChannelIds, lastChannelIds)) {
            return lastChannelIds;
        }

        lastChannelIds = filteredChannelIds;
        return lastChannelIds;
    };
}

// Returns a selector that takes an array of channels and the category they belong to and returns the array sorted and
// with inactive DMs/GMs and archived channels filtered out.
export function makeFilterAndSortChannelsForCategory() {
    const filterArchivedChannels = makeFilterArchivedChannels();
    const filterAutoclosedDMs = makeFilterAutoclosedDMs();

    const filterManuallyClosedDMs = makeFilterManuallyClosedDMs();

    const sortChannels = makeSortChannels();

    return (state: GlobalState, originalChannels: Channel[], category: ChannelCategory) => {
        let channels = originalChannels;

        channels = filterArchivedChannels(state, channels);
        channels = filterManuallyClosedDMs(state, channels);

        channels = filterAutoclosedDMs(state, channels, category.type);

        channels = sortChannels(state, channels, category);

        return channels;
    };
}

export function makeGetChannelsByCategory() {
    const getCategoriesForTeam = makeGetCategoriesForTeam();

    // Memoize by category. As long as the categories don't change, we can keep using the same selectors for each category.
    let getChannels: RelationOneToOne<ChannelCategory, ReturnType<typeof makeGetChannelsForIds>>;
    let filterAndSortChannels: RelationOneToOne<ChannelCategory, ReturnType<typeof makeFilterAndSortChannelsForCategory>>;

    let lastCategoryIds: ReturnType<typeof getCategoryIdsForTeam> = [];
    let lastChannelsByCategory: RelationOneToOne<ChannelCategory, Channel[]> = {};

    return (state: GlobalState, teamId: string) => {
        const categoryIds = getCategoryIdsForTeam(state, teamId);

        // Create an instance of filterAndSortChannels for each category. As long as we don't add or remove new categories,
        // we can reuse these selectors to memoize the results of each category. This will also create new selectors when
        // categories are reordered, but that should be rare enough that it won't meaningfully affect performance.
        if (categoryIds !== lastCategoryIds) {
            lastCategoryIds = categoryIds;
            lastChannelsByCategory = {};

            getChannels = {};
            filterAndSortChannels = {};

            if (categoryIds) {
                for (const categoryId of categoryIds) {
                    getChannels[categoryId] = makeGetChannelsForIds();
                    filterAndSortChannels[categoryId] = makeFilterAndSortChannelsForCategory();
                }
            }
        }

        const categories = getCategoriesForTeam(state, teamId);

        const channelsByCategory: RelationOneToOne<ChannelCategory, Channel[]> = {};

        for (const category of categories) {
            const channels = getChannels[category.id](state, category.channel_ids);
            channelsByCategory[category.id] = filterAndSortChannels[category.id](state, channels, category);
        }

        // Do a shallow equality check of channelsByCategory to avoid returning a new object containing the same data
        if (shallowEquals(channelsByCategory, lastChannelsByCategory)) {
            return lastChannelsByCategory;
        }

        lastChannelsByCategory = channelsByCategory;
        return channelsByCategory;
    };
}

function isUnreadChannel(
    channelId: string,
    messageCounts: RelationOneToOne<Channel, ChannelMessageCount>,
    members: RelationOneToOne<Channel, ChannelMembership>,
    crtEnabled: boolean,
): boolean {
    const unreadCount = calculateUnreadCount(messageCounts[channelId], members[channelId], crtEnabled);
    return unreadCount.showUnread;
}
