// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

import type {PagesState} from 'mattermost-redux/reducers/entities/pages';

// Single source of truth for the entities.pages slice mock shape used in tests.
// Adding a sub-slice to pagesReducer requires updating only this helper — all
// call sites inherit the new field automatically.
export function makeInitialPagesState(overrides: Partial<PagesState> = {}): PagesState {
    return {
        byId: {} as Record<string, Post>,
        byWiki: {},
        lastPagesInvalidated: {},
        lastDraftsInvalidated: {},
        publishedDraftTimestamps: {},
        deletedDraftTimestamps: {},
        ...overrides,
    };
}
