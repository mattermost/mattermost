// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {FileInfo} from '@mattermost/types/files';
import type {Post} from '@mattermost/types/posts';

import type {SearchFilterType} from 'components/search/types';

import type {SearchType} from 'types/store/rhs';

export type OwnProps = {
    channelDisplayName?: string;
    crossTeamSearchEnabled: boolean;
    isCard?: boolean;
    isChannelFiles: boolean;
    isFlaggedPosts: boolean;
    isMentionSearch: boolean;
    isOpened?: boolean;
    isPinnedPosts: boolean;
    isSideBarExpanded: boolean;
    searchFilterType: SearchFilterType;
    searchType: SearchType;

    getMoreFilesForSearch: () => void;
    getMorePostsForSearch: () => void;
    handleSearchHintSelection?: () => void;
    setSearchFilterType: (filterType: SearchFilterType) => void;
    updateSearchTeam: (teamId: string) => void;
    updateSearchTerms: (terms: string) => void;
};

export type StateProps = {
    currentTeamName: string;
    results: Array<Post|string>;
    fileResults: FileInfo[];
    matches: Record<string, string[]>;
    searchPage: number;
    searchTerms: string;
    searchSelectedType: string;
    isSearchingTerm: boolean;
    isSearchingFlaggedPost: boolean;
    isSearchingPinnedPost: boolean;
    isSearchGettingMore: boolean;
    isSearchAtEnd: boolean;
    isSearchFilesAtEnd: boolean;
};

export type Props = OwnProps & StateProps;
