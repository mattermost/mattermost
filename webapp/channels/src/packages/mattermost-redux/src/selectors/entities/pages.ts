// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';
import type {GlobalState} from '@mattermost/types/store';

// Canonical read path for page objects. Pages live in entities.pages.byId after the
// Redux migration; do not read from entities.posts.posts for page IDs.
// Optional chaining defends against partial Redux state in tests where the slice
// may not be present — combineReducers guarantees it exists in production.
export function getPageById(state: GlobalState, pageId: string): Post | undefined {
    return state.entities.pages?.byId?.[pageId];
}
