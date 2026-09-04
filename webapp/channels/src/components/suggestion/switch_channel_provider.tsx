// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useLayoutEffect, useRef, useState} from 'react';
import {defineMessage, useIntl} from 'react-intl';
import {connect, useSelector} from 'react-redux';

import {Button} from '@mattermost/shared/components/button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {Channel, ChannelMembership} from '@mattermost/types/channels';
import type {PreferenceType} from '@mattermost/types/preferences';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';
import type {RelationOneToOne} from '@mattermost/types/utilities';

import {UserTypes} from 'mattermost-redux/action_types';
import {fetchAllMyTeamsChannels, searchAllChannels} from 'mattermost-redux/actions/channels';
import {logError} from 'mattermost-redux/actions/errors';
import {Client4} from 'mattermost-redux/client';
import {Preferences} from 'mattermost-redux/constants';
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
    getMyPendingJoinRequestsByChannel,
} from 'mattermost-redux/selectors/entities/channels';
import {getConfig, isDiscoverableChannelsEnabled, developerModeEnabled} from 'mattermost-redux/selectors/entities/general';
import {getMyPreferences, isGroupChannelManuallyVisible, isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {
    getActiveTeamsList,
    getCurrentTeamId,
    getMyTeams,
    getTeam,
} from 'mattermost-redux/selectors/entities/teams';
import {getThreadCountsInCurrentTeam} from 'mattermost-redux/selectors/entities/threads';
import {
    getCurrentUserId,
    getUserIdsInChannels,
    getUser,
    makeSearchProfilesMatchingWithTerm,
    getStatusForUserId,
} from 'mattermost-redux/selectors/entities/users';
import type {ActionResult} from 'mattermost-redux/types/actions';
import {sortChannelsByTypeAndDisplayName, isChannelMuted} from 'mattermost-redux/utils/channel_utils';
import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';
import {isGuest} from 'mattermost-redux/utils/user_utils';

import {getPostDraft} from 'selectors/rhs';
import globalStore from 'stores/redux_store';

import ChannelTypeIcon from 'components/channel_type_icon';
import usePrefixedIds, {joinIds} from 'components/common/hooks/usePrefixedIds';
import CustomStatusEmoji from 'components/custom_status/custom_status_emoji';
import ProfilePicture from 'components/profile_picture';
import SharedChannelIndicator from 'components/shared_channel_indicator';
import BotTag from 'components/widgets/tag/bot_tag';
import GuestTag from 'components/widgets/tag/guest_tag';

import {Constants, StoragePrefixes} from 'utils/constants';
import {getIntl} from 'utils/i18n';
import * as Utils from 'utils/utils';

import type {GlobalState} from 'types/store';

import Provider from './provider';
import type {ResultsCallback} from './provider';
import {SuggestionContainer} from './suggestion';
import type {SuggestionProps} from './suggestion';
import type {ProviderResults} from './suggestion_results';

const searchProfilesMatchingWithTerm = makeSearchProfilesMatchingWithTerm();

const ThreadsChannel: FakeChannel = {
    id: 'threads',
    name: 'threads',
    display_name: 'Threads',
    type: Constants.THREADS,
    update_at: 0,
    delete_at: 0,
};

type FakeChannel = Pick<Channel, 'id' | 'name' | 'display_name' | 'update_at' | 'delete_at'> & {
    type: string;
};

type FakeDirectChannel = FakeChannel & {
    userId: string;
};

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

export interface WrappedChannel {
    channel: ChannelItem;
    name: string;
    deactivated: boolean;
    last_viewed_at?: number;
    type?: string;
    unread?: boolean;
    unread_mentions?: number;
    discoverableNonMember?: boolean;
    hasPendingJoinRequest?: boolean;
    hiddenInSidebar?: boolean;
}

type Props = SuggestionProps<WrappedChannel> & {
    id: string;
    channelMember: ChannelMembership;
    collapsedThreads: boolean;
    dmChannelTeammate?: UserProfile;
    hasDraft: boolean;
    isPartOfOnlyOneTeam: boolean;
    status?: string;
    team?: Team;
    discoverableNonMember: boolean;
    hasPendingJoinRequest: boolean;
};

export const SwitchChannelSuggestion = React.forwardRef<HTMLLIElement, Props>(({
    id,
    item,
    channelMember: member,
    collapsedThreads,
    dmChannelTeammate: teammate,
    hasDraft,
    isPartOfOnlyOneTeam,
    status,
    team,
    discoverableNonMember,
    hasPendingJoinRequest,
    ...otherProps
}, ref) => {
    const {formatMessage} = useIntl();

    const channel = item.channel;
    const channelIsArchived = channel.delete_at && channel.delete_at !== 0;

    const currentUserId = useSelector(getCurrentUserId);

    const channelNameRef = useRef<HTMLSpanElement>(null);
    const [isChannelNameTruncated, setIsChannelNameTruncated] = useState(false);
    const teamNameRef = useRef<HTMLSpanElement>(null);
    const [isTeamNameTruncated, setIsTeamNameTruncated] = useState(false);

    const ids = usePrefixedIds(id, {
        name: null,
        channelType: null,
        description: null,
        sharedIcon: null,
        tag: null,
        teamName: null,
        unreadBadge: null,
    });

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
                <div
                    id={ids.unreadBadge}
                    className={classNames('suggestion-list_unread-mentions', (isPartOfOnlyOneTeam ? 'position-end' : ''))}
                    aria-label={formatMessage({
                        id: 'channel_switch_modal.unreadMentions',
                        defaultMessage: '{count, number} {count, plural, one {unread notification} other {unread notifications}}',
                    }, {
                        count: unreadMentions,
                    })}
                >
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
            <span
                id={ids.channelType}
                className='suggestion-list__icon suggestion-list__icon--large'
                aria-label={formatMessage({
                    id: 'suggestion.archived_channel',
                    defaultMessage: 'Archived channel',
                })}
            >
                {isRealChannel(channel) ? (
                    <ChannelTypeIcon channel={channel}/>
                ) : (
                    <i className='icon icon-archive-outline'/>
                )}
            </span>
        );
    } else if (hasDraft) {
        icon = (
            <span
                id={ids.channelType}
                className='suggestion-list__icon suggestion-list__icon--large'
                aria-label={formatMessage({
                    id: 'channel_switch_modal.has_draft',
                    defaultMessage: 'Has draft',
                })}
            >
                <i className='icon icon-pencil-outline'/>
            </span>
        );
    } else if (channel.type === Constants.OPEN_CHANNEL) {
        icon = (
            <span
                id={ids.channelType}
                className='suggestion-list__icon suggestion-list__icon--large'
                aria-label={formatMessage({
                    id: 'suggestion.public_channel',
                    defaultMessage: 'Public channel',
                })}
            >
                {isRealChannel(channel) && <ChannelTypeIcon channel={channel}/>}
            </span>
        );
    } else if (channel.type === Constants.PRIVATE_CHANNEL) {
        icon = (
            <span
                id={ids.channelType}
                className='suggestion-list__icon suggestion-list__icon--large'
                aria-label={formatMessage({
                    id: 'suggestion.private_channel',
                    defaultMessage: 'Private channel',
                })}
            >
                {isRealChannel(channel) && <ChannelTypeIcon channel={channel}/>}
            </span>
        );
    } else if (channel.type === Constants.THREADS) {
        icon = (
            <span className='suggestion-list__icon suggestion-list__icon--large'>
                <i className='icon icon-message-text-outline'/>
            </span>
        );
    } else if (channel.type === Constants.GM_CHANNEL) {
        icon = (
            <span
                id={ids.channelType}
                aria-label={formatMessage({
                    id: 'suggestion.group_channel',
                    defaultMessage: 'Group channel',
                })}
                className='suggestion-list__icon suggestion-list__icon--large'
            >
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
            deactivated = (' - ' + formatMessage({id: 'channel_switch_modal.deactivated', defaultMessage: 'Deactivated'}));
        }

        if (channel.display_name && !(teammate && teammate.is_bot)) {
            description = '@' + teammate.username + deactivated;
        } else {
            name = teammate.username;
            if (teammate.id === currentUserId) {
                name += (' ' + formatMessage({id: 'suggestion.user.isCurrent', defaultMessage: '(you)'}));
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
            <span id={ids.sharedIcon}>
                <SharedChannelIndicator
                    className='shared-channel-icon'
                />
            </span>
        );
    }

    let teamName = null;
    if (isRealChannel(channel) && channel.team_id && team) {
        teamName = (
            <WithTooltip
                title={team.display_name}
                disabled={!isTeamNameTruncated}
            >
                <span
                    id={ids.teamName}
                    ref={teamNameRef}
                    className='ml-2 suggestion-list__team-name'
                >
                    {team.display_name}
                </span>
            </WithTooltip>
        );
    }
    const showSlug = (isPartOfOnlyOneTeam || channel.type === Constants.DM_CHANNEL) && channel.type !== Constants.THREADS;

    Reflect.deleteProperty(otherProps, 'dispatch');

    let discoverableAction = null;
    if (discoverableNonMember && isRealChannel(channel) && !channelIsArchived) {
        // Visual affordance only. Selecting the row (click, or ENTER via the
        // suggestion list) bubbles to QuickSwitchModal.handleSubmit, which is
        // the single place that requests or withdraws, keeping mouse and
        // keyboard behavior consistent.
        discoverableAction = (
            <div className='suggestion-list__discoverable-action'>
                <Button
                    emphasis={hasPendingJoinRequest ? 'tertiary' : 'primary'}
                    size='sm'
                    tabIndex={-1}
                >
                    {hasPendingJoinRequest ? formatMessage({id: 'more_channels.withdrawRequest', defaultMessage: 'Withdraw request'}) : formatMessage({id: 'more_channels.requestToJoin', defaultMessage: 'Request to join'})}
                </Button>
            </div>
        );
    }

    useLayoutEffect(() => {
        const channelEl = channelNameRef.current;
        setIsChannelNameTruncated(Boolean(channelEl && channelEl.scrollWidth > channelEl.clientWidth));

        const teamEl = teamNameRef.current;
        setIsTeamNameTruncated(Boolean(teamEl && teamEl.scrollWidth > teamEl.clientWidth));
    }, [name, description, showSlug, isPartOfOnlyOneTeam, team?.display_name, item.unread, channelIsArchived]);

    return (
        <SuggestionContainer
            ref={ref}
            id={id}
            data-testid={channel.name}
            item={item}
            {...otherProps}
            aria-labelledby={ids.name}
            aria-describedby={joinIds(ids.unreadBadge, ids.description, ids.teamName, ids.channelType, ids.sharedIcon, ids.tag)}
        >
            {icon}
            <div className='suggestion-list__ellipsis suggestion-list__flex'>
                <div className='suggestion-list__switch-channel-primary'>
                    <span
                        data-testid='suggestion-list__main'
                        className='suggestion-list__main'
                    >
                        <WithTooltip
                            title={name}
                            disabled={!isChannelNameTruncated}
                        >
                            <span
                                id={ids.name}
                                ref={channelNameRef}
                                className={classNames('suggestion-list__channel-name-text', {'suggestion-list__unread': item.unread && !channelIsArchived})}
                            >
                                {name}
                            </span>
                        </WithTooltip>
                        {showSlug && description && (
                            <span
                                id={ids.description}
                                className='ml-2 suggestion-list__desc'
                            >
                                {description}
                            </span>
                        )}
                    </span>
                    {customStatus}
                    {sharedIcon}
                    {tag && <span id={ids.tag}>{tag}</span>}
                    {badge}
                </div>
                {discoverableAction}
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
    const discoverableNonMember = Boolean(ownProps.item?.discoverableNonMember);
    const hasPendingJoinRequest = Boolean(ownProps.item?.hasPendingJoinRequest);

    return {
        channelMember: getMyChannelMemberships(state)[channelId],
        hasDraft: draft && Boolean(draft.message.trim() || draft.fileInfos.length || draft.uploadsInProgress.length),
        dmChannelTeammate,
        status,
        collapsedThreads,
        team,
        isPartOfOnlyOneTeam,
        discoverableNonMember,
        hasPendingJoinRequest,
    };
}

export const ConnectedSwitchChannelSuggestion = connect(
    mapStateToPropsForSwitchChannelSuggestion,
    null,
    null,
    {forwardRef: true},
)(SwitchChannelSuggestion);

function getWrappedChannelTerm(wrappedChannel: WrappedChannel) {
    if (isFakeDirectChannel(wrappedChannel.channel) && wrappedChannel.channel.userId) {
        return wrappedChannel.channel.userId;
    }

    return wrappedChannel.channel.id;
}

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

// Results are ranked on one additive scale so that comparing any two of them is consistent with
// comparing them through a third. Each weight is larger than the sum of every weaker one, so a
// stronger reason to demote always outranks any combination of weaker reasons.
const ARCHIVED_RANK_PENALTY = 72;
const DEACTIVATED_RANK_PENALTY = 36;

// How recently the user engaged with a conversation is the primary signal: one opened within the
// last month leads, a staler one comes next, and one that was never opened trails both. This is what
// keeps an exact but long-abandoned match below conversations the user actually uses.
const RECENT_ACTIVITY_WINDOW = 30 * 24 * 60 * 60 * 1000;
const STALE_ACTIVITY_RANK_PENALTY = 12;
const NO_ACTIVITY_RANK_PENALTY = 24;

// Within a recency band a name the search term is a prefix of beats one that only contains it
// somewhere in the middle, so a channel directly named for the term is not buried under direct
// messages that merely mention it.
const NON_PREFIX_MATCH_RANK_PENALTY = 6;

// Within a recency band and prefix tier a direct message outranks a group message, which outranks a
// channel.
const GROUP_MESSAGE_RANK_PENALTY = 2;
const CHANNEL_RANK_PENALTY = 4;

const HIDDEN_IN_SIDEBAR_RANK_PENALTY = 1;

// The search term is compared against lower cased display names and usernames, neither of which
// carries the leading @ of a mention.
function normalizeSearchTerm(searchTerm: string) {
    const lowerCased = searchTerm.toLowerCase();
    return lowerCased.startsWith('@') ? lowerCased.substring(1) : lowerCased;
}

// A group message has no name of its own: its display name is its members listed alphabetically, so
// it starts with a searched username only when that member happens to sort first. That is
// coincidental rather than a real prefix match, so group messages never count as one.
function startsWithSearchTerm(wrapped: WrappedChannel, searchTerm: string) {
    const channel = wrapped.channel;

    if (channel.type === Constants.GM_CHANNEL) {
        return false;
    }

    let displayName = channel.display_name.toLowerCase();
    if (channel.type === Constants.DM_CHANNEL && displayName.startsWith('@')) {
        displayName = displayName.substring(1);
    }

    return displayName.startsWith(searchTerm) || wrapped.name.toLowerCase().startsWith(searchTerm);
}

function activityRankPenalty(wrapped: WrappedChannel) {
    if (!wrapped.last_viewed_at) {
        return NO_ACTIVITY_RANK_PENALTY;
    }

    if (Date.now() - wrapped.last_viewed_at > RECENT_ACTIVITY_WINDOW) {
        return STALE_ACTIVITY_RANK_PENALTY;
    }

    return 0;
}

function typeRankPenalty(channel: ChannelItem) {
    if (channel.type === Constants.DM_CHANNEL) {
        return 0;
    }

    if (channel.type === Constants.GM_CHANNEL) {
        return GROUP_MESSAGE_RANK_PENALTY;
    }

    return CHANNEL_RANK_PENALTY;
}

function rankPenalties(wrapped: WrappedChannel, searchTerm: string) {
    const channel = wrapped.channel;

    return {
        archived: channel.delete_at ? ARCHIVED_RANK_PENALTY : 0,
        deactivated: wrapped.deactivated ? DEACTIVATED_RANK_PENALTY : 0,
        activity: activityRankPenalty(wrapped),
        nonPrefixMatch: startsWithSearchTerm(wrapped, searchTerm) ? 0 : NON_PREFIX_MATCH_RANK_PENALTY,
        type: typeRankPenalty(channel),
        hiddenInSidebar: wrapped.hiddenInSidebar ? HIDDEN_IN_SIDEBAR_RANK_PENALTY : 0,
    };
}

function searchRank(wrapped: WrappedChannel, searchTerm: string) {
    const penalties = rankPenalties(wrapped, searchTerm);

    return penalties.archived +
        penalties.deactivated +
        penalties.activity +
        penalties.nonPrefixMatch +
        penalties.type +
        penalties.hiddenInSidebar;
}

// Builds the per-result ranking breakdown that the developer-mode debug log renders. Rank is
// additive and lower sorts first; each field is the penalty that reason contributed, and
// last_viewed_at is the recency tie-breaker used within a rank tier.
function rankingDebugRows(searchTerm: string, items: WrappedChannel[]) {
    const normalizedTerm = normalizeSearchTerm(searchTerm);

    return items.map((wrapped) => {
        const penalties = rankPenalties(wrapped, normalizedTerm);

        return {
            name: wrapped.channel.display_name || wrapped.name,
            term: getWrappedChannelTerm(wrapped),
            type: wrapped.channel.type,
            rank: searchRank(wrapped, normalizedTerm),
            archived: penalties.archived,
            deactivated: penalties.deactivated,
            activity: penalties.activity,
            nonPrefixMatch: penalties.nonPrefixMatch,
            conversationType: penalties.type,
            hiddenInSidebar: penalties.hiddenInSidebar,
            last_viewed_at: wrapped.last_viewed_at ? new Date(wrapped.last_viewed_at).toISOString() : 'never',
        };
    });
}

export function makeQuickSwitchSorter(searchTerm: string) {
    const normalizedTerm = normalizeSearchTerm(searchTerm);

    return (wrappedA: WrappedChannel, wrappedB: WrappedChannel) => {
        const rankDifference = searchRank(wrappedA, normalizedTerm) - searchRank(wrappedB, normalizedTerm);

        if (rankDifference !== 0) {
            return rankDifference;
        }

        return sortChannelsByRecencyAndTypeAndDisplayName(wrappedA, wrappedB);
    };
}

function makeChannelSearchFilter(curState: GlobalState, channelPrefix: string) {
    const channelPrefixLower = channelPrefix.toLowerCase();
    const splitPrefixBySpace = channelPrefixLower.trim().split(/[ ,]+/);
    const usersInChannels = getUserIdsInChannels(curState);
    const userSearchStrings: RelationOneToOne<UserProfile, string> = {};
    const SEPARATOR = ';|;';

    return (channel: ChannelItem) => {
        let searchString = `${channel.display_name}${SEPARATOR}${channel.name}`;
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
                    const {nickname, username, email} = user;

                    // Apply smart email search logic - include email based on whether @ is in search term
                    const includeEmail = channelPrefixLower.includes('@');
                    let emailPart = '';
                    if (includeEmail && email) {
                        emailPart = email;
                    } else if (email) {
                        emailPart = email.split('@')[0];
                    }
                    const searchParts = [nickname, username, Utils.getFullName(user)];
                    if (emailPart) {
                        searchParts.push(emailPart);
                    }
                    userString = searchParts.join(SEPARATOR);
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
    store = globalStore;

    // Logs why a result list is ranked the way it is, but only when developer mode is enabled so it
    // stays out of the way for regular users. Reviewers use it to explain quick switcher ordering
    // without stepping through a debugger.
    private logRankingDebug(searchTerm: string, items: WrappedChannel[], source: string) {
        if (!developerModeEnabled(this.store.getState())) {
            return;
        }

        const rows = rankingDebugRows(searchTerm, items);

        /* eslint-disable no-console */
        console.groupCollapsed(`[QuickSwitcher] "${searchTerm}" — ${source} results (${rows.length}), ranked lowest first`);
        console.table(rows);
        console.groupEnd();
        /* eslint-enable no-console */
    }

    /**
     * whenever this gets adjusted/refactored to not call the callback twice we need to adjust the behavior in
     * the ForwardPostChannelSelect component as well.
     *
     * @see {@link components/forward_post_modal/forward_post_channel_select.tsx}
     */
    handlePretextChanged(channelPrefix: string, resultsCallback: ResultsCallback<WrappedChannel>) {
        if (channelPrefix) {
            this.startNewRequest(channelPrefix);
            if (this.shouldCancelDispatch(channelPrefix)) {
                return false;
            }

            // Dispatch suggestions for local data (filter out deleted and archived channels from local store data)
            let channels = getChannelsInAllTeams(this.store.getState()).concat(getDirectAndGroupChannels(this.store.getState())).filter((c) => c.delete_at === 0);
            channels = this.removeChannelsFromArchivedTeams(channels);
            const users = searchProfilesMatchingWithTerm(this.store.getState(), channelPrefix, false);
            const formattedData = this.formatGroup(channelPrefix, [ThreadsChannel, ...channels], users, true);
            if (formattedData) {
                this.logRankingDebug(channelPrefix, formattedData.items, 'local');
                resultsCallback(this.initialFilteredList(channelPrefix, formattedData));
            }

            // Fetch data from the server and dispatch
            this.fetchUsersAndChannels(channelPrefix, resultsCallback);
        } else {
            this.fetchAndFormatRecentlyViewedChannels(resultsCallback);
        }

        return true;
    }

    private initialFilteredList(channelPrefix: string, {items, terms}: {items: WrappedChannel[]; terms: string[]}): ProviderResults<WrappedChannel> {
        let groups;

        if (items) {
            groups = [{
                key: 'channels',
                label: defineMessage({id: 'suggestion.channels', defaultMessage: 'Channels'}),
                items,
                terms,
                component: ConnectedSwitchChannelSuggestion,
            }];
        } else {
            groups = [{
                key: 'moreChannels',
                label: defineMessage({id: 'suggestion.mention.morechannels', defaultMessage: 'Other Channels'}),
                items: [{type: '', loading: true}],
                terms: [''],
                component: ConnectedSwitchChannelSuggestion,
            }];
        }

        return {
            matchedPretext: channelPrefix,
            groups,
        };
    }

    async fetchUsersAndChannels(channelPrefix: string, resultsCallback: ResultsCallback<WrappedChannel>) {
        const state = this.store.getState();
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

        const channelsAsync = this.store.dispatch(searchAllChannels(channelPrefix, {nonAdminSearch: true}));

        let usersFromServer;
        let channelsFromServer;

        try {
            usersFromServer = await usersAsync;
            const channelsResponse = await channelsAsync;
            channelsFromServer = (channelsResponse as ActionResult).data;
        } catch (err) {
            this.store.dispatch(logError(err));
            return;
        }

        if (this.shouldCancelDispatch(channelPrefix)) {
            return;
        }

        const currentUserId = getCurrentUserId(state);

        // filter out deleted and archived channels from local store data
        let localChannelData = getChannelsInAllTeams(state).concat(getDirectAndGroupChannels(state)).filter((c) => c.delete_at === 0) || [];
        localChannelData = this.removeChannelsFromArchivedTeams(localChannelData);
        const localUserData = searchProfilesMatchingWithTerm(state, channelPrefix, false);
        const localFormattedData = this.formatGroup(channelPrefix, [ThreadsChannel, ...localChannelData], localUserData);
        let remoteChannelData = channelsFromServer.concat(getGroupChannels(state)) || [];
        remoteChannelData = this.removeChannelsFromArchivedTeams(remoteChannelData);

        const remoteUserData = usersFromServer.users || [];
        const remoteFormattedData = this.formatGroup(channelPrefix, remoteChannelData, remoteUserData, false);

        this.store.dispatch({
            type: UserTypes.RECEIVED_PROFILES_LIST,
            data: [...localUserData.filter((user) => user.id !== currentUserId), ...remoteUserData.filter((user) => user.id !== currentUserId)],
        });
        const remoteOnlyItems = remoteFormattedData.items.filter((item) => !localFormattedData.terms.includes(getWrappedChannelTerm(item)));

        // Ranking has to span both sets, otherwise a result only the server knows about is stuck
        // below every local match however well it matches the search term
        const combinedItems = [...localFormattedData.items, ...remoteOnlyItems].sort(makeQuickSwitchSorter(channelPrefix));
        const combinedTerms = combinedItems.map(getWrappedChannelTerm);

        this.logRankingDebug(channelPrefix, combinedItems, 'local + remote');

        resultsCallback({
            matchedPretext: channelPrefix,
            groups: [{
                key: 'channels',
                label: defineMessage({id: 'suggestion.channels', defaultMessage: 'Channels'}),
                items: combinedItems,
                terms: combinedTerms,
                component: ConnectedSwitchChannelSuggestion,
            }],
        });
    }

    userWrappedChannel(user: UserProfile, channel?: ChannelItem): WrappedChannel {
        const intl = getIntl();

        let displayName = '';
        const currentUserId = getCurrentUserId(this.store.getState());

        // The naming format is fullname (nickname)
        // username is shown separately
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
            displayName += (' ' + intl.formatMessage({id: 'suggestion.user.isCurrent', defaultMessage: '(you)'}));
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

    formatGroup(channelPrefix: string, allChannels: ChannelItem[], users: UserProfile[], skipNotMember = true) {
        const channels = [];

        const members = getMyChannelMemberships(this.store.getState());

        const completedChannels: RelationOneToOne<Channel, boolean> = {};

        const channelFilter = makeChannelSearchFilter(this.store.getState(), channelPrefix);

        const state = this.store.getState();
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
                } else if (skipNotMember && (newChannel.type !== Constants.THREADS)) {
                    continue;
                }

                if (channelIsArchived && members[channel.id]) {
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
                } else if (newChannel.type === Constants.GM_CHANNEL) {
                    newChannel.name = newChannel.display_name;
                    wrappedChannel.name = newChannel.name;
                    wrappedChannel.type = Constants.MENTION_GROUPS;
                    const isGMVisible = isGroupChannelManuallyVisible(state, channel.id);
                    if (!isGMVisible && skipNotMember) {
                        continue;
                    }
                    wrappedChannel.hiddenInSidebar = !isGMVisible;
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

                this.applyDiscoverableFlags(wrappedChannel, newChannel, state, Boolean(members[newChannel.id]));

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
            sort(makeQuickSwitchSorter(channelPrefix)).
            map(getWrappedChannelTerm);

        return {
            items: channels,
            terms: channelNames,
        };
    }

    removeChannelsFromArchivedTeams(channels: Channel[]) {
        const state = this.store.getState();
        const activeTeams = getActiveTeamsList(state).map((team: Team) => team.id);
        const newChannels = channels.filter((channel: Channel) => {
            if (!channel.team_id) {
                return true;
            }
            return activeTeams.includes(channel.team_id);
        });
        return newChannels;
    }

    fetchAndFormatRecentlyViewedChannels(resultsCallback: ResultsCallback<WrappedChannel>) {
        const state = this.store.getState();
        let recentChannels = getChannelsInAllTeams(state).concat(getDirectAndGroupChannels(state));
        recentChannels = this.removeChannelsFromArchivedTeams(recentChannels);
        const wrappedRecentChannels = this.wrapChannels(recentChannels, Constants.MENTION_RECENT_CHANNELS);
        const unreadChannels = getSortedAllTeamsUnreadChannels(state);
        const myMembers = getMyChannelMemberships(state);
        const unreadChannelsExclMuted = unreadChannels.filter((channel) => {
            const member = myMembers[channel.id];
            return !isChannelMuted(member);
        }).slice(0, 5);
        let sortedUnreadChannels = this.wrapChannels(unreadChannelsExclMuted, Constants.MENTION_UNREAD);
        if (wrappedRecentChannels.length === 0) {
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
        resultsCallback({
            matchedPretext: '',
            groups: [
                {
                    key: 'unread',
                    label: defineMessage({id: 'suggestion.mention.unread', defaultMessage: 'Unread'}),
                    terms: sortedUnreadChannels.map((wrappedChannel) => wrappedChannel.channel.id),
                    items: sortedUnreadChannels,
                    component: ConnectedSwitchChannelSuggestion,
                },
                {
                    key: 'recent',
                    label: defineMessage({id: 'suggestion.mention.recent.channels', defaultMessage: 'Recent'}),
                    terms: sortedRecentChannels.map((wrappedChannel) => wrappedChannel.channel.id),
                    items: sortedRecentChannels,
                    component: ConnectedSwitchChannelSuggestion,
                },
            ],
        });
    }

    getThreadsItem(countType = 'total', itemType?: string) {
        const state = this.store.getState();
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

    // Flags a wrapped channel as a discoverable private channel the user is not
    // a member of, so Quick Switch routes it to the Request to Join flow rather
    // than the legacy private-channel join confirmation. This must run on every
    // channel-list path (search, recent, unread); otherwise non-search rows drop
    // the flag and fall through to the broken join flow (MM-68764).
    private applyDiscoverableFlags(wrappedChannel: WrappedChannel, channel: ChannelItem, state: GlobalState, isMember: boolean) {
        if (isDiscoverableChannelsEnabled(state) &&
            channel.type === Constants.PRIVATE_CHANNEL &&
            'discoverable' in channel && channel.discoverable &&
            !isMember) {
            wrappedChannel.discoverableNonMember = true;
            wrappedChannel.hasPendingJoinRequest = Boolean(getMyPendingJoinRequestsByChannel(state)[channel.id]);
        }
    }

    wrapChannels(channels: Channel[], channelType: string) {
        const state = this.store.getState();
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
                const user = getUser(this.store.getState(), Utils.getUserIdFromChannelId(channel.name));

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

            this.applyDiscoverableFlags(wrappedChannel, channel, state, Boolean(member));

            wrappedChannel.type = channelType;
            channelList.push(wrappedChannel);
        }
        return channelList;
    }

    async fetchChannels(resultsCallback: ResultsCallback<WrappedChannel>) {
        const state = this.store.getState();
        const teamId = getCurrentTeamId(state);
        if (!teamId) {
            return;
        }
        const channelsAsync = this.store.dispatch(fetchAllMyTeamsChannels());
        let channels;

        try {
            const {data} = await channelsAsync;
            channels = data as Channel[];
        } catch (err) {
            this.store.dispatch(logError(err));
            return;
        }

        if (this.latestPrefix !== '') {
            return;
        }
        const sortedChannels = this.wrapChannels(channels, Constants.MENTION_PUBLIC_CHANNELS).slice(0, 20);
        const channelNames = sortedChannels.map((wrappedChannel) => wrappedChannel.channel.id);

        resultsCallback({
            matchedPretext: '',
            groups: [{
                key: 'channels',
                label: defineMessage({id: 'suggestion.channels', defaultMessage: 'Channels'}),
                items: sortedChannels,
                terms: channelNames,
                component: ConnectedSwitchChannelSuggestion,
            }],
        });
    }
}
