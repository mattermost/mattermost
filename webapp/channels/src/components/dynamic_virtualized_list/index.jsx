// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-underscore-dangle */
/* eslint-disable react/prop-types */

import memoizeOne from 'memoize-one';
import {createElement, PureComponent} from 'react';

import ListItem from './item_row_shared';

const atBottomMargin = 10;

export class DynamicVirtualizedList extends PureComponent {
    _listMetaData = {
        itemOffsetMap: {},
        itemSizeMap: {},
        totalMeasuredSize: 0,
        atBottom: true,
    };

    _itemStyleCache = {};
    _outerRef;
    _scrollCorrectionInProgress = false;
    _scrollByCorrection = null;
    _keepScrollPosition = false;
    _keepScrollToBottom = false;
    _mountingCorrections = 0;
    _correctedInstances = 0;

    static defaultProps = {
        innerTagName: 'div',
        itemData: undefined,
        outerTagName: 'div',
        overscanCountForward: 30,
        overscanCountBackward: 10,
    };

    state = {
        scrollDirection: 'backward',
        scrollOffset: typeof this.props.initialScrollOffset === 'number' ? this.props.initialScrollOffset : 0,
        scrollUpdateWasRequested: false,
        scrollDelta: 0,
        scrollHeight: 0,
        localOlderPostsToRender: [],
    };

    // Always use explicit constructor for React components.
    // It produces less code after transpilation. (#26)
    // eslint-disable-next-line no-useless-constructor
    constructor(props) {
        super(props);
    }

    scrollBy = (scrollOffset, scrollBy) => () => {
        const element = this._outerRef;
        if (typeof element.scrollBy === 'function' && scrollBy) {
            element.scrollBy(0, scrollBy);
        } else if (scrollOffset) {
            element.scrollTop = scrollOffset;
        }

        this._scrollCorrectionInProgress = false;
    };

    scrollTo(scrollOffset, scrollByValue, useAnimationFrame = false) {
        this._scrollCorrectionInProgress = true;
        this.setState(
            (prevState) => ({
                scrollDirection: prevState.scrollOffset >= scrollOffset ? 'backward' : 'forward',
                scrollOffset,
                scrollUpdateWasRequested: true,
                scrollByValue,
            }),
            () => {
                if (useAnimationFrame) {
                    this._scrollByCorrection = window.requestAnimationFrame(
                        this.scrollBy(
                            this.state.scrollOffset,
                            this.state.scrollByValue,
                        ),
                    );
                } else {
                    this.scrollBy(
                        this.state.scrollOffset,
                        this.state.scrollByValue,
                    )();
                }
            },
        );

        this.forceUpdate();
    }

    scrollToItem(index, align = 'auto', offset = 0) {
        const {scrollOffset} = this.state;

        //Ideally the below scrollTo works fine but firefox has 6px issue and stays 6px from bottom when corrected
        //so manually keeping scroll position bottom for now
        const element = this._outerRef;
        if (index === 0 && align === 'end') {
            this.scrollTo(element.scrollHeight - this.props.height);
            return;
        }

        const offsetOfItem = getOffsetForIndexAndAlignment(
            this.props,
            index,
            align,
            scrollOffset,
            this._listMetaData,
        );
        if (!offsetOfItem) {
            const itemSize = getItemSize(this.props, index, this._listMetaData);
            if (!itemSize && this.props.scrollToFailed) {
                if (this.state.scrolledToInitIndex) {
                    this.props.scrollToFailed(index);
                }
            }
        }

        this.scrollTo(offsetOfItem + offset);
    }

    componentDidMount() {
        const {initialScrollOffset} = this.props;

        if (typeof initialScrollOffset === 'number' && this._outerRef !== null) {
            const element = this._outerRef;
            element.scrollTop = initialScrollOffset;
        }

        this._commitHook();
    }

