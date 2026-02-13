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

export function getFocusedInlineCommentId(state: GlobalState): string | null {
    return state.views.wikiRhs?.focusedInlineCommentId || null;
}

export function getWikiRhsActiveTab(state: GlobalState): 'page_comments' | 'all_threads' {
    return state.views.wikiRhs?.activeTab || 'page_comments';
}

export function getPendingInlineAnchor(state: GlobalState): {anchor_id: string; text: string} | null {
    return state.views.wikiRhs?.pendingInlineAnchor || null;
}

export function getIsSubmittingComment(state: GlobalState): boolean {
    return state.views.wikiRhs?.isSubmittingComment || false;
}
