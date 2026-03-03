// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from '@mattermost/types/store';

import type {ActiveEditorInfo} from 'mattermost-redux/reducers/entities/active_editors';
import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getUsers} from 'mattermost-redux/selectors/entities/users';

const EMPTY_EDITORS: ActiveEditorInfo[] = [];

export function getActiveEditorsState(state: GlobalState) {
    return state.entities.activeEditors;
}

export function getActiveEditorsByPageId(state: GlobalState, pageId: string): Record<string, ActiveEditorInfo> {
    return getActiveEditorsState(state).byPageId[pageId] || {};
}

export const getActiveEditorsForPage = createSelector(
    'getActiveEditorsForPage',
    (state: GlobalState, pageId: string) => getActiveEditorsByPageId(state, pageId),
    (editorsMap) => {
        const editors = Object.values(editorsMap);
        return editors.length > 0 ? editors : EMPTY_EDITORS;
    },
);

export const getActiveEditorsWithProfiles = createSelector(
    'getActiveEditorsWithProfiles',
    (state: GlobalState, pageId: string) => getActiveEditorsForPage(state, pageId),
    getUsers,
    (editors, users) => {
        return editors.
            map((editor) => ({
                ...editor,
                user: users[editor.userId],
            })).
            filter((editor) => editor.user);
    },
);

export function getActiveEditorCount(state: GlobalState, pageId: string): number {
    return getActiveEditorsForPage(state, pageId).length;
}
