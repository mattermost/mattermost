// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Post, PostType} from '@mattermost/types/posts';
import {Channel} from '@mattermost/types/channels';
import {UserProfile} from '@mattermost/types/users';

import {RHSStates} from 'utils/constants';

export type SearchType = '' | 'files' | 'messages';

export type FakePost = {
    id: Post['id'];
    exists: boolean;
    type: PostType;
    message: string;
    channel_id: Channel['id'];
    user_id: UserProfile['id'];
};

export type RhsViewState = {
    selectedPostId: Post['id'];
    selectedPostFocussedAt: number;
    selectedPostCardId: Post['id'];
    selectedChannelId: Channel['id'];
    highlightedPostId: Post['id'];
    previousRhsStates: RhsState[];
    filesSearchExtFilter: string[];
    rhsState: RhsState;
    searchTerms: string;
    searchType: SearchType;
    pluggableId: string;
    searchResultsTerms: string;
    isSearchingFlaggedPost: boolean;
    isSearchingPinnedPost: boolean;
    isSidebarOpen: boolean;
    isSidebarExpanded: boolean;
    isMenuOpen: boolean;
    editChannelMembers: boolean;
};

export type RhsState = typeof RHSStates[keyof typeof RHSStates] | null;
