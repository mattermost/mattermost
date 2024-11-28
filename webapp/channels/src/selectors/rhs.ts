// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';
import type {Post, PostType} from '@mattermost/types/posts';

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {makeGetChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {makeGetGlobalItem, makeGetGlobalItemWithDefault} from 'selectors/storage';

import type {SidebarSize} from 'components/resizable_sidebar/constants';

import {PostTypes, StoragePrefixes} from 'utils/constants';
import {localizeMessage} from 'utils/utils';

import type {GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';
import type {RhsState, FakePost, SearchType} from 'types/store/rhs';

export function getSelectedPostId(state: GlobalState): Post['id'] {
    return state.views.rhs.selectedPostId;
}

export function getRhsSize(state: GlobalState): SidebarSize {
    return state.views.rhs.size;
}

export function getSelectedPostFocussedAt(state: GlobalState): number {
    return state.views.rhs.selectedPostFocussedAt;
}

export function getSelectedPostCardId(state: GlobalState): Post['id'] {
    return state.views.rhs.selectedPostCardId;
}

export function getHighlightedPostId(state: GlobalState): Post['id'] {
    return state.views.rhs.highlightedPostId;
}

export function getFilesSearchExtFilter(state: GlobalState): string[] {
    return state.views.rhs.filesSearchExtFilter;
}

export function getSelectedPostCard(state: GlobalState) {
    return state.entities.posts.posts[getSelectedPostCardId(state)];
}

export function getSelectedChannelId(state: GlobalState) {
    return state.views.rhs.selectedChannelId;
}

export const getSelectedChannel = (() => {
    const getChannel = makeGetChannel();

    return (state: GlobalState) => {
        const channelId = getSelectedChannelId(state);

        return getChannel(state, channelId);
    };
})();

export function getPluggableId(state: GlobalState) {
    return state.views.rhs.pluggableId;
}

export function getActiveRhsComponent(state: GlobalState) {
    const pluggableId = getPluggableId(state);
    const components = state.plugins.components.RightHandSidebarComponent;
    return components.find((c) => c.id === pluggableId);
}

function getRealSelectedPost(state: GlobalState) {
    return state.entities.posts.posts[getSelectedPostId(state)];
}

export const getSelectedPost = createSelector(
    'getSelectedPost',
    getSelectedPostId,
    getRealSelectedPost,
    getSelectedChannelId,
    getCurrentUserId,
    (
        selectedPostId: Post['id'],
        selectedPost: Post,
        selectedPostChannelId: Channel['id'],
        currentUserId,
    ): Post | FakePost => {
        if (selectedPost) {
            return selectedPost;
        }

        // If there is no root post found, assume it has been deleted by data retention policy, and create a fake one.
        return {
            id: selectedPostId,
            exists: false,
            type: PostTypes.FAKE_PARENT_DELETED as PostType,
            message: localizeMessage({
                id: 'rhs_thread.rootPostDeletedMessage.body',
                defaultMessage:
                    'Part of this thread has been deleted due to a data retention policy. You can no longer reply to this thread.',
            }),
            channel_id: selectedPostChannelId,
            user_id: currentUserId,
            reply_count: 0,
        };
    },
);

export function getRhsState(state: GlobalState): RhsState {
    return state.views.rhs.rhsState;
}

export function getPreviousRhsState(state: GlobalState): RhsState {
    if (state.views.rhs.previousRhsStates === null || state.views.rhs.previousRhsStates.length === 0) {
        return null;
    }
    return state.views.rhs.previousRhsStates[state.views.rhs.previousRhsStates.length - 1];
}

export function getSearchTerms(state: GlobalState): string {
    return state.views.rhs.searchTerms;
}

// getSearchTeam returns the team ID that the search is currently scoped to, or the current team if no team was specified.
export function getSearchTeam(state: GlobalState): string {
    return state.views.rhs.searchTeam ?? getCurrentTeamId(state);
}

export function getSearchType(state: GlobalState): SearchType {
    return state.views.rhs.searchType;
}

export function getSearchResultsTerms(state: GlobalState): string {
    return state.views.rhs.searchResultsTerms;
}

export function getSearchResultsType(state: GlobalState): string {
    return state.views.rhs.searchResultsType;
}

export function getIsSearchingTerm(state: GlobalState): boolean {
    return state.entities.search.isSearchingTerm;
}

export function getIsSearchingFlaggedPost(state: GlobalState): boolean {
    return state.views.rhs.isSearchingFlaggedPost;
}

export function getIsSearchingPinnedPost(state: GlobalState): boolean {
    return state.views.rhs.isSearchingPinnedPost;
}

export function getIsSearchGettingMore(state: GlobalState): boolean {
    return state.entities.search.isSearchGettingMore;
}

export function makeGetChannelDraft() {
    const defaultDraft = Object.freeze({
        message: '',
        fileInfos: [],
        uploadsInProgress: [],
        createAt: 0,
        updateAt: 0,
        channelId: '',
        rootId: '',
    });
    const getDraft = makeGetGlobalItemWithDefault(defaultDraft);

    return (state: GlobalState, channelId?: string): PostDraft => {
        if (!channelId) {
            return defaultDraft;
        }

        const draft = getDraft(state, StoragePrefixes.DRAFT + channelId);
        if (
            typeof draft.message !== 'undefined' &&
            typeof draft.uploadsInProgress !== 'undefined' &&
            typeof draft.fileInfos !== 'undefined'
        ) {
            return draft;
        }

        return defaultDraft;
    };
}

export function getPostDraft(state: GlobalState, prefixId: string, suffixId: string): PostDraft {
    const defaultDraft = {
        message: '',
        fileInfos: [],
        uploadsInProgress: [],
        createAt: 0,
        updateAt: 0,
        channelId: '',
        rootId: '',
    };

    if (prefixId === StoragePrefixes.COMMENT_DRAFT) {
        defaultDraft.rootId = suffixId;
    }
    const draft = makeGetGlobalItem(prefixId + suffixId, defaultDraft)(state);

    if (
        typeof draft.message !== 'undefined' &&
        typeof draft.uploadsInProgress !== 'undefined' &&
        typeof draft.fileInfos !== 'undefined'
    ) {
        return draft;
    }

    return defaultDraft;
}

export function getIsRhsOpen(state: GlobalState): boolean {
    return state.views.rhs.isSidebarOpen && !state.views.rhsSuppressed;
}

export function getIsRhsMenuOpen(state: GlobalState): boolean {
    return state.views.rhs.isMenuOpen;
}

export function getIsRhsExpanded(state: GlobalState): boolean {
    return state.views.rhs.isSidebarExpanded;
}

export function getIsEditingMembers(state: GlobalState): boolean {
    return state.views.rhs.editChannelMembers === true;
}
