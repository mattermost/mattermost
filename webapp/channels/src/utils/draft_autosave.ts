// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import debounce from 'lodash/debounce';

import {savePageDraft} from 'actions/page_drafts';

export const debounceSavePageDraft = debounce((dispatch, channelId, wikiId, draftId, message, title, pageId) => {
    dispatch(savePageDraft(channelId, wikiId, draftId, message, title, pageId));
}, 500);
