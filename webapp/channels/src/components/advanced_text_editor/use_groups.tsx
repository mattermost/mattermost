// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {GroupSource} from '@mattermost/types/groups';

import {getChannelMemberCountsByGroup} from 'mattermost-redux/actions/channels';
import {Permissions} from 'mattermost-redux/constants';
import {getChannel, getChannelMemberCountsByGroup as selectChannelMemberCountsByGroup} from 'mattermost-redux/selectors/entities/channels';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {getAssociatedGroupsForReferenceByMention} from 'mattermost-redux/selectors/entities/groups';
import {isCustomGroupsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {searchAssociatedGroupsForReference} from 'actions/views/group';

import Constants from 'utils/constants';
import {groupsMentionedInText, mentionsMinusSpecialMentionsInText} from 'utils/post_utils';

import type {GlobalState} from 'types/store';

const useGroups = (
    channelId: string,
    message: string,
) => {
    const dispatch = useDispatch();

    const teamId = useSelector((state: GlobalState) => {
        const channel = getChannel(state, channelId);
        return channel?.team_id || getCurrentTeamId(state);
    });

    const canUseLDAPGroupMentions = useSelector((state: GlobalState) => {
        const channel = getChannel(state, channelId);
        if (!channel) {
            return false;
        }
        const license = getLicense(state);
        const isLDAPEnabled = license?.IsLicensed === 'true' && license?.LDAPGroups === 'true';
        return isLDAPEnabled && haveIChannelPermission(state, channel.team_id, channel.id, Permissions.USE_GROUP_MENTIONS);
    });

    const canUseCustomGroupMentions = useSelector((state: GlobalState) => {
        const channel = getChannel(state, channelId);
        if (!channel) {
            return false;
        }
        return isCustomGroupsEnabled(state) && haveIChannelPermission(state, channel.team_id, channel.id, Permissions.USE_GROUP_MENTIONS);
    });

    const groupsWithAllowReference = useSelector((state: GlobalState) => {
        const channel = getChannel(state, channelId);
        if (!channel) {
            return null;
        }
        return canUseLDAPGroupMentions || canUseCustomGroupMentions ? getAssociatedGroupsForReferenceByMention(state, channel.team_id, channel.id) : null;
    });

    const channelMemberCountsByGroup = useSelector((state: GlobalState) => selectChannelMemberCountsByGroup(state, channelId));

    const getGroupMentions = useCallback((message: string) => {
        let memberNotifyCount = 0;
        let channelTimezoneCount = 0;
        let mentions: string[] = [];
        if (canUseLDAPGroupMentions || canUseCustomGroupMentions) {
            const mentionGroups = groupsMentionedInText(message, groupsWithAllowReference);
            if (mentionGroups.length > 0) {
                mentionGroups.
                    forEach((group) => {
                        if (group.source === GroupSource.Ldap && !canUseLDAPGroupMentions) {
                            return;
                        }
                        if (group.source === GroupSource.Custom && !canUseCustomGroupMentions) {
                            return;
                        }
                        const mappedValue = channelMemberCountsByGroup[group.id];
                        if (mappedValue && mappedValue.channel_member_count > Constants.NOTIFY_ALL_MEMBERS && mappedValue.channel_member_count > memberNotifyCount) {
                            memberNotifyCount = mappedValue.channel_member_count;
                            channelTimezoneCount = mappedValue.channel_member_timezones_count;
                        }
                        mentions.push(`@${group.name}`);
                    });
                mentions = [...new Set(mentions)];
            }
        }
        return {mentions, memberNotifyCount, channelTimezoneCount};
    }, [channelMemberCountsByGroup, groupsWithAllowReference, canUseCustomGroupMentions, canUseLDAPGroupMentions]);

    // Get channel member counts by group on channel switch
    useEffect(() => {
        if (canUseLDAPGroupMentions || canUseCustomGroupMentions) {
            const mentions = mentionsMinusSpecialMentionsInText(message);

            if (mentions.length === 1) {
                dispatch(searchAssociatedGroupsForReference(mentions[0], teamId, channelId));
            } else if (mentions.length > 1) {
                dispatch(getChannelMemberCountsByGroup(channelId));
            }
        }
    }, [channelId]);

    return getGroupMentions;
};

export default useGroups;
