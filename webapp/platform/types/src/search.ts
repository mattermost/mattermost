// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type Search = {
    terms: string;
    isOrSearch: boolean;
};

export type CurrentSearch = {
   isEnd : boolean;
   isFilesEnd: boolean;
   isOmniSearchAtEnd: boolean;
   params?: SearchParameter
}

export type SearchState = {
    current: Record<string, CurrentSearch>;
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
    omniSearchResults: OmniSearchResult[];
};

export type SearchParameter = {
    terms: string;
    is_or_search: boolean;
    time_zone_offset?: number;
    page: number;
    per_page: number;
    include_deleted_channels: boolean;
}

export type OmniSearchResult = {
    id: string;
    icon: string;
    title: string;
    subtitle: string;
    link: string;
    description: string;
    source: string;
    create_at: number;
    update_at: number;
}
