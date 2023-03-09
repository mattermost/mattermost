// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type Search = {
    terms: string;
    isOrSearch: boolean;
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
    recent: {
        [x: string]: Search[];
    };
    matches: {
        [x: string]: string[];
    };
};

export type SearchParameter = {
    terms: string;
    is_or_search: boolean;
    time_zone_offset?: number;
    page: number;
    per_page: number;
    include_deleted_channels: boolean;
}
