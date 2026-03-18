// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GifsResult} from '@giphy/js-fetch-api';
import type {EmojiVariationsListProps} from '@giphy/react-components';
import {Grid} from '@giphy/react-components';
import React, {memo, useCallback} from 'react';
import {useSelector} from 'react-redux';

import {
    getGiphyFetchInstance,
    getGiphyLanguageCode,
} from 'selectors/views/gif_picker';

import NoResultsIndicator from 'components/no_results_indicator';
import {NoResultsVariant} from 'components/no_results_indicator/types';

const GUTTER_BETWEEN_GIFS = 8;
const NUM_OF_GIFS_COLUMNS = 2;
const RATING_GENERAL = 'g';
const NUM_OF_RESULTS_PER_PAGE = 10;
const RESULTS_TYPE = 'gifs';
const SORT_BY = 'relevant';

interface Props {
    width: number;
    filter: string;
    onClick: EmojiVariationsListProps['onGifClick'];
}

function GifPickerItems(props: Props) {
    const giphyFetch = useSelector(getGiphyFetchInstance);
    const giphyLanguageCode = useSelector(getGiphyLanguageCode);

    const fetchGifs = useCallback(
        async (offset: number) => {
            if (!giphyFetch) {
                return {} as GifsResult;
            }

            // We dont have to throttled the fetching as the library does it for us
            if (props.filter.length > 0) {
                const filteredResult = await giphyFetch.search(props.filter, {
                    offset,
                    lang: giphyLanguageCode,
                    sort: SORT_BY,
                    limit: NUM_OF_RESULTS_PER_PAGE,
                    rating: RATING_GENERAL,
                    type: RESULTS_TYPE,
                });
                return filteredResult;
            }

            const trendingResult = await giphyFetch.trending({
                offset,
                limit: NUM_OF_RESULTS_PER_PAGE,
                rating: RATING_GENERAL,
                type: RESULTS_TYPE,
            });
            return trendingResult;
        },
        [props.filter, giphyLanguageCode, giphyFetch],
    );

    return (
        <div className='emoji-picker__items gif-picker__items'>
            <Grid
                key={props.filter.length === 0 ? 'trending' : props.filter}
                columns={NUM_OF_GIFS_COLUMNS}
                gutter={GUTTER_BETWEEN_GIFS}
                hideAttribution={true}
                width={props.width}
                noResultsMessage={
                    <NoResultsIndicator
                        variant={NoResultsVariant.Search}
                        titleValues={{channelName: `${props.filter}`}}
                    />
                }
                fetchGifs={fetchGifs}
                onGifClick={props.onClick}
            />
        </div>
    );
}

export default memo(GifPickerItems);
