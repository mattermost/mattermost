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

const GifPicker = ({
    filter,
    getRootPickerNode,
    handleFilterChange,
    onGifClick,
}: Props) => {
    const handleItemClick = useCallback((gif: IGif, event: SyntheticEvent<HTMLElement, Event>) => {
        if (onGifClick) {
            event.preventDefault();

            const imageWithMarkdown = `![${gif.title}](${gif.images.fixed_height.url})`;
            onGifClick(imageWithMarkdown);
        }
    }, [onGifClick]);

    const pickerWidth = useMemo(() => {
        const pickerWidth = getRootPickerNode?.()?.getBoundingClientRect()?.width ?? GIF_DEFAULT_WIDTH;
        return (pickerWidth - (2 * GIF_MARGIN_ENDS));
    }, [getRootPickerNode]);

    return (
        <div>
            <GifPickerSearch
                value={filter}
                onChange={handleFilterChange}
            />
            <GifPickerItems
                width={pickerWidth}
                filter={filter}
                onClick={handleItemClick}
            />
        </div>
    );
};

export default GifPicker;
