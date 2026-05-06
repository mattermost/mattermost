// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ActionFuncAsync} from 'types/store';

import {fetchPageDraftsForWiki} from './page_drafts';
import {fetchPages} from './pages';

export function fetchWikiBundle(wikiId: string): ActionFuncAsync {
    return async (dispatch) => {
        await Promise.all([
            dispatch(fetchPages(wikiId)),
            dispatch(fetchPageDraftsForWiki(wikiId)),
        ]);

        return {data: true};
    };
}
