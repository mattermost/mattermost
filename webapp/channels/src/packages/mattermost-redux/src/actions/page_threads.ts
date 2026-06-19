// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserThreadWithPost} from '@mattermost/types/threads';

import {WikiTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import {PostTypes} from 'mattermost-redux/constants/posts';
import type {DispatchFunc} from 'mattermost-redux/types/actions';

type PageWithWikiId = {pageId: string; wikiId: string | undefined};

export async function fetchMissingPagePosts(threads: UserThreadWithPost[], dispatch: DispatchFunc): Promise<void> {
    const pageMap = new Map<string, string | undefined>();
    for (const {post} of threads) {
        if (post.type === PostTypes.PAGE_COMMENT && post.props?.page_id && !pageMap.has(post.props.page_id as string)) {
            pageMap.set(post.props.page_id as string, post.props?.wiki_id as string | undefined);
        }
    }
    const pageEntries: PageWithWikiId[] = Array.from(pageMap.entries()).map(([pageId, wikiId]) => ({pageId, wikiId}));

    if (pageEntries.length === 0) {
        return;
    }

    try {
        const entriesWithWikiId = pageEntries.filter(({wikiId}) => wikiId != null);
        if (entriesWithWikiId.length === 0) {
            return;
        }

        const pagePosts = await Promise.all(entriesWithWikiId.map(({pageId, wikiId}) =>
            Client4.getPage(wikiId!, pageId),
        ));

        pagePosts.forEach((post, i: number) => {
            const {wikiId} = entriesWithWikiId[i];
            dispatch({
                type: WikiTypes.RECEIVED_PAGE,
                data: {page: {...post, update_at: 0}, wikiId},
            });
        });
    } catch {
        // Failed to fetch page posts
    }
}