    getSnapshotBeforeUpdate(_, prevState) {
        if (prevState.localOlderPostsToRender[0] !== this.state.localOlderPostsToRender[0] ||
            prevState.localOlderPostsToRender[1] !== this.state.localOlderPostsToRender[1]
        ) {
            const element = this._outerRef;
            const previousScrollTop = element.scrollTop;
            const previousScrollHeight = element.scrollHeight;
            return {
                previousScrollTop,
                previousScrollHeight,
            };
        }
        return null;
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        if (this.state.scrolledToInitIndex) {
            const {
                scrollDirection,
                scrollOffset,
                scrollUpdateWasRequested,
                scrollHeight,
            } = this.state;

            const {
                scrollDirection: prevScrollDirection,
                scrollOffset: prevScrollOffset,
                scrollUpdateWasRequested: prevScrollUpdateWasRequested,
                scrollHeight: previousScrollHeight,
            } = prevState;

            if (
                scrollDirection !== prevScrollDirection ||
                scrollOffset !== prevScrollOffset ||
                scrollUpdateWasRequested !== prevScrollUpdateWasRequested ||
                scrollHeight !== previousScrollHeight
            ) {
                this._callPropsCallbacks();
            }
            if (!prevState.scrolledToInitIndex) {
                this._keepScrollPosition = false;
                this._keepScrollToBottom = false;
            }
        }

        this._commitHook();
        if (prevProps.itemData !== this.props.itemData) {
            this._dataChange();
        }

        if (prevProps.height !== this.props.height) {
            this._heightChange(prevProps.height, prevState.scrollOffset);
        }

        if (prevState.scrolledToInitIndex !== this.state.scrolledToInitIndex) {
            this._dataChange(); // though this is not data change we are checking for first load change
        }

        if (prevProps.width !== this.props.width) {
            this.innerRefWidth = this.props.innerRef.current.clientWidth;
            this._widthChange(prevProps.height, prevState.scrollOffset);
        }

        if (prevState.localOlderPostsToRender[0] !== this.state.localOlderPostsToRender[0] ||
            prevState.localOlderPostsToRender[1] !== this.state.localOlderPostsToRender[1]
        ) {
            const postlistScrollHeight = this._outerRef.scrollHeight;

            const scrollValue = snapshot.previousScrollTop + (postlistScrollHeight - snapshot.previousScrollHeight);

            this.scrollTo(
                scrollValue,
                scrollValue - snapshot.previousScrollTop,
                true,
            );
        }
    }

    componentWillUnmount() {
        if (this._scrollByCorrection) {
            window.cancelAnimationFrame(this._scrollByCorrection);
        }
    }

    _callOnItemsRendered = memoizeOne((overscanStartIndex, overscanStopIndex, visibleStartIndex, visibleStopIndex) =>
        this.props.onItemsRendered({
            overscanStartIndex,
            overscanStopIndex,
            visibleStartIndex,
            visibleStopIndex,
        }),
    );

    _callOnScroll = memoizeOne((scrollDirection, scrollOffset, scrollUpdateWasRequested, scrollHeight, clientHeight) =>
        this.props.onScroll({
            scrollDirection,
            scrollOffset,
            scrollUpdateWasRequested,
            scrollHeight,
            clientHeight,
        }),
    );

    _callPropsCallbacks() {
        const {itemData, height} = this.props;
        const {
            scrollDirection,
            scrollOffset,
            scrollUpdateWasRequested,
            scrollHeight,
        } = this.state;
        const itemCount = itemData.length;

        if (typeof this.props.onItemsRendered === 'function') {
            if (itemCount > 0) {
                const [
                    overscanStartIndex,
                    overscanStopIndex,
                    visibleStartIndex,
                    visibleStopIndex,
                ] = this._getRangeToRender();

                this._callOnItemsRendered(
                    overscanStartIndex,
                    overscanStopIndex,
                    visibleStartIndex,
                    visibleStopIndex,
                );

                if (
                    scrollDirection === 'backward' &&
                    scrollOffset < 1000 &&
                    overscanStopIndex !== itemCount - 1
                ) {
                    const sizeOfNextElement = getItemSize(
                        this.props,
                        overscanStopIndex + 1,
                        this._listMetaData,
                    ).size;
                    if (!sizeOfNextElement && this.state.scrolledToInitIndex) {
                        this.setState((prevState) => {
                            if (
                                prevState.localOlderPostsToRender[0] !==
                                overscanStopIndex + 1
                            ) {
                                return {
                                    localOlderPostsToRender: [
                                        overscanStopIndex + 1,
                                        overscanStopIndex + 50,
                                    ],
                                };
                            }
                            return null;
                        });
                    }
                }
            }
        }

        if (typeof this.props.onScroll === 'function') {
            this._callOnScroll(
                scrollDirection,
                scrollOffset,
                scrollUpdateWasRequested,
                scrollHeight,
                height,
            );
        }
    }

