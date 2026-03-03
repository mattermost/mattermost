// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

import {getHistory} from 'utils/browser_history';
import {getWikiUrl} from 'utils/url';

export type PageNavigationOptions = {
    openRhs?: boolean;
};

/**
 * Navigates to a wiki page from a page post
 * Preserves edit mode if currently editing the same page
 *
 * @param pagePost - The page post to navigate to
 * @param teamName - The team name for URL construction
 * @param options - Navigation options
 * @param options.openRhs - Whether to open the RHS after navigation
 */
export function navigateToPageFromPost(
    pagePost: Post,
    teamName: string,
    options?: PageNavigationOptions,
): void {
    if (!pagePost.props?.wiki_id) {
        return;
    }

    const wikiId = pagePost.props.wiki_id as string;
    const channelId = pagePost.channel_id;
    const pageId = pagePost.id;

    // Check if we're currently viewing a draft (edit mode) by checking the current URL
    const currentPath = window.location.pathname;
    const draftIdMatch = currentPath.match(/\/drafts\/([^/]+)/);

    let url: string;

    // If we're in edit mode for THIS page, preserve the draft URL
    if (draftIdMatch) {
        const currentDraftId = draftIdMatch[1];

        // Check if the draft is for the page we're navigating to
        // by checking if the URL contains the same pageId
        if (currentPath.includes(`/${wikiId}/`) && currentPath.includes(pageId)) {
            // Stay in draft mode - use getWikiUrl for consistent URL generation
            url = getWikiUrl(teamName, channelId, wikiId, currentDraftId, true);
            getHistory().push(url);
            return;
        }
    }

    // Navigate to view mode
    url = getWikiUrl(teamName, channelId, wikiId, pageId, false);

    // Add query parameter to open RHS if requested
    if (options?.openRhs) {
        url += '?openRhs=true';
    }

    getHistory().push(url);
}
