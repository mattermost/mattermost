// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Emoji, EmojiCategory, CustomEmoji, SystemEmoji} from '@mattermost/types/emojis';
import {ServerError} from '@mattermost/types/errors';
import throttle from 'lodash/throttle';
import React, {forwardRef, memo, useCallback} from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import {FixedSizeList, ListItemKeySelector, ListOnScrollProps} from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';

import EmojiPickerCategoryOrEmojiRow from 'components/emoji_picker/components/emoji_picker_category_or_emoji_row';
import {ITEM_HEIGHT, EMOJI_ROWS_OVERSCAN_COUNT, EMOJI_CONTAINER_HEIGHT, CUSTOM_EMOJIS_PER_PAGE, EMOJI_SCROLL_THROTTLE_DELAY} from 'components/emoji_picker/constants';
import {CategoryOrEmojiRow, EmojiCursor} from 'components/emoji_picker/types';
import {isCategoryHeaderRow} from 'components/emoji_picker/utils';

interface Props {
    categoryOrEmojisRows: CategoryOrEmojiRow[];
    isFiltering: boolean;
    activeCategory: EmojiCategory;
    cursorRowIndex: number;
    cursorEmojiId: SystemEmoji['unified'] | CustomEmoji['name'];
    customEmojisEnabled: boolean;
    customEmojiPage: number;
    setActiveCategory: (category: EmojiCategory) => void;
    onEmojiClick: (emoji: Emoji) => void;
    onEmojiMouseOver: (cursor: EmojiCursor) => void;
    incrementEmojiPickerPage: () => void;
    getCustomEmojis: (page?: number, perPage?: number, sort?: string, loadUsers?: boolean) => Promise<{ data: CustomEmoji[]; error: ServerError }>;
}

const EmojiPickerCurrentResults = forwardRef<InfiniteLoader, Props>(({categoryOrEmojisRows, isFiltering, activeCategory, cursorRowIndex, cursorEmojiId, customEmojisEnabled, customEmojiPage, setActiveCategory, onEmojiClick, onEmojiMouseOver, getCustomEmojis, incrementEmojiPickerPage}: Props, ref) => {
    // Function to create unique key for each row
    const getItemKey = (index: Parameters<ListItemKeySelector>[0], rowsData: Parameters<ListItemKeySelector<CategoryOrEmojiRow[]>>[1]) => {
        const data = rowsData[index];

        if (isCategoryHeaderRow(data)) {
            const categoryRow = data.items[0];
            return `${categoryRow.categoryIndex}-${categoryRow.categoryName}`;
        }

        const emojisRow = data.items;
        const emojiNamesArray = emojisRow.map((emoji) => `${emoji.categoryIndex}-${emoji.emojiId}`);
        return emojiNamesArray.join('--');
    };

    const handleScroll = (scrollOffset: ListOnScrollProps['scrollOffset'], activeCategory: EmojiCategory, isFiltering: boolean, categoryOrEmojisRows: CategoryOrEmojiRow[]) => {
        if (isFiltering) {
            return;
        }

        const approxRowsFromTop = Math.ceil(scrollOffset / ITEM_HEIGHT);
        const closestCategory = categoryOrEmojisRows?.[approxRowsFromTop]?.items[0]?.categoryName;

        if (closestCategory === activeCategory || !closestCategory) {
            return;
        }

        setActiveCategory(closestCategory);
    };

    const throttledScroll = useCallback(throttle(({scrollOffset}: ListOnScrollProps) => {
        handleScroll(scrollOffset, activeCategory, isFiltering, categoryOrEmojisRows);
    }, EMOJI_SCROLL_THROTTLE_DELAY, {leading: false, trailing: true},
    ), [activeCategory, isFiltering, categoryOrEmojisRows]);

    const handleIsItemLoaded = (index: number): boolean => {
        return index < categoryOrEmojisRows.length;
    };

    const handleLoadMoreItems = async () => {
        if (customEmojisEnabled === false) {
            return;
        }

        const {data} = await getCustomEmojis(customEmojiPage, CUSTOM_EMOJIS_PER_PAGE);

        // If data came back empty, or data is less than the perPage, then we know there are no more pages
        if (!data || data.length < CUSTOM_EMOJIS_PER_PAGE) {
            return;
        }

        incrementEmojiPickerPage();
    };

    return (
        <div
            className='emoji-picker__items'
            style={{height: EMOJI_CONTAINER_HEIGHT}}
        >
            <div className='emoji-picker__container'>
                <AutoSizer>
                    {({height, width}) => (
                        <InfiniteLoader
                            ref={ref}
                            itemCount={categoryOrEmojisRows.length + 1} // +1 for the loading row
                            isItemLoaded={handleIsItemLoaded}
                            loadMoreItems={handleLoadMoreItems}
                        >
                            {({onItemsRendered, ref}) => (
                                <FixedSizeList
                                    ref={ref}
                                    onItemsRendered={onItemsRendered}
                                    height={height}
                                    width={width}
                                    layout='vertical'
                                    overscanCount={EMOJI_ROWS_OVERSCAN_COUNT}
                                    itemCount={categoryOrEmojisRows.length}
                                    itemData={categoryOrEmojisRows}
                                    itemKey={getItemKey}
                                    itemSize={ITEM_HEIGHT}
                                    onScroll={throttledScroll}
                                >
                                    {({index, style, data}) => (
                                        <EmojiPickerCategoryOrEmojiRow
                                            index={index}
                                            style={style}
                                            data={data}
                                            cursorRowIndex={cursorRowIndex}
                                            cursorEmojiId={cursorEmojiId}
                                            onEmojiClick={onEmojiClick}
                                            onEmojiMouseOver={onEmojiMouseOver}
                                        />
                                    )}
                                </FixedSizeList>
                            )}
                        </InfiniteLoader>
                    )}
                </AutoSizer>
            </div>
        </div>
    );
});

EmojiPickerCurrentResults.displayName = 'EmojiPickerCurrentResults';

export default memo(EmojiPickerCurrentResults);
