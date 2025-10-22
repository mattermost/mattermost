// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from 'types/store';

export function getWikiRhsWikiId(state: GlobalState): string | null {
    return state.views.wikiRhs?.wikiId || null;
}

export function getWikiRhsMode(state: GlobalState): 'outline' | 'comments' {
    return state.views.wikiRhs?.mode || 'outline';
}

export function getSelectedPageId(state: GlobalState): string {
    return state.views.wikiRhs?.selectedPageId || '';
}
