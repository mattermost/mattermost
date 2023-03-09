// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type GifsState = {
    app: GifsAppState;
    cache: GifsCacheState;
    categories: GifsCategoriesState;
    search: GifsSearchState;
};

export type GifsAppState = {
    appClassName: string;
    appId: string;
    appName: string;
    basePath: string;
    enableHistory: boolean;
    header: {
        tabs: number[];
        displayText: boolean;
    };
    itemTapType: number;
    shareEvent: string;
}

type GifsCacheState = {
    gifs: Record<string, GfycatAPIItem>;
    updating: boolean;
}

type GifsCategoriesState = {
    cursor: string;
    hasMore: boolean;
    isFetching: boolean;
    tagsDict: Record<string, boolean>;
    tagsList: GfycatAPITag[];
}

type GifsSearchState = {
    priorLocation: string | null;
    resultsByTerm: Record<string, GifsResult>;
    scrollPosition: number;
    searchBarText: string;
    searchText: string;
}

export type GifsResult = GfycatAPIPaginatedResponse & {
    count: number;
    currentPage: number;
    didInvalidate: boolean;
    found: number;
    isFetching: boolean;
    items: string[];
    moreRemaining: boolean;
    pages: Record<number, string[]>;
    start: number;
}

export interface GfycatAPIPaginatedResponse {
    cursor?: string;
    gfycats: GfycatAPIItem[];
    totalCount?: number;
}

export interface GfycatAPIItemResponse {
    gfyItem: GfycatAPIItem;
}

export interface GfycatAPIItem {
    anonymous?: boolean;
    avgColor: string;
    captionsUrl?: null;
    content_urls: { [key: string]: GfycatAPIContent };
    createDate: number;
    description?: string;
    dislikes?: number;
    domainWhitelist?: any[];
    duration?: number;
    encoding?: boolean;
    extraLemmas?: string;
    finished?: boolean;
    frameRate: number;
    gatekeeper: number;
    geoWhitelist?: any[];
    gfyId: string;
    gfyName: string;
    gfyNumber?: string;
    gfySlug?: string;
    gif100px?: string;
    gifSize?: number;
    gifUrl: string;
    hasAudio: boolean;
    hasTransparency: boolean;
    height: number;
    languageCategories: string[];
    languageText?: string;
    likes: number;
    max1mbGif?: string;
    max2mbGif: string;
    max5mbGif: string;
    md5?: string;
    miniPosterUrl: string;
    miniUrl?: string;
    mobileHeight?: number;
    mobilePosterUrl?: string;
    mobileUrl: string;
    mobileWidth?: number;
    mp4Size?: number;
    mp4Url: string;
    nsfw: boolean | number;
    numFrames: number;
    posterUrl: string;
    published: number;
    rating?: string;
    ratio?: null;
    sitename?: string;
    source?: number;
    tags: string[];
    thumb100PosterUrl: string;
    title?: string;
    type?: number;
    url?: string;
    userData?: GfycatAPIUser | [];
    userDisplayName?: string;
    userName?: string;
    username?: string;
    userProfileImageUrl?: string;
    views: number;
    views5?: number;
    webmSize?: number;
    webmUrl?: string;
    webpUrl?: string;
    width: number;
}

export interface GfycatAPIContent {
    width: number;
    size: number;
    url: string;
    height: number;
}

export interface GfycatAPIUser {
    createDate?: number;
    description?: string;
    followers: number;
    following: number;
    iframeProfileImageVisible?: boolean;
    name: string;
    profileImageUrl: string;
    profileUrl?: string;
    publishedGfycats?: number;
    subscription?: number;
    url?: string;
    userid?: string;
    username: string;
    verified: boolean;
    views: number;
}

export interface GfycatAPITag {
    tagName: string;
    gfyId: string;
}