    // This method is called after mount and update.
    // List implementations can override this method to be notified.
    _commitHook = () => {
        if (
            !this.state.scrolledToInitIndex &&
            Object.keys(this._listMetaData.itemOffsetMap).length
        ) {
            const {index, position, offset} = this.props.initScrollToIndex();
            this.scrollToItem(index, position, offset);
            this.setState({
                scrolledToInitIndex: true,
            });

            if (index === 0) {
                this._keepScrollToBottom = true;
            } else {
                this._keepScrollPosition = true;
            }
        }
    };

    // This method is called when data changes
    // List implementations can override this method to be notified.
    _dataChange = () => {
        if (this._listMetaData.totalMeasuredSize < this.props.height) {
            this.props.canLoadMorePosts();
        }
    };

    _heightChange = (prevHeight, prevOffset) => {
        const wasAtBottom =
            prevOffset + prevHeight >=
            this._listMetaData.totalMeasuredSize - atBottomMargin;

        if (wasAtBottom) {
            this.scrollToItem(0, 'end');
        }
    };

    _widthChange = (prevHeight, prevOffset) => {
        const wasAtBottom =
            prevOffset + prevHeight >=
            this._listMetaData.totalMeasuredSize - atBottomMargin;

        if (wasAtBottom) {
            this.scrollToItem(0, 'end');
        }
    };

    // Lazily create and cache item styles while scrolling,
    // So that pure component sCU will prevent re-renders.
    // We maintain this cache, and pass a style prop rather than index,
    // So that List can clear cached styles and force item re-render if necessary.
    _getItemStyle = (index) => {
        const {itemData} = this.props;

        const itemStyleCache = this._itemStyleCache;

        let style;
        if (Object.prototype.hasOwnProperty.call(itemStyleCache, itemData[index])) {
            style = itemStyleCache[itemData[index]];
        } else {
            style = {
                left: 0,
                top: getItemOffset(this.props, index, this._listMetaData),
                height: getItemSize(this.props, index, this._listMetaData),
                width: '100%',
            };
            itemStyleCache[itemData[index]] = style;
        }

        return style;
    };

    _getRangeToRender(scrollTop) {
        const {itemData, overscanCountForward, overscanCountBackward} =
            this.props;
        const {scrollDirection, scrollOffset} = this.state;
        const itemCount = itemData.length;

        if (itemCount === 0) {
            return [0, 0, 0, 0];
        }
        const scrollOffsetValue = scrollTop >= 0 ? scrollTop : scrollOffset;
        const startIndex = getStartIndexForOffset(
            this.props,
            scrollOffsetValue,
            this._listMetaData,
        );
        const stopIndex = getStopIndexForStartIndex(
            this.props,
            startIndex,
            scrollOffsetValue,
            this._listMetaData,
        );

        // Overscan by one item in each direction so that tab/focus works.
        // If there isn't at least one extra item, tab loops back around.
        const overscanBackward = scrollDirection === 'backward' ? overscanCountBackward : Math.max(1, overscanCountForward);

        const overscanForward = scrollDirection === 'forward' ? overscanCountBackward : Math.max(1, overscanCountForward);

        const minValue = Math.max(0, stopIndex - overscanBackward);
        let maxValue = Math.max(0, Math.min(itemCount - 1, startIndex + overscanForward));

        while (
            !getItemSize(this.props, maxValue, this._listMetaData) &&
            maxValue > 0 &&
            this._listMetaData.totalMeasuredSize > this.props.height
        ) {
            maxValue--;
        }

        if (
            !this.state.scrolledToInitIndex &&
            this.props.initRangeToRender.length
        ) {
            return this.props.initRangeToRender;
        }

        return [minValue, maxValue, startIndex, stopIndex];
    }

