// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useMemo} from 'react';
import {GiphyFetch} from '@giphy/js-fetch-api';
import {EmojiVariationsListProps, Grid} from '@giphy/react-components';

const giphyFetch = new GiphyFetch('DxfEk2t4CR8bv4A1kviDBRMP9i1og3Da');

const GUTTER_BETWEEN_GIFS = 8;
const NUM_OF_GIFS_COLUMNS = 2;
const GIF_DEFAULT_WIDTH = 350;
const GIF_MARGIN_ENDS = 12;

interface Props {
    filter: string;
    onClick: EmojiVariationsListProps['onGifClick'];
}

function GifPickerItems(props: Props) {
    function fetch(offset: number) {
        // We dont have to throttled the fetching as the library does it for us
        if (props.filter.length > 0) {
            return giphyFetch.search(props.filter, {offset, limit: 10});
        }

        return giphyFetch.trending({offset, limit: 10});
    }

    const width = useMemo(() => {
        const picketRoot = document.getElementById('emoji-picker-tabs');
        const pickerWidth = picketRoot?.getBoundingClientRect()?.width ?? GIF_DEFAULT_WIDTH;
        return (pickerWidth - (2 * GIF_MARGIN_ENDS));
    }, []);

    return (
        <div className='emoji-picker__items gif-picker__items'>
            <Grid
                key={props.filter.length === 0 ? 'trending' : props.filter}
                columns={NUM_OF_GIFS_COLUMNS}
                gutter={GUTTER_BETWEEN_GIFS}
                hideAttribution={true}
                width={width}
                fetchGifs={fetch}
                onGifClick={props.onClick}
            />
        </div>
    );
}

export default memo(GifPickerItems);
