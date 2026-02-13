// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as Actions from 'mattermost-redux/actions/active_editors';

import type {ActionFuncAsync} from 'types/store';

export function fetchActiveEditors(wikiId: string, pageId: string): ActionFuncAsync {
    return Actions.fetchActiveEditors(wikiId, pageId);
}

export function handleDraftCreated(pageId: string, userId: string, timestamp: number): ActionFuncAsync {
    return Actions.handleDraftCreated(pageId, userId, timestamp);
}

export function handleDraftUpdated(pageId: string, userId: string, timestamp: number): ActionFuncAsync {
    return Actions.handleDraftUpdated(pageId, userId, timestamp);
}

export function handleDraftDeleted(pageId: string, userId: string): ActionFuncAsync {
    return Actions.handleDraftDeleted(pageId, userId);
}

export function removeStaleEditors(pageId: string): ActionFuncAsync {
    return Actions.removeStaleEditors(pageId);
}