    _correctScroll = () => {
        const {scrollOffset} = this.state;
        const element = this._outerRef;
        if (element) {
            element.scrollTop = scrollOffset;
            this._scrollCorrectionInProgress = false;
            this._correctedInstances = 0;
            this._mountingCorrections = 0;
        }
    };

    _generateOffsetMeasurements = () => {
        const {itemOffsetMap, itemSizeMap} = this._listMetaData;
        const {itemData} = this.props;
        this._listMetaData.totalMeasuredSize = 0;

        for (let i = itemData.length - 1; i >= 0; i--) {
            const prevOffset = itemOffsetMap[itemData[i + 1]] || 0;

            // In some browsers (e.g. Firefox) fast scrolling may skip rows.
            // In this case, our assumptions about last measured indices may be incorrect.
            // Handle this edge case to prevent NaN values from breaking styles.
            // Slow scrolling back over these skipped rows will adjust their sizes.
            const prevSize = itemSizeMap[itemData[i + 1]] || 0;

            itemOffsetMap[itemData[i]] = prevOffset + prevSize;
            this._listMetaData.totalMeasuredSize += itemSizeMap[itemData[i]] || 0;

            // Reset cached style to clear stale position.
            delete this._itemStyleCache[itemData[i]];
        }
    };

    _handleNewMeasurements = (key, newSize, forceScrollCorrection) => {
        const {itemSizeMap} = this._listMetaData;
        const {itemData} = this.props;
        const index = itemData.findIndex((item) => item === key);

        // In some browsers (e.g. Firefox) fast scrolling may skip rows.
        // In this case, our assumptions about last measured indices may be incorrect.
        // Handle this edge case to prevent NaN values from breaking styles.
        // Slow scrolling back over these skipped rows will adjust their sizes.
        const oldSize = itemSizeMap[key] || 0;
        if (oldSize === newSize) {
            return;
        }

        itemSizeMap[key] = newSize;

        if (!this.state.scrolledToInitIndex) {
            this._generateOffsetMeasurements();
            return;
        }

        const element = this._outerRef;
        const wasAtBottom =
            this.props.height + element.scrollTop >=
            this._listMetaData.totalMeasuredSize - atBottomMargin;

        if (
            (wasAtBottom || this._keepScrollToBottom) &&
            this.props.correctScrollToBottom
        ) {
            this._generateOffsetMeasurements();
            this.scrollToItem(0, 'end');
            this.forceUpdate();
            return;
        }

        if (forceScrollCorrection || this._keepScrollPosition) {
            const delta = newSize - oldSize;
            const [, , visibleStartIndex] = this._getRangeToRender(this.state.scrollOffset);
            this._generateOffsetMeasurements();
            if (index < visibleStartIndex + 1) {
                return;
            }

            this._scrollCorrectionInProgress = true;

            this.setState(
                (prevState) => {
                    let deltaValue;
                    if (this._mountingCorrections === 0) {
                        deltaValue = delta;
                    } else {
                        deltaValue = prevState.scrollDelta + delta;
                    }
                    this._mountingCorrections++;
                    const newOffset = prevState.scrollOffset + delta;
                    return {
                        scrollOffset: newOffset,
                        scrollDelta: deltaValue,
                    };
                },
                () => {
                    this._correctedInstances++;
                    if (
                        this._mountingCorrections === this._correctedInstances
                    ) {
                        this._correctScroll();
                    }
                },
            );
            return;
        }

        this._generateOffsetMeasurements();
    };

