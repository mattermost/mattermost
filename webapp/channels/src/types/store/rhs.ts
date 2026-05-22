// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';
import type {Post, PostType} from '@mattermost/types/posts';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import type {SidebarSize} from 'components/resizable_sidebar/constants';

import type {RHSStates} from 'utils/constants';

export type SearchType = '' | 'files' | 'messages';

export type MentionRhsPanel = 'activity' | 'mentions';

export type PlatformNotificationRecord = {
    id: string;
    recordedAt: number;
    postId: Post['id'];
    channelId: Channel['id'];
    teamId: Team['id'];
    channelDisplayName: string;
    contextLabel: string;
    permalinkUrl: string;
    isThreadReply: boolean;
    isMention?: boolean;
    isDirectMessage?: boolean;
    isGroupMessage?: boolean;
    senderUserId?: UserProfile['id'];
    threadRootId?: Post['id'];
    replyCount?: number;
    participantUserIds?: Array<UserProfile['id']>;
    readAt?: number;
    previewBody: string;
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
    mentionRhsPanel: MentionRhsPanel;
    platformNotifications: PlatformNotificationRecord[];
};

export type RhsState = typeof RHSStates[keyof typeof RHSStates] | null;
