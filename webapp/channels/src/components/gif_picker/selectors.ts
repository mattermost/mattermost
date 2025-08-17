// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GiphyFetch} from '@giphy/js-fetch-api';

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

import type {GlobalState} from 'types/store';

export const getGiphyFetchInstance: (state: GlobalState) => GiphyFetch | null = createSelector(
    'getGiphyFetchInstance',
    (state) => getConfig(state).GiphySdkKey,
    (giphySdkKey) => {
        if (giphySdkKey) {
            const giphyFetch = new GiphyFetch(giphySdkKey);
            return giphyFetch;
        }

        return null;
    },
);
