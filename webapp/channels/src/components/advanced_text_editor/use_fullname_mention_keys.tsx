// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSelector} from 'react-redux';

import {
    getCurrentUser,
    getCurrentUserMentionKeys,
    getUsersByUsername,
} from 'mattermost-redux/selectors/entities/users';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {getMyGroupMentionKeysForChannel, getMyGroupMentionKeys} from 'mattermost-redux/selectors/entities/groups';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import type {GlobalState} from 'types/store';

/**
 * Custom hook to generate mention keys including fullname format
 * @param channelId - Optional channelId to get group mentions specific to a channel
 * @param teamId - Optional teamId required when channelId is provided
 */
export const useFullnameMentionKeys = (channelId?: string, teamId?: string) => {
    return useSelector((state: GlobalState) => {
        // Get base mention keys
        const mentionKeysWithoutGroups = getCurrentUserMentionKeys(state);
        
        // Get group mention keys (channel specific if channelId is provided)
        const groupMentionKeys = channelId && teamId 
            ? getMyGroupMentionKeysForChannel(state, teamId, channelId) 
            : getMyGroupMentionKeys(state, false);
        
        const baseMentionKeys = mentionKeysWithoutGroups.concat(groupMentionKeys);

        // Get all users and display settings
        const users = getUsersByUsername(state);
        const nameDisplaySetting = getTeammateNameDisplaySetting(state);

        // Generate fullname mention keys for all users (including current user)
        const fullnameMentionKeys = [];
        
        for (const user of Object.values(users)) {
            const displayName = displayUsername(user, nameDisplaySetting, false);
            if (displayName !== user.username) {
                fullnameMentionKeys.push({
                    key: `@${displayName}`,
                    caseSensitive: false,
                });
            }
        }

        // Return combined mention keys
        return baseMentionKeys.concat(fullnameMentionKeys);
    });
};
