// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';
import type {Page} from '@mattermost/types/wikis';

import {getHistory} from 'utils/browser_history';
import {PagePropsKeys} from 'utils/constants';
import {getWikiUrl} from 'utils/url';

export type PageNavigationOptions = {
    openRhs?: boolean;
};

export function navigateToPageFromPost(
    pagePost: Post | Page,
    teamName: string,
    options?: PageNavigationOptions,
): void {
    const wikiId = 'wiki_id' in pagePost ? pagePost.wiki_id : (pagePost.props?.[PagePropsKeys.WIKI_ID] as string | undefined);
    if (!wikiId) {
        return;
    }

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
