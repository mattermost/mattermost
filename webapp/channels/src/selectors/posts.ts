// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Post} from '@mattermost/types/posts';

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {getGlobalItem} from 'selectors/storage';
import {arePreviewsCollapsed} from 'selectors/preferences';
import {StoragePrefixes} from 'utils/constants';

import {getCurrentUser} from 'mattermost-redux/selectors/entities/common';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {ClientConfig} from '@mattermost/types/config';
import {Channel} from '@mattermost/types/channels';
import {UserProfile} from '@mattermost/types/users';

import type {GlobalState} from 'types/store';
import {moveThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';

export function getIsPostBeingEdited(state: GlobalState, postId: string) {
    return state.views.posts.editingPost.postId === postId && state.views.posts.editingPost.show;
}
export function getIsPostBeingEditedInRHS(state: GlobalState, postId: string) {
    const editingPost = getEditingPost(state);

    return editingPost.isRHS && editingPost.postId === postId && state.views.posts.editingPost.show;
}

export function getPostEditHistory(state: GlobalState): Post[] {
    return state.entities.posts.postEditHistory;
}

export const getEditingPost = createSelector(
    'getEditingPost',
    (state: GlobalState) => state.views.posts.editingPost,
    (state: GlobalState) => getPost(state, state.views.posts.editingPost.postId),
    (editingPost, post) => {
        return {
            ...editingPost,
            post,
        };
    },
);

export function isEmbedVisible(state: GlobalState, postId: string) {
    const currentUserId = getCurrentUserId(state);
    const previewCollapsed = arePreviewsCollapsed(state);

    return getGlobalItem(state, StoragePrefixes.EMBED_VISIBLE + currentUserId + '_' + postId, !previewCollapsed);
}

export function isInlineImageVisible(state: GlobalState, postId: string, imageKey: string) {
    const currentUserId = getCurrentUserId(state);
    const imageCollapsed = arePreviewsCollapsed(state);

    return getGlobalItem(state, StoragePrefixes.INLINE_IMAGE_VISIBLE + currentUserId + '_' + postId + '_' + imageKey, !imageCollapsed);
}

export function makeCanWrangler() {
    return createSelector(
        'makeCanWrangler',
        getConfig,
        getCurrentUser,
        moveThreadsEnabled,
        (_state: GlobalState, channelType: Channel['type']) => channelType,
        (_state: GlobalState, _channelType: Channel['type'], replyCount: number) => replyCount,
        (config: Partial<ClientConfig>, user: UserProfile, enabled: boolean, channelType: Channel['type'], replyCount: number) => {
            if (!enabled) {
                return false;
            }
            const {
                WranglerPermittedWranglerUsers,
                WranglerAllowedEmailDomain,
                WranglerMoveThreadMaxCount,
                WranglerMoveThreadFromPrivateChannelEnable,
                WranglerMoveThreadFromDirectMessageChannelEnable,
                WranglerMoveThreadFromGroupMessageChannelEnable,
            } = config;

            let permittedUsers: string[] = [];
            if (WranglerPermittedWranglerUsers && WranglerPermittedWranglerUsers !== '') {
                permittedUsers = WranglerPermittedWranglerUsers?.split(',');
            }

            let allowedEmailDomains: string[] = [];
            if (WranglerAllowedEmailDomain && WranglerAllowedEmailDomain !== '') {
                allowedEmailDomains = WranglerAllowedEmailDomain?.split(',') || [];
            }

            if (permittedUsers?.length > 0) {
                const roles = user.roles.split(' ');
                const hasRole = roles.some((role) => permittedUsers.includes(role));
                if (!hasRole) {
                    return false;
                }
            }

            if (allowedEmailDomains?.length > 0) {
                if (!user.email || !allowedEmailDomains.includes(user.email.split('@')[1])) {
                    return false;
                }
            }

            if (Number(WranglerMoveThreadMaxCount) < replyCount) {
                return false;
            }

            if (channelType === 'P' && WranglerMoveThreadFromPrivateChannelEnable === 'false') {
                return false;
            }

            if (channelType === 'D' && WranglerMoveThreadFromDirectMessageChannelEnable === 'false') {
                return false;
            }

            if (channelType === 'G' && WranglerMoveThreadFromGroupMessageChannelEnable === 'false') {
                return false;
            }

            return true;
        },
    );
}
