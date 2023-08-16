// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback} from 'react';
import {GiphyFetch} from '@giphy/js-fetch-api';
import {EmojiVariationsListProps, Grid} from '@giphy/react-components';

const giphyFetch = new GiphyFetch('DxfEk2t4CR8bv4A1kviDBRMP9i1og3Da');

const GUTTER_BETWEEN_GIFS = 8;
const NUM_OF_GIFS_COLUMNS = 2;

interface Props {
    width: number;
    filter: string;
    onClick: EmojiVariationsListProps['onGifClick'];
}

function GifPickerItems(props: Props) {
    const fetchGifs = useCallback((offset: number) => {
        // We dont have to throttled the fetching as the library does it for us
        if (props.filter.length > 0) {
            return giphyFetch.search(props.filter, {offset, limit: 10});
        }

        return giphyFetch.trending({offset, limit: 10});
    }, [props.filter]);

    return (
        <div className='emoji-picker__items gif-picker__items'>
            <Grid
                key={props.filter.length === 0 ? 'trending' : props.filter}
                columns={NUM_OF_GIFS_COLUMNS}
                gutter={GUTTER_BETWEEN_GIFS}
                hideAttribution={true}
                width={props.width}
                fetchGifs={fetchGifs}
                onGifClick={props.onClick}
            />
        </div>
    );
}

export default memo(GifPickerItems);
