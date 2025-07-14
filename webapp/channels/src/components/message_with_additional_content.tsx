// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {Posts} from 'mattermost-redux/constants';
import {
    getMyGroupMentionKeysForChannel,
    getMyGroupMentionKeys,
} from 'mattermost-redux/selectors/entities/groups';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUser, getUsersByUsername, getCurrentUserMentionKeys} from 'mattermost-redux/selectors/entities/users';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import PostBodyAdditionalContent from 'components/post_view/post_body_additional_content';
import PostMessageView from 'components/post_view/post_message_view';

import type {PluginsState} from 'types/store/plugins';
import type {GlobalState} from 'types/store';

type Props = {
    id?: string;
    post: Post;
    isEmbedVisible?: boolean;
    pluginPostTypes?: PluginsState['postTypes'];
    isRHS: boolean;
    compactDisplay?: boolean;
}

export default function MessageWithAdditionalContent({post, isEmbedVisible, pluginPostTypes, isRHS, compactDisplay}: Props) {
    // メンションキーを取得（フルネーム形式を含む）
    const mentionKeys = useSelector((state: GlobalState) => {
        const mentionKeysWithoutGroups = getCurrentUserMentionKeys(state);
        const groupMentionKeys = getMyGroupMentionKeys(state, false);
        const baseMentionKeys = mentionKeysWithoutGroups.concat(groupMentionKeys);
        
        // フルネーム形式のメンションキーを追加
        const fullnameMentionKeys = [];
        const users = getUsersByUsername(state);
        const nameDisplaySetting = getTeammateNameDisplaySetting(state);
        
        // 現在のユーザー自身のフルネーム形式のメンションキーを追加
        const currentUserInfo = getCurrentUser(state);
        if (currentUserInfo) {
            const currentUserDisplayName = displayUsername(currentUserInfo, nameDisplaySetting, false);
            if (currentUserDisplayName !== currentUserInfo.username) {
                fullnameMentionKeys.push({
                    key: `@${currentUserDisplayName}`,
                    caseSensitive: false,
                });
            }
        }
        
        // 他のユーザーのフルネーム形式のメンションキーを追加
        for (const [username, user] of Object.entries(users)) {
            if (currentUserInfo && user.id === currentUserInfo.id) {
                continue;
            }
            
            const displayName = displayUsername(user, nameDisplaySetting, false);
            if (displayName !== username) {
                fullnameMentionKeys.push({
                    key: `@${displayName}`,
                    caseSensitive: false,
                });
            }
        }
        
        return baseMentionKeys.concat(fullnameMentionKeys);
    });

    const hasPlugin = post.type && pluginPostTypes && Object.hasOwn(pluginPostTypes, post.type);
    let msg;
    const messageWrapper = (
        <PostMessageView
            post={post}
            isRHS={isRHS}
            compactDisplay={compactDisplay}
            options={{
                mentionHighlight: true,
                mentionKeys: mentionKeys,
            }}
        />
    );
    if (post.state === Posts.POST_DELETED || hasPlugin) {
        msg = messageWrapper;
    } else {
        msg = (
            <PostBodyAdditionalContent
                post={post}
                isEmbedVisible={isEmbedVisible}
            >
                {messageWrapper}
            </PostBodyAdditionalContent>
        );
    }
    return msg;
}
