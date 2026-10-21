// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type Search = {
    terms: string;
    isOrSearch: boolean;
};

export type RecentSearchType = 'messages' | 'files';

export type RecentSearch = {
    id: string;
    user_id: string;
    terms: string;
    search_type: RecentSearchType;
    team_id: string;
    create_at: number;
    update_at: number;
};

export type RecentSearchList = {
    items: RecentSearch[];
};

export type SearchState = {
    current: any;
    results: string[];
    fileResults: string[];
    flagged: string[];
    pinned: Record<string, string[]>;
    isSearchingTerm: boolean;
    isSearchGettingMore: boolean;
    isLimitedResults: number;
    matches: {
        [x: string]: string[];
    };
    truncationInfo?: {
        posts: number;
        files: number;
    };
    recentSearches: RecentSearch[];
};

export type SearchParameter = {
    terms: string;
    is_or_search: boolean;
    time_zone_offset?: number;
    page: number;
    per_page: number;
    include_deleted_channels: boolean;
};
