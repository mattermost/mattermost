// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import debounce from 'lodash/debounce';

import {savePageDraft} from 'actions/page_drafts';

export const debounceSavePageDraft = debounce((dispatch, channelId, wikiId, pageId, message, title) => {
    dispatch(savePageDraft(channelId, wikiId, pageId, message, title));
}, 500);
