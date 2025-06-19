// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IGif} from '@giphy/js-types';
import type {SyntheticEvent} from 'react';
import React, {useCallback, useMemo} from 'react';

import GifPickerItems from './components/gif_picker_items';
import GifPickerSearch from './components/gif_picker_search';

const GIF_DEFAULT_WIDTH = 350;
const GIF_MARGIN_ENDS = 12;

type Props = {
    filter: string;
    onGifClick?: (gif: string) => void;
    handleFilterChange: (filter: string) => void;
    getRootPickerNode: () => HTMLDivElement | null;
}

const GifPicker = (props: Props) => {
    const handleItemClick = useCallback((gif: IGif, event: SyntheticEvent<HTMLElement, Event>) => {
        if (props.onGifClick) {
            event.preventDefault();

            const imageWithMarkdown = `![${gif.title}](${gif.images.fixed_height.url})`;
            props.onGifClick(imageWithMarkdown);
        }
    }, [props.onGifClick]);

    const pickerWidth = useMemo(() => {
        const pickerWidth = props.getRootPickerNode?.()?.getBoundingClientRect()?.width ?? GIF_DEFAULT_WIDTH;
        return (pickerWidth - (2 * GIF_MARGIN_ENDS));
    }, [props.getRootPickerNode]);

    return (
        <>
            <GifPickerSearch
                value={props.filter}
                onChange={props.handleFilterChange}
            />
            <GifPickerItems
                width={pickerWidth}
                filter={props.filter}
                onClick={handleItemClick}
            />
        </>
    );
};

export default GifPicker;
