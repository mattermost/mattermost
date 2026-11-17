// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';
import type {Post, PostType} from '@mattermost/types/posts';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import type {SidebarSize} from 'components/resizable_sidebar/constants';

import type {RHSStates} from 'utils/constants';

export type SearchType = '' | 'files' | 'messages';

// MentionType mirrors the three ways a post can mention you: by your username, by a group you belong
// to, or by one of the keywords in your notification settings.
export type MentionType = 'direct' | 'group' | 'keyword';

export type MentionDateRange = 'any' | 'today' | 'last_7_days';

// MentionFilters narrows the recent mentions panel. An empty channelIds or mentionTypes means the
// filter isn't applied, rather than that nothing matches. The team is tracked separately, in
// searchTeam, because the search API takes it as its own argument.
export type MentionFilters = {
    channelIds: Array<Channel['id']>;
    mentionTypes: MentionType[];
    date: MentionDateRange;
};

export type FakePost = {
    id: Post['id'];
    exists: boolean;
    type: PostType;
    message: string;
    reply_count: number;
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
    searchTeam: Team['id'] | null;
    mentionFilters: MentionFilters;
    searchType: SearchType;
    pluggableId: string;
    searchResultsTerms: string;
    searchResultsType: string;
    isSearchingFlaggedPost: boolean;
    isSearchingPinnedPost: boolean;
    isSidebarOpen: boolean;
    isSidebarExpanded: boolean;
    isMenuOpen: boolean;
    editChannelMembers: boolean;
    size: SidebarSize;
    shouldFocusRHS: boolean;
};

export type RhsState = typeof RHSStates[keyof typeof RHSStates] | null;