    _onItemRowUnmount = (itemId, index) => {
        const {props} = this;
        if (props.itemData[index] === itemId) {
            return;
        }
        const doesItemExist = props.itemData.includes(itemId);
        if (!doesItemExist) {
            delete this._listMetaData.itemSizeMap[itemId];
            delete this._listMetaData.itemOffsetMap[itemId];
            const element = this._outerRef;

            const atBottom =
                element.offsetHeight + element.scrollTop >=
                this._listMetaData.totalMeasuredSize - atBottomMargin;

            this._generateOffsetMeasurements();

            if (atBottom) {
                this.scrollToItem(0, 'end');
            }

            this.forceUpdate();
        }
    };

    _onScrollVertical = (event) => {
        if (!this.state.scrolledToInitIndex) {
            return;
        }
        const {scrollTop, scrollHeight} = event.currentTarget;
        if (this._scrollCorrectionInProgress) {
            if (this.state.scrollUpdateWasRequested) {
                this.setState(() => ({
                    scrollUpdateWasRequested: false,
                }));
            }
            return;
        }

        if (scrollHeight !== this.state.scrollHeight) {
            this.setState({
                scrollHeight,
            });
        }

        this.setState((prevState) => {
            if (prevState.scrollOffset === scrollTop) {
                // Scroll position may have been updated by cDM/cDU,
                // In which case we don't need to trigger another render,
                return null;
            }

            return {
                scrollDirection:
                    prevState.scrollOffset < scrollTop ? 'forward' : 'backward',
                scrollOffset: scrollTop,
                scrollUpdateWasRequested: false,
                scrollHeight,
                scrollTop,
                scrollDelta: 0,
            };
        });
    };

    _outerRefSetter = (ref) => {
        const {outerRef} = this.props;
        this.innerRefWidth = this.props.innerRef.current.clientWidth;
        this._outerRef = ref;

        if (typeof outerRef === 'function') {
            outerRef(ref);
        } else if (outerRef != null && typeof outerRef === 'object' && Object.prototype.hasOwnProperty.call(outerRef, 'current')) {
            outerRef.current = ref;
        }
    };

    _renderItems = () => {
        const width = this.innerRefWidth;
        const [startIndex, stopIndex] = this._getRangeToRender();
        const itemCount = this.props.itemData.length;
        const items = [];
        if (itemCount > 0) {
            for (let index = itemCount - 1; index >= 0; index--) {
                const {size} = getItemMetadata(
                    this.props,
                    index,
                    this._listMetaData,
                );

                const [
                    localOlderPostsToRenderStartIndex,
                    localOlderPostsToRenderStopIndex,
                ] = this.state.localOlderPostsToRender;

                const isItemInLocalPosts =
                    index >= localOlderPostsToRenderStartIndex &&
                    index < localOlderPostsToRenderStopIndex + 1 &&
                    localOlderPostsToRenderStartIndex === stopIndex + 1;

                const isLoader = this.props.itemData[index] === this.props.loaderId;
                const isVisible = this.props.itemData[index] === this.props.visibleId;
                const itemId = this.props.itemData[index];

                // It's important to read style after fetching item metadata.
                // getItemMetadata() will clear stale styles.
                const style = this._getItemStyle(index);
                if (
                    (index >= startIndex && index < stopIndex + 1) ||
                    isItemInLocalPosts ||
                    isLoader ||
                    isVisible
                ) {
                    const item = createElement(this.props.children, {
                        data: this.props.itemData,
                        itemId,
                    });

                    // Always wrap children in a ItemRow to detect changes in size.
                    items.push(
                        createElement(ListItem, {
                            key: itemId,
                            index,
                            item,
                            itemId,
                            height: size,
                            width,
                            onHeightChange: this._handleNewMeasurements,
                            onUnmount: this._onItemRowUnmount,
                        }),
                    );
                } else {
                    items.push(
                        createElement('div', {
                            key: itemId,
                            style,
                        }),
                    );
                }
            }
        }
        return items;
    };

