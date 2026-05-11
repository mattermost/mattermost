// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

import {getHistory} from 'utils/browser_history';
import {PagePropsKeys} from 'utils/constants';
import {getWikiUrl} from 'utils/url';

export type PageNavigationOptions = {
    openRhs?: boolean;
};

export function navigateToPageFromPost(
    pagePost: Post,
    teamName: string,
    options?: PageNavigationOptions,
): void {
    if (!pagePost.props?.[PagePropsKeys.WIKI_ID]) {
        return;
    }

    const wikiId = pagePost.props[PagePropsKeys.WIKI_ID] as string;
    const pageId = pagePost.id;

    const currentPath = window.location.pathname;
    const draftIdMatch = currentPath.match(/\/drafts\/([^/]+)/);

    let url: string;

    // Preserve draft URL when navigating to the same page being edited.
    if (draftIdMatch) {
        const currentDraftId = draftIdMatch[1];

        if (currentPath.includes(`/${wikiId}/`) && currentPath.includes(pageId)) {
            url = getWikiUrl(teamName, wikiId, currentDraftId, true);
            getHistory().push(url);
            return;
        }
    }

    url = getWikiUrl(teamName, wikiId, pageId, false);

    if (options?.openRhs) {
        url += '?openRhs=true';
    }

    getHistory().push(url);
}
