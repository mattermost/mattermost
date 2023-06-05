// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {connect} from 'react-redux';
import classNames from 'classnames';

import {Channel, ChannelMembership, ChannelType} from '@mattermost/types/channels';
import {PreferenceType} from '@mattermost/types/preferences';
import {Team} from '@mattermost/types/teams';
import {UserProfile} from '@mattermost/types/users';
import {RelationOneToOne} from '@mattermost/types/utilities';

import GuestTag from 'components/widgets/tag/guest_tag';
import BotTag from 'components/widgets/tag/bot_tag';

import {UserTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import {
    getDirectAndGroupChannels,
    getGroupChannels,
    getMyChannelMemberships,
    getChannelByName,
    getCurrentChannel,
    getDirectTeammate,
    getChannelsInAllTeams,
    getSortedAllTeamsUnreadChannels,
    getAllTeamsUnreadChannelIds,
} from 'mattermost-redux/selectors/entities/channels';

import {getMyPreferences, isGroupChannelManuallyVisible, isCollapsedThreadsEnabled, insightsAreEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {
    getCurrentTeamId,
    getMyTeams,
    getTeam,
} from 'mattermost-redux/selectors/entities/teams';
import {
    getCurrentUserId,
    getUserIdsInChannels,
    getUser,
    makeSearchProfilesMatchingWithTerm,
    getStatusForUserId,
} from 'mattermost-redux/selectors/entities/users';
import {fetchAllMyTeamsChannelsAndChannelMembersREST, searchAllChannels} from 'mattermost-redux/actions/channels';
import {getThreadCountsInCurrentTeam} from 'mattermost-redux/selectors/entities/threads';
import {logError} from 'mattermost-redux/actions/errors';
import {ActionResult} from 'mattermost-redux/types/actions';
import {sortChannelsByTypeAndDisplayName, isChannelMuted} from 'mattermost-redux/utils/channel_utils';
import SharedChannelIndicator from 'components/shared_channel_indicator';
import CustomStatusEmoji from 'components/custom_status/custom_status_emoji';
import ProfilePicture from 'components/profile_picture';
import {getPostDraft} from 'selectors/rhs';
import store from 'stores/redux_store.jsx';
import {Constants, StoragePrefixes} from 'utils/constants';
import * as Utils from 'utils/utils';
import {isGuest} from 'mattermost-redux/utils/user_utils';
import {Preferences} from 'mattermost-redux/constants';
import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';

import Provider, {ResultsCallback} from './provider';
import {SuggestionContainer, SuggestionProps} from './suggestion';
import {GlobalState} from 'types/store';

const getState = store.getState;
const searchProfilesMatchingWithTerm = makeSearchProfilesMatchingWithTerm();

const ThreadsChannel: FakeChannel = {
    id: 'threads',
    name: 'threads',
    display_name: 'Threads',
    type: Constants.THREADS,
    delete_at: 0,
};

const InsightsChannel: FakeChannel = {
    id: 'insights',
    name: 'activity-and-insights',
    display_name: 'Insights',
    type: Constants.INSIGHTS,
    delete_at: 0,
};

type FakeChannel = Pick<Channel, 'id' | 'name' | 'display_name' | 'delete_at'> & {
    type: string;
}

type FakeDirectChannel = FakeChannel & {
    userId: string;
}

type ChannelItem = Channel | FakeChannel | FakeDirectChannel;

function isRealChannel(item?: ChannelItem): item is Channel {
    return Boolean(item) && !isFakeChannel(item) && !isFakeDirectChannel(item);
}

function isFakeChannel(item?: ChannelItem): item is FakeChannel {
    return Boolean(item) && !('create_at' in item!);
}

function isFakeDirectChannel(item?: ChannelItem): item is FakeDirectChannel {
    return Boolean(item && 'userId' in item);
}

interface WrappedChannel {
    channel: ChannelItem;
    name: string;
    deactivated: boolean;
    last_viewed_at?: number;
    type?: string;
    unread?: boolean;
    unread_mentions?: number;
}

type Props = SuggestionProps<WrappedChannel> & {
    channelMember: ChannelMembership;
    collapsedThreads: boolean;
    dmChannelTeammate?: UserProfile;
    hasDraft: boolean;
    isPartOfOnlyOneTeam: boolean;
    status?: string;
    team?: Team;
}

const SwitchChannelSuggestion = React.forwardRef<HTMLDivElement, Props>((props, ref) => {
    const {item, status, collapsedThreads, team, isPartOfOnlyOneTeam} = props;
    const channel = item.channel;
    const channelIsArchived = channel.delete_at && channel.delete_at !== 0;

    const member = props.channelMember;
    const teammate = props.dmChannelTeammate;
    let badge = null;

    if ((member && member.notify_props) || item.unread_mentions) {
        let unreadMentions;
        if (item.unread_mentions) {
            unreadMentions = item.unread_mentions;
        } else {
            unreadMentions = collapsedThreads ? member.mention_count_root : member.mention_count;
        }
        if (unreadMentions > 0 && !channelIsArchived) {
            badge = (
                <div className={classNames('suggestion-list_unread-mentions', (isPartOfOnlyOneTeam ? 'position-end' : ''))}>
                    <span className='badge'>
                        {unreadMentions}
                    </span>
                </div>
            );
        }
    }

    let name = channel.display_name;
    let description = '~' + channel.name;
    let icon;
    if (channelIsArchived) {
        icon = (
            <span className='suggestion-list__icon suggestion-list__icon--large'>
                <i className='icon icon-archive-outline'/>
            </span>
        );
    } else if (props.hasDraft) {
        icon = (
            <span className='suggestion-list__icon suggestion-list__icon--large'>
                <i className='icon icon-pencil-outline'/>
            </span>
        );
    } else if (channel.type === Constants.OPEN_CHANNEL) {
        icon = (
            <span className='suggestion-list__icon suggestion-list__icon--large'>
                <i className='icon icon-globe'/>
            </span>
        );
    } else if (channel.type === Constants.PRIVATE_CHANNEL) {
        icon = (
            <span className='suggestion-list__icon suggestion-list__icon--large'>
                <i className='icon icon-lock-outline'/>
            </span>
        );
    } else if (channel.type === Constants.THREADS) {
        icon = (
            <span className='suggestion-list__icon suggestion-list__icon--large'>
                <i className='icon icon-message-text-outline'/>
            </span>
        );
    } else if (channel.type === Constants.INSIGHTS) {
        icon = (
            <span className='suggestion-list__icon suggestion-list__icon--large'>
                <i className='icon icon-chart-line'/>
            </span>
        );
    } else if (channel.type === Constants.GM_CHANNEL) {
        icon = (
            <span className='suggestion-list__icon suggestion-list__icon--large'>
                <div className='status status--group'>{'G'}</div>
            </span>
        );
    } else if (teammate) {
        icon = (
            <ProfilePicture
                src={Utils.imageURLForUser(teammate.id, teammate.last_picture_update)}
                status={teammate.is_bot ? undefined : status}
                size='sm'
            />
        );
    }

    let tag = null;
    let customStatus = null;
    if (channel.type === Constants.DM_CHANNEL && teammate) {
        if (teammate && teammate.is_bot) {
            tag = <BotTag/>;
        } else if (isGuest(teammate ? teammate.roles : '')) {
            tag = <GuestTag/>;
        }

        customStatus = (
            <CustomStatusEmoji
                showTooltip={true}
                userID={teammate.id}
                emojiStyle={{
                    marginBottom: 2,
                }}
            />
        );

        let deactivated = '';
        if (teammate.delete_at) {
            deactivated = (' - ' + Utils.localizeMessage('channel_switch_modal.deactivated', 'Deactivated'));
        }

        if (channel.display_name && !(teammate && teammate.is_bot)) {
            description = '@' + teammate.username + deactivated;
        } else {
            name = teammate.username;
            const currentUserId = getCurrentUserId(getState());
            if (teammate.id === currentUserId) {
                name += (' ' + Utils.localizeMessage('suggestion.user.isCurrent', '(you)'));
            }
            description = deactivated;
        }
    } else if (channel.type === Constants.GM_CHANNEL) {
        // remove the slug from the option
        name = channel.display_name;
        description = '';
    }

    let sharedIcon = null;
    if (isRealChannel(channel) && channel.shared) {
        sharedIcon = (
            <SharedChannelIndicator
                className='shared-channel-icon'
                channelType={channel.type as ChannelType}
            />
        );
    }

    let teamName = null;
    if (isRealChannel(channel) && channel.team_id && team) {
        teamName = (<span className='ml-2 suggestion-list__team-name'>{team.display_name}</span>);
    }
    const showSlug = (isPartOfOnlyOneTeam || channel.type === Constants.DM_CHANNEL) && channel.type !== Constants.THREADS;

    return (
        <SuggestionContainer
            ref={ref}
            id={`switchChannel_${channel.name}`}
            data-testid={channel.name}
            role='listitem'
            {...props}
        >
            {icon}
            <div className='suggestion-list__ellipsis suggestion-list__flex'>
                <span className='suggestion-list__main'>
                    <span className={classNames({'suggestion-list__unread': item.unread && !channelIsArchived})}>{name}</span>
                    {showSlug && description && <span className='ml-2 suggestion-list__desc'>{description}</span>}
                </span>
                {customStatus}
                {sharedIcon}
                {tag}
                {badge}
                {!isPartOfOnlyOneTeam && teamName}
            </div>
        </SuggestionContainer>
    );
});
SwitchChannelSuggestion.displayName = 'SwitchChannelSuggestion';

type OwnProps = SuggestionProps<WrappedChannel>;

function mapStateToPropsForSwitchChannelSuggestion(state: GlobalState, ownProps: OwnProps) {
    const channel = ownProps.item && ownProps.item.channel;
    const channelId = channel ? channel.id : '';
    const draft = channelId ? getPostDraft(state, StoragePrefixes.DRAFT, channelId) : false;

    let dmChannelTeammate;
    if (isRealChannel(channel) && channel.type === Constants.DM_CHANNEL) {
        dmChannelTeammate = getDirectTeammate(state, channel.id);
    } else if (isFakeDirectChannel(channel)) {
        dmChannelTeammate = getUser(state, channel.userId);
    }

    let status;
    if (dmChannelTeammate) {
        status = getStatusForUserId(state, dmChannelTeammate.id);
    }

    const collapsedThreads = isCollapsedThreadsEnabled(state);

    let team;
    if (isRealChannel(channel)) {
        team = getTeam(state, channel.team_id);
    }

    const isPartOfOnlyOneTeam = getMyTeams(state).length === 1;

    return {
        channelMember: getMyChannelMemberships(state)[channelId],
        hasDraft: draft && Boolean(draft.message.trim() || draft.fileInfos.length || draft.uploadsInProgress.length),
        dmChannelTeammate,
        status,
        collapsedThreads,
        team,
        isPartOfOnlyOneTeam,
    };
}

const ConnectedSwitchChannelSuggestion = connect(mapStateToPropsForSwitchChannelSuggestion, null, null, {forwardRef: true})(SwitchChannelSuggestion);

let prefix = '';

function sortChannelsByRecencyAndTypeAndDisplayName(wrappedA: WrappedChannel, wrappedB: WrappedChannel) {
    if (wrappedA.last_viewed_at && wrappedB.last_viewed_at) {
        return wrappedB.last_viewed_at - wrappedA.last_viewed_at;
    } else if (wrappedA.last_viewed_at) {
        return -1;
    } else if (wrappedB.last_viewed_at) {
        return 1;
    }

    // MM-12677 When this is migrated this needs to be fixed to pull the user's locale
    return sortChannelsByTypeAndDisplayName('en', wrappedA.channel as Channel, wrappedB.channel as Channel);
}

export function quickSwitchSorter(wrappedA: WrappedChannel, wrappedB: WrappedChannel) {
    const aIsArchived = wrappedA.channel.delete_at ? wrappedA.channel.delete_at !== 0 : false;
    const bIsArchived = wrappedB.channel.delete_at ? wrappedB.channel.delete_at !== 0 : false;

    if (aIsArchived && !bIsArchived) {
        return 1;
    } else if (!aIsArchived && bIsArchived) {
        return -1;
    }

    if (wrappedA.deactivated && !wrappedB.deactivated) {
        return 1;
    } else if (wrappedB.deactivated && !wrappedA.deactivated) {
        return -1;
    }

    const a = wrappedA.channel;
    const b = wrappedB.channel;

    let aDisplayName = a.display_name.toLowerCase();
    let bDisplayName = b.display_name.toLowerCase();

    if (a.type === Constants.DM_CHANNEL && aDisplayName.startsWith('@')) {
        aDisplayName = aDisplayName.substring(1);
    }

    if (b.type === Constants.DM_CHANNEL && bDisplayName.startsWith('@')) {
        bDisplayName = bDisplayName.substring(1);
    }

    const aStartsWith = aDisplayName.startsWith(prefix) || wrappedA.name.toLowerCase().startsWith(prefix);
    const bStartsWith = bDisplayName.startsWith(prefix) || wrappedB.name.toLowerCase().startsWith(prefix);

    // Open channels user haven't interacted should be at the  bottom of the list
    if (a.type === Constants.OPEN_CHANNEL && !wrappedA.last_viewed_at && (b.type !== Constants.OPEN_CHANNEL || wrappedB.last_viewed_at)) {
        return 1;
    } else if (b.type === Constants.OPEN_CHANNEL && !wrappedB.last_viewed_at) {
        return -1;
    }

    // Sort channels starting with the search term first
    if (aStartsWith && !bStartsWith) {
        return -1;
    } else if (!aStartsWith && bStartsWith) {
        return 1;
    }
    return sortChannelsByRecencyAndTypeAndDisplayName(wrappedA, wrappedB);
}

function makeChannelSearchFilter(channelPrefix: string) {
    const channelPrefixLower = channelPrefix.toLowerCase();
    const splitPrefixBySpace = channelPrefixLower.trim().split(/[ ,]+/);
    const curState = getState();
    const usersInChannels = getUserIdsInChannels(curState);
    const userSearchStrings: RelationOneToOne<UserProfile, string> = {};

    return (channel: ChannelItem) => {
        let searchString = `${channel.display_name}${channel.name}`;
        if (channel.type === Constants.GM_CHANNEL || channel.type === Constants.DM_CHANNEL) {
            const usersInChannel = usersInChannels[channel.id] || new Set([]);

            // In case the channel is a DM and the profilesInChannel is not populated
            if (!usersInChannel.size && channel.type === Constants.DM_CHANNEL) {
                const userId = Utils.getUserIdFromChannelId(channel.name);
                const user = getUser(curState, userId);
                if (user) {
                    usersInChannel.add(userId);
                }
            }

            for (const userId of usersInChannel) {
                let userString = userSearchStrings[userId];

                if (!userString) {
                    const user = getUser(curState, userId);
                    if (!user) {
                        continue;
                    }
                    const {nickname, username} = user;
                    userString = `${nickname}${username}${Utils.getFullName(user)}`;
                    userSearchStrings[userId] = userString;
                }
                searchString += userString;
            }
        }

        if (splitPrefixBySpace.length > 1) {
            const lowerCaseSearch = searchString.toLowerCase();
            return splitPrefixBySpace.every((searchPrefix) => {
                return lowerCaseSearch.includes(searchPrefix);
            });
        }

        return searchString.toLowerCase().includes(channelPrefixLower);
    };
}

export default class SwitchChannelProvider extends Provider {
    /**
     * whenever this gets adjusted/refactored to not call the callback twice we need to adjust the behavior in
     * the ForwardPostChannelSelect component as well.
     *
     * @see {@link components/forward_post_modal/forward_post_channel_select.tsx}
     */
    handlePretextChanged(channelPrefix: string, resultsCallback: ResultsCallback<WrappedChannel>) {
        if (channelPrefix) {
            prefix = channelPrefix;
            this.startNewRequest(channelPrefix);
            if (this.shouldCancelDispatch(channelPrefix)) {
                return false;
            }

            // Dispatch suggestions for local data (filter out deleted and archived channels from local store data)
            const channels = getChannelsInAllTeams(getState()).concat(getDirectAndGroupChannels(getState())).filter((c) => c.delete_at === 0);
            const users = searchProfilesMatchingWithTerm(getState(), channelPrefix, false);
            const formattedData = this.formatList(channelPrefix, [ThreadsChannel, InsightsChannel, ...channels], users, true, true);
            if (formattedData) {
                resultsCallback(formattedData);
            }

            // Fetch data from the server and dispatch
            this.fetchUsersAndChannels(channelPrefix, resultsCallback);
        } else {
            this.fetchAndFormatRecentlyViewedChannels(resultsCallback);
        }

        return true;
    }

    async fetchUsersAndChannels(channelPrefix: string, resultsCallback: ResultsCallback<WrappedChannel>) {
        const state = getState();
        const teamId = getCurrentTeamId(state);

        if (!teamId) {
            return;
        }

        const config = getConfig(state);
        let usersAsync;
        if (config.RestrictDirectMessage === 'team') {
            usersAsync = Client4.autocompleteUsers(channelPrefix, teamId, '');
        } else {
            usersAsync = Client4.autocompleteUsers(channelPrefix, '', '');
        }

        const channelsAsync = searchAllChannels(channelPrefix, {nonAdminSearch: true})(store.dispatch, store.getState);

        let usersFromServer;
        let channelsFromServer;

        try {
            usersFromServer = await usersAsync;
            const channelsResponse = await channelsAsync;
            channelsFromServer = (channelsResponse as ActionResult).data;
        } catch (err) {
            store.dispatch(logError(err));
            return;
        }

        if (this.shouldCancelDispatch(channelPrefix)) {
            return;
        }

        const currentUserId = getCurrentUserId(state);

        // filter out deleted and archived channels from local store data
        const localChannelData = getChannelsInAllTeams(state).concat(getDirectAndGroupChannels(state)).filter((c) => c.delete_at === 0) || [];
        const localUserData = searchProfilesMatchingWithTerm(state, channelPrefix, false);
        const localFormattedData = this.formatList(channelPrefix, [ThreadsChannel, InsightsChannel, ...localChannelData], localUserData);
        const remoteChannelData = channelsFromServer.concat(getGroupChannels(state)) || [];
        const remoteUserData = usersFromServer.users || [];
        const remoteFormattedData = this.formatList(channelPrefix, remoteChannelData, remoteUserData, false);

        store.dispatch({
            type: UserTypes.RECEIVED_PROFILES_LIST,
            data: [...localUserData.filter((user) => user.id !== currentUserId), ...remoteUserData.filter((user) => user.id !== currentUserId)],
        });
        const combinedTerms = [...localFormattedData.terms, ...remoteFormattedData.terms.filter((term) => !localFormattedData.terms.includes(term))];
        const combinedItems = [...localFormattedData.items, ...remoteFormattedData.items.filter((item: any) => !localFormattedData.terms.includes((item.channel as FakeDirectChannel).userId || item.channel.id))];

        resultsCallback({
            ...localFormattedData,
            items: combinedItems,
            terms: combinedTerms,
        });
    }

    userWrappedChannel(user: UserProfile, channel?: ChannelItem): WrappedChannel {
        let displayName = '';
        const currentUserId = getCurrentUserId(getState());

        // The naming format is fullname (nickname)
        // username is shown seperately
        if ((user.first_name || user.last_name) && user.nickname) {
            displayName += Utils.getFullName(user);
            if (user.id !== currentUserId) {
                displayName += ` (${user.nickname})`;
            }
        } else if (user.nickname && !user.first_name && !user.last_name) {
            displayName += `${user.nickname}`;
        } else if (user.first_name || user.last_name) {
            displayName += `${Utils.getFullName(user)}`;
        }

        if (user.id === currentUserId && displayName) {
            displayName += (' ' + Utils.localizeMessage('suggestion.user.isCurrent', '(you)'));
        }

        return {
            channel: {
                display_name: displayName,
                name: user.username,
                id: channel ? channel.id : user.id,
                userId: user.id,
                update_at: user.update_at,
                delete_at: 0,
                type: Constants.DM_CHANNEL,
            },
            type: 'search.direct',
            name: user.username,
            deactivated: Boolean(user.delete_at),
        };
    }

    formatList(channelPrefix: string, allChannels: ChannelItem[], users: UserProfile[], skipNotMember = true, localData = false) {
        const channels = [];

        const members = getMyChannelMemberships(getState());

        const completedChannels: RelationOneToOne<Channel, boolean> = {};

        const channelFilter = makeChannelSearchFilter(channelPrefix);

        const state = getState();
        const config = getConfig(state);
        const viewArchivedChannels = config.ExperimentalViewArchivedChannels === 'true';
        const allUnreadChannelIds = getAllTeamsUnreadChannelIds(state);
        const allUnreadChannelIdsSet = new Set(allUnreadChannelIds);
        const currentUserId = getCurrentUserId(state);

        for (const channel of allChannels) {
            if (completedChannels[channel.id]) {
                continue;
            }
            if (channelFilter(channel)) {
                const newChannel = {...channel};
                const channelIsArchived = channel.delete_at !== 0;

                let wrappedChannel: WrappedChannel = {channel: newChannel, name: newChannel.name, deactivated: false};
                if (members[channel.id]) {
                    wrappedChannel.last_viewed_at = members[channel.id].last_viewed_at;
                } else if (skipNotMember && (newChannel.type !== Constants.THREADS && newChannel.type !== Constants.INSIGHTS)) {
                    continue;
                }

                if (!viewArchivedChannels && channelIsArchived) {
                    continue;
                } else if (channelIsArchived && members[channel.id]) {
                    wrappedChannel.type = Constants.ARCHIVED_CHANNEL;
                } else if (newChannel.type === Constants.OPEN_CHANNEL) {
                    wrappedChannel.type = Constants.MENTION_PUBLIC_CHANNELS;
                } else if (newChannel.type === Constants.PRIVATE_CHANNEL) {
                    wrappedChannel.type = Constants.MENTION_PRIVATE_CHANNELS;
                } else if (channelIsArchived && !members[channel.id]) {
                    continue;
                } else if (newChannel.type === Constants.THREADS) {
                    const threadItem = this.getThreadsItem('total');
                    if (threadItem) {
                        wrappedChannel = threadItem;
                    } else {
                        continue;
                    }
                } else if (newChannel.type === Constants.INSIGHTS) {
                    const insightsItem = this.getInsightsItem();
                    if (insightsItem) {
                        wrappedChannel = insightsItem;
                    } else {
                        continue;
                    }
                } else if (newChannel.type === Constants.GM_CHANNEL) {
                    newChannel.name = newChannel.display_name;
                    wrappedChannel.name = newChannel.name;
                    wrappedChannel.type = Constants.MENTION_GROUPS;
                    const isGMVisible = isGroupChannelManuallyVisible(state, channel.id);
                    if (!isGMVisible && skipNotMember) {
                        continue;
                    }
                } else if (newChannel.type === Constants.DM_CHANNEL) {
                    const userId = Utils.getUserIdFromChannelId(newChannel.name);
                    const user = users.find((u) => u.id === userId);

                    if (user) {
                        completedChannels[user.id] = true;
                        wrappedChannel = this.userWrappedChannel(
                            user,
                            newChannel,
                        );
                        if (members[channel.id]) {
                            wrappedChannel.last_viewed_at = members[channel.id].last_viewed_at;
                        }
                    } else {
                        continue;
                    }
                }

                const unread = allUnreadChannelIdsSet.has(newChannel.id) && !isChannelMuted(members[channel.id]);
                if (unread) {
                    wrappedChannel.unread = true;
                }
                completedChannels[channel.id] = true;
                channels.push(wrappedChannel);
            }
        }

        for (let i = 0; i < users.length; i++) {
            const user = users[i];

            if (completedChannels[user.id]) {
                continue;
            }

            const channelName = Utils.getDirectChannelName(currentUserId, user.id);
            const channel = getChannelByName(state, channelName);

            const wrappedChannel = this.userWrappedChannel(user, channel);

            if (channel && members[channel.id]) {
                wrappedChannel.last_viewed_at = members[channel.id].last_viewed_at;
            } else if (skipNotMember) {
                continue;
            }

            if (channel) {
                const unread = allUnreadChannelIdsSet.has(channel.id) && !isChannelMuted(members[channel.id]);
                if (unread) {
                    wrappedChannel.unread = true;
                }
            }

            completedChannels[user.id] = true;
            channels.push(wrappedChannel);
        }

        const channelNames = channels.
            sort(quickSwitchSorter).
            map((wrappedChannel) => {
                if (isFakeDirectChannel(wrappedChannel.channel) && wrappedChannel.channel.userId) {
                    return wrappedChannel.channel.userId;
                }

                return wrappedChannel.channel.id;
            });

        if (localData && !channels.length) {
            channels.push({
                type: Constants.MENTION_MORE_CHANNELS,
                loading: true,
            });
        }

        return {
            matchedPretext: channelPrefix,
            terms: channelNames,
            items: channels,
            component: ConnectedSwitchChannelSuggestion,
        };
    }

    fetchAndFormatRecentlyViewedChannels(resultsCallback: ResultsCallback<WrappedChannel>) {
        const state = getState();
        const recentChannels = getChannelsInAllTeams(state).concat(getDirectAndGroupChannels(state));
        const wrappedRecentChannels = this.wrapChannels(recentChannels, Constants.MENTION_RECENT_CHANNELS);
        const unreadChannels = getSortedAllTeamsUnreadChannels(state);
        const myMembers = getMyChannelMemberships(state);
        const unreadChannelsExclMuted = unreadChannels.filter((channel) => {
            const member = myMembers[channel.id];
            return !isChannelMuted(member);
        }).slice(0, 5);
        let sortedUnreadChannels = this.wrapChannels(unreadChannelsExclMuted, Constants.MENTION_UNREAD);
        if (wrappedRecentChannels.length === 0) {
            prefix = '';
            this.startNewRequest('');
            this.fetchChannels(resultsCallback);
        }
        const sortedUnreadChannelIDs = sortedUnreadChannels.map((wrappedChannel) => wrappedChannel.channel.id);
        const sortedRecentChannels = wrappedRecentChannels.filter((wrappedChannel) => !sortedUnreadChannelIDs.includes(wrappedChannel.channel.id)).
            sort(sortChannelsByRecencyAndTypeAndDisplayName).slice(0, 20);
        const threadsItem = this.getThreadsItem('unread', Constants.MENTION_UNREAD);
        if (threadsItem) {
            sortedUnreadChannels = [threadsItem, ...sortedUnreadChannels].slice(0, 5);
        }
        const sortedChannels = [...sortedUnreadChannels, ...sortedRecentChannels];
        const channelNames = sortedChannels.map((wrappedChannel) => wrappedChannel.channel.id);
        resultsCallback({
            matchedPretext: '',
            terms: channelNames,
            items: sortedChannels,
            component: ConnectedSwitchChannelSuggestion,
        });
    }

    getThreadsItem(countType = 'total', itemType?: string) {
        const state = getState();
        const counts = getThreadCountsInCurrentTeam(state);
        const collapsedThreads = isCollapsedThreadsEnabled(state);

        // adding last viewed at equal to Date.now() to push it to the top of the list
        let threadsItem: WrappedChannel = {
            channel: ThreadsChannel,
            name: ThreadsChannel.name,
            unread: Boolean(counts?.total_unread_threads),
            unread_mentions: counts?.total_unread_mentions || 0,
            deactivated: false,
            last_viewed_at: Date.now(),
        };
        if (itemType) {
            threadsItem = {...threadsItem, type: itemType};
        }
        if (collapsedThreads && ((countType === 'unread' && counts?.total_unread_threads) || (countType === 'total'))) {
            return threadsItem;
        }

        return null;
    }

    getInsightsItem() {
        const state = getState();
        const insightsEnabled = insightsAreEnabled(state);

        // adding last viewed at equal to Date.now() to push it to the top of the list
        const insightsItem = {
            channel: InsightsChannel,
            name: InsightsChannel.name,
            unread: false,
            unread_mentions: 0,
            deactivated: false,
            last_viewed_at: Date.now(),
        };

        if (insightsEnabled) {
            return insightsItem;
        }

        return null;
    }

    getTimestampFromPrefs(myPreferences: Record<string, PreferenceType>, category: string, name: string) {
        const pref = myPreferences[getPreferenceKey(category, name)];
        const prefValue = pref ? pref.value : '0';
        return parseInt(prefValue ?? '', 10);
    }

    getLastViewedAt(member: ChannelMembership, myPreferences: Record<string, PreferenceType>, channel: Channel) {
        // The server only ever sets the last_viewed_at to the time of the last post in channel,
        // So thought of using preferences but it seems that also not keeping track.
        // TODO Update and remove comment once solution is finalized
        return Math.max(
            member.last_viewed_at,
            this.getTimestampFromPrefs(myPreferences, Preferences.CATEGORY_CHANNEL_APPROXIMATE_VIEW_TIME, channel.id),
            this.getTimestampFromPrefs(myPreferences, Preferences.CATEGORY_CHANNEL_OPEN_TIME, channel.id),
        );
    }

    wrapChannels(channels: Channel[], channelType: string) {
        const state = getState();
        const currentChannel = getCurrentChannel(state);
        const myMembers = getMyChannelMemberships(state);
        const myPreferences = getMyPreferences(state);
        const allUnreadChannelIds = getAllTeamsUnreadChannelIds(state);
        const allUnreadChannelIdsSet = new Set(allUnreadChannelIds);

        const channelList = [];
        for (let i = 0; i < channels.length; i++) {
            const channel = channels[i];
            if (channel.id === currentChannel?.id) {
                continue;
            }
            let wrappedChannel: WrappedChannel = {channel, name: channel.name, deactivated: false};
            const member = myMembers[channel.id];
            if (member) {
                wrappedChannel.last_viewed_at = this.getLastViewedAt(member, myPreferences, channel);
            }
            if (channel.type === Constants.GM_CHANNEL) {
                wrappedChannel.name = channel.display_name;
            } else if (channel.type === Constants.DM_CHANNEL) {
                const user = getUser(getState(), Utils.getUserIdFromChannelId(channel.name));

                if (!user) {
                    continue;
                }
                const userWrappedChannel = this.userWrappedChannel(
                    user,
                    channel,
                );
                wrappedChannel = {...wrappedChannel, ...userWrappedChannel};
            }
            const unread = allUnreadChannelIdsSet.has(channel.id) && !isChannelMuted(member);
            if (unread) {
                wrappedChannel.unread = true;
            }

            wrappedChannel.type = channelType;
            channelList.push(wrappedChannel);
        }
        return channelList;
    }

    async fetchChannels(resultsCallback: ResultsCallback<WrappedChannel>) {
        const state = getState();
        const teamId = getCurrentTeamId(state);
        if (!teamId) {
            return;
        }
        const channelsAsync = store.dispatch(fetchAllMyTeamsChannelsAndChannelMembersREST());
        let channels;

        try {
            const {data} = await channelsAsync;
            channels = data.channels as Channel[];
        } catch (err) {
            store.dispatch(logError(err));
            return;
        }

        if (this.latestPrefix !== '') {
            return;
        }
        const sortedChannels = this.wrapChannels(channels, Constants.MENTION_PUBLIC_CHANNELS).slice(0, 20);
        const channelNames = sortedChannels.map((wrappedChannel) => wrappedChannel.channel.id);

        resultsCallback({
            matchedPretext: '',
            terms: channelNames,
            items: sortedChannels,
            component: ConnectedSwitchChannelSuggestion,
        });
    }
}
