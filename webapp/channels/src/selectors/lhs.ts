// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {
    insightsAreEnabled,
    isCollapsedThreadsEnabled,
} from 'mattermost-redux/selectors/entities/preferences';
import {makeGetDraftsCount} from 'selectors/drafts';

import {GlobalState} from 'types/store';
import {StaticPage} from 'types/store/lhs';

export function getIsLhsOpen(state: GlobalState): boolean {
    return state.views.lhs.isOpen;
}

export function getCurrentStaticPageId(state: GlobalState): string {
    return state.views.lhs.currentStaticPageId;
}

export const getDraftsCount = makeGetDraftsCount();

export const getVisibleStaticPages = createSelector(
    'getVisibleSidebarStaticPages',
    insightsAreEnabled,
    isCollapsedThreadsEnabled,
    getDraftsCount,
    (insightsEnabled, collapsedThreadsEnabled, draftsCount) => {
        const staticPages: StaticPage[] = [];

        if (insightsEnabled) {
            staticPages.push({
                id: 'activity-and-insights',
                isVisible: true,
            });
        }

        if (collapsedThreadsEnabled) {
            staticPages.push({
                id: 'threads',
                isVisible: true,
            });
        }

        staticPages.push({
            id: 'drafts',
            isVisible: draftsCount > 0,
        });

        return staticPages.filter((item) => item.isVisible);
    },
);
