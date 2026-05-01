// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GiphyFetch} from '@giphy/js-fetch-api';

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {getCurrentLocale} from 'selectors/i18n';

import type {GlobalState} from 'types/store';

export const getGiphyFetchInstance: (state: GlobalState) => GiphyFetch | null =
    createSelector(
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

/**
 * Library expects the language code to be the first part of the locale string, e.g. 'en-US' -> 'en'
 * see https://developers.giphy.com/docs/#language-support
 */
export const getGiphyLanguageCode: (state: GlobalState) => string =
    createSelector(
        'getGiphyLanguageCode',
        (state) => getCurrentLocale(state),
        (currentLocale) => {
            return currentLocale?.split('-')?.[0] ?? 'en';
        },
    );