    render() {
        const {
            className,
            id,
            innerRef,
            innerTagName,
            outerTagName,
            style,
            innerListStyle,
        } = this.props;

        const onScroll = this._onScrollVertical;

        const items = this._renderItems();

        return createElement(
            outerTagName,
            {
                className,
                id,
                onScroll,
                ref: this._outerRefSetter,
                style: {
                    WebkitOverflowScrolling: 'touch',
                    overflowY: 'auto',
                    overflowAnchor: 'none',
                    willChange: 'transform',
                    width: '100%',
                    ...style,
                },
            },
            createElement(
                innerTagName,
                {
                    ref: innerRef,
                    role: 'list',
                    className: 'innerList',
                    style: innerListStyle,
                },
                items,
            ),
        );
    }
}

const getItemMetadata = (props, index, listMetaData) => {
    const {itemOffsetMap, itemSizeMap} = listMetaData;
    const {itemData} = props;

    // If the specified item has not yet been measured,
    // Just return an estimated size for now.
    if (!itemSizeMap[itemData[index]]) {
        return {
            offset: 0,
            size: 0,
        };
    }

    const offset = itemOffsetMap[itemData[index]] || 0;
    const size = itemSizeMap[itemData[index]] || 0;

    return {offset, size};
};

const getItemOffset = (props, index, listMetaData) => getItemMetadata(props, index, listMetaData).offset;

const getOffsetForIndexAndAlignment = (
    props,
    index,
    align,
    scrollOffset,
    listMetaData,
) => {
    const {height} = props;
    const itemMetadata = getItemMetadata(props, index, listMetaData);

    // Get estimated total size after ItemMetadata is computed,
    // To ensure it reflects actual measurements instead of just estimates.
    const estimatedTotalSize = listMetaData.totalMeasuredSize;

    const maxOffset = Math.max(0, (itemMetadata.offset + itemMetadata.size) - height);
    const minOffset = Math.max(0, itemMetadata.offset);

    switch (align) {
    case 'start':
        return minOffset;
    case 'end':
        return maxOffset;
    case 'center':
        return Math.round(((minOffset - (height / 2)) + (itemMetadata.size / 2)));
    case 'auto':
    default:
        if (scrollOffset >= minOffset && scrollOffset <= maxOffset) {
            return estimatedTotalSize - (scrollOffset + height);
        } else if (scrollOffset - minOffset < maxOffset - scrollOffset) {
            return minOffset;
        }
        return maxOffset;
    }
};

const findNearestItem = (props, listMetaData, high, low, scrollOffset) => {
    let index = low;
    while (low <= high) {
        var currentOffset = getItemMetadata(props, low, listMetaData).offset;
        if (scrollOffset - currentOffset <= 0) {
            index = low;
        }

        // eslint-disable-next-line no-param-reassign
        low++;
    }
    return index;
};

const getStartIndexForOffset = (props, offset, listMetaData) => {
    const {totalMeasuredSize} = listMetaData;
    const {itemData} = props;

    // If we've already positioned and measured past this point,
    // Use a binary search to find the closets cell.
    if (offset <= totalMeasuredSize) {
        return findNearestItem(props, listMetaData, itemData.length, 0, offset);
    }

    // Otherwise render a new batch of items starting from where 0.
    return 0;
};

const getStopIndexForStartIndex = (
    props,
    startIndex,
    scrollOffset,
    listMetaData,
) => {
    const {itemData} = props;

    let stopIndex = startIndex;
    const maxOffset = scrollOffset + props.height;
    const itemMetadata = getItemMetadata(props, stopIndex, listMetaData);
    let offset = itemMetadata.offset + (itemMetadata.size || 0);

    while (stopIndex > 0 && offset <= maxOffset) {
        const itemMetadata = getItemMetadata(props, stopIndex, listMetaData);
        offset = itemMetadata.offset + itemMetadata.size;
        stopIndex--;
    }

    if (stopIndex >= itemData.length) {
        return 0;
    }

    return stopIndex;
};

const getItemSize = (props, index, listMetaData) => {
    // Do not hard-code item dimensions.
    // We don't know them initially.
    // Even once we do, changes in item content or list size should reflow.
    return getItemMetadata(props, index, listMetaData).size;
};

export default DynamicVirtualizedList;
