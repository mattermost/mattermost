// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type React from 'react';
import type {IntlShape} from 'react-intl';

import type {FileInfo} from '@mattermost/types/files';
import type {Post} from '@mattermost/types/posts';

import type {SearchFilterType} from 'components/search/types';

import type {SearchType} from 'types/store/rhs';

export type OwnProps = {
    [key: string]: any;
    isSideBarExpanded: boolean;
    isMentionSearch: boolean;
    isFlaggedPosts: boolean;
    isPinnedPosts: boolean;
    updateSearchTerms: (terms: string) => void;
    getMorePostsForSearch: () => void;
    getMoreFilesForSearch: () => void;
    shrink: () => void;
    isCard?: boolean;
    isOpened?: boolean;
    channelDisplayName?: string;
    children?: React.ReactNode;
    searchType: SearchType;
    setSearchType: (searchType: SearchType) => void;
    searchFilterType: SearchFilterType;
    setSearchFilterType: (filterType: SearchFilterType) => void;
}

export type StateProps = {
    results: Post[];
    fileResults: FileInfo[];
    matches: Record<string, string[]>;
    searchTerms: string;
    isSearchingTerm: boolean;
    isSearchingFlaggedPost: boolean;
    isSearchingPinnedPost: boolean;
    isSearchGettingMore: boolean;
    isSearchAtEnd: boolean;
    isSearchFilesAtEnd: boolean;
}

export type IntlProps = {
    intl: IntlShape;
}

export type Props = OwnProps & StateProps & IntlProps;

