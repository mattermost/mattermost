// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import debounce from 'lodash/debounce';

import {logError} from 'mattermost-redux/actions/errors';

import {savePageDraft} from 'actions/page_drafts';

import type {DispatchFunc} from 'types/store';

export const debounceSavePageDraft = debounce(async (dispatch: DispatchFunc, channelId: string, wikiId: string, pageId: string, message: string, title: string) => {
    const result = await dispatch(savePageDraft(channelId, wikiId, pageId, message, title));
    if (result && 'error' in result && result.error) {
        dispatch(logError(result.error));
    }
}, 500);
