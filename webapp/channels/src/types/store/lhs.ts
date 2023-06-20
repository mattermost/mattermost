// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type LhsViewState = {
    isOpen: boolean;

    // Static pages (e.g. Threads, Insights, etc.)
    currentStaticPageId: string;
}

export enum LhsItemType {
    None = 'none',
    Page = 'page',
    Channel = 'channel',
}

export enum LhsPage {
    Drafts = 'drafts',
    Insights = 'activity-and-insights',
    Threads = 'threads',
}

export type StaticPage = {
    id: string;
    isVisible: boolean;
}

