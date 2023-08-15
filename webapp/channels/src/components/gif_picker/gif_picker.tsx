// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {SyntheticEvent, useCallback} from 'react';
import {IGif} from '@giphy/js-types';

import GifPickerSearch from './components/gif_picker_search';
import GifPickerItems from './components/gif_picker_items';

type Props = {
    filter: string;
    onGifClick?: (gif: string) => void;
    handleFilterChange: (filter: string) => void;
}

const GifPicker = (props: Props) => {
    const handleItemClick = useCallback((gif: IGif, event: SyntheticEvent<HTMLElement, Event>) => {
        if (props.onGifClick) {
            event.preventDefault();

            const imageWithMarkdown = `![${gif.title}](${gif.images.fixed_height_downsampled.url})`;
            props.onGifClick(imageWithMarkdown);
        }
    }, [props.onGifClick]);

    return (
        <div>
            <GifPickerSearch
                value={props.filter}
                onChange={props.handleFilterChange}
            />
            <GifPickerItems
                filter={props.filter}
                onClick={handleItemClick}
            />
        </div>
    );
};

export default GifPicker;
