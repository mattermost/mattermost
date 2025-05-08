// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable react/prop-types */

import classNames from 'classnames';
import memoizeOne from 'memoize-one';
import React, {createElement, PureComponent} from 'react';

// import ItemMeasurer from './item_measurer';

import ItemMeasurer from './item_measurer_new';

import './dynamic_virtualized_list.scss';

const atBottomMargin = 10;

const getItemMetadata = (props, index, listMetaData) => {
    const {itemOffsetMap, itemSizeMap} = listMetaData;
    const {itemData} = props;

    // If the specified item has not yet been measured,
    // Just return an estimated size for now.
    if (!itemSizeMap[itemData[index]]) {
        return {offset: 0, size: 0};
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

        // TODO: why are we incrementing low parameter?
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

export default class DynamicVirtualizedList extends PureComponent {
    listMetaData = {
        itemOffsetMap: {},
        itemSizeMap: {},
        totalMeasuredSize: 0,
        atBottom: true,
    };

    itemStyleCache = {};
    outerRef;
    scrollCorrectionInProgress = false;
    scrollByCorrection = null;
    keepScrollPosition = false;
    keepScrollToBottom = false;
    mountingCorrections = 0;
    correctedInstances = 0;

    static defaultProps = {
        itemData: undefined,
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

    componentDidMount() {
        if (typeof this.props.initialScrollOffset === 'number' && this.outerRef !== null) {
            const element = this.outerRef;
            element.scrollTop = this.props.initialScrollOffset;
        }

        this.commitHook();
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

            if (scrollDirection !== prevScrollDirection || scrollOffset !== prevScrollOffset || scrollUpdateWasRequested !== prevScrollUpdateWasRequested || scrollHeight !== previousScrollHeight) {
                this.callPropsCallbacks();
            }

            if (!prevState.scrolledToInitIndex) {
                this.keepScrollPosition = false;
                this.keepScrollToBottom = false;
            }
        }

        this.commitHook();

        if (prevProps.itemData !== this.props.itemData) {
            this.dataChange();
        }

        if (prevProps.height !== this.props.height) {
            this.heightChange(prevProps.height, prevState.scrollOffset);
        }

        if (prevState.scrolledToInitIndex !== this.state.scrolledToInitIndex) {
            this.dataChange(); // though this is not data change we are checking for first load change
        }

        if (prevProps.width !== this.props.width) {
            this.innerRefWidth = this.props.innerRef.current.clientWidth;
            this.widthChange(prevProps.height, prevState.scrollOffset);
        }

        if (prevState.localOlderPostsToRender[0] !== this.state.localOlderPostsToRender[0] || prevState.localOlderPostsToRender[1] !== this.state.localOlderPostsToRender[1]) {
            const postlistScrollHeight = this.outerRef.scrollHeight;

            const scrollValue = snapshot.previousScrollTop + (postlistScrollHeight - snapshot.previousScrollHeight);

            this.scrollTo(
                scrollValue,
                scrollValue - snapshot.previousScrollTop,
                true,
            );
        }
    }

    componentWillUnmount() {
        if (this.scrollByCorrection) {
            window.cancelAnimationFrame(this.scrollByCorrection);
        }
    }

    // This method is called after mount and update.
    // List implementations can override this method to be notified.
    commitHook = () => {
        if (!this.state.scrolledToInitIndex && Object.keys(this.listMetaData.itemOffsetMap).length) {
            const {index, position, offset} = this.props.initScrollToIndex();
            this.scrollToItem(index, position, offset);
            this.setState({
                scrolledToInitIndex: true,
            });

            if (index === 0) {
                this.keepScrollToBottom = true;
            } else {
                this.keepScrollPosition = true;
            }
        }
    };

    scrollBy = (scrollOffset, scrollBy) => () => {
        const element = this.outerRef;
        if (typeof element.scrollBy === 'function' && scrollBy) {
            element.scrollBy(0, scrollBy);
        } else if (scrollOffset) {
            element.scrollTop = scrollOffset;
        }

        this.scrollCorrectionInProgress = false;
    };

    scrollTo(scrollOffset, scrollByValue, useAnimationFrame = false) {
        this.scrollCorrectionInProgress = true;
        this.setState(
            (prevState) => ({
                scrollDirection: prevState.scrollOffset >= scrollOffset ? 'backward' : 'forward',
                scrollOffset,
                scrollUpdateWasRequested: true,
                scrollByValue,
            }),
            () => {
                if (useAnimationFrame) {
                    this.scrollByCorrection = window.requestAnimationFrame(this.scrollBy(this.state.scrollOffset, this.state.scrollByValue));
                } else {
                    this.scrollBy(this.state.scrollOffset, this.state.scrollByValue)();
                }
            },
        );

        this.forceUpdate();
    }

    scrollToItem(index, align = 'auto', offset = 0) {
        const {scrollOffset} = this.state;

        //Ideally the below scrollTo works fine but firefox has 6px issue and stays 6px from bottom when corrected
        //so manually keeping scroll position bottom for now
        const element = this.outerRef;
        if (index === 0 && align === 'end') {
            this.scrollTo(element.scrollHeight - this.props.height);
            return;
        }
        const offsetOfItem = getOffsetForIndexAndAlignment(
            this.props,
            index,
            align,
            scrollOffset,
            this.listMetaData,
        );
        if (!offsetOfItem && offsetOfItem !== 0) {
            const itemSize = getItemSize(this.props, index, this.listMetaData);
            if (!itemSize && this.props.scrollToFailed) {
                if (this.state.scrolledToInitIndex) {
                    this.props.scrollToFailed(index);
                }
            }
            return;
        }

        this.scrollTo(offsetOfItem + offset);
    }

    getSnapshotBeforeUpdate(prevProps, prevState) {
        if (prevState.localOlderPostsToRender[0] !== this.state.localOlderPostsToRender[0] || prevState.localOlderPostsToRender[1] !== this.state.localOlderPostsToRender[1]) {
            const element = this.outerRef;
            const previousScrollTop = element.scrollTop;
            const previousScrollHeight = element.scrollHeight;
            return {
                previousScrollTop,
                previousScrollHeight,
            };
        }
        return null;
    }

    callOnItemsRendered = memoizeOne((overscanStartIndex, overscanStopIndex, visibleStartIndex, visibleStopIndex) =>
        this.props.onItemsRendered({
            overscanStartIndex,
            overscanStopIndex,
            visibleStartIndex,
            visibleStopIndex,
        }),
    );

    callOnScroll = memoizeOne((scrollDirection, scrollOffset, scrollUpdateWasRequested, scrollHeight, clientHeight) =>
        this.props.onScroll({
            scrollDirection,
            scrollOffset,
            scrollUpdateWasRequested,
            scrollHeight,
            clientHeight,
        }),
    );

    callPropsCallbacks() {
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
                ] = this.getRangeToRender();

                this.callOnItemsRendered(
                    overscanStartIndex,
                    overscanStopIndex,
                    visibleStartIndex,
                    visibleStopIndex,
                );

                if (scrollDirection === 'backward' && scrollOffset < 1000 && overscanStopIndex !== itemCount - 1) {
                    const sizeOfNextElement = getItemSize(
                        this.props,
                        overscanStopIndex + 1,
                        this.listMetaData,
                    ).size;

                    if (!sizeOfNextElement && this.state.scrolledToInitIndex) {
                        this.setState((prevState) => {
                            if (prevState.localOlderPostsToRender[0] !== overscanStopIndex + 1) {
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
            this.callOnScroll(
                scrollDirection,
                scrollOffset,
                scrollUpdateWasRequested,
                scrollHeight,
                height,
            );
        }
    }

    // This method is called when data changes
    // List implementations can override this method to be notified.
    dataChange = () => {
        if (this.listMetaData.totalMeasuredSize < this.props.height) {
            this.props.canLoadMorePosts();
        }
    };

    heightChange = (prevHeight, prevOffset) => {
        const wasAtBottom = prevOffset + prevHeight >= this.listMetaData.totalMeasuredSize - atBottomMargin;
        if (wasAtBottom) {
            this.scrollToItem(0, 'end');
        }
    };

    widthChange = (prevHeight, prevOffset) => {
        const wasAtBottom = prevOffset + prevHeight >= this.listMetaData.totalMeasuredSize - atBottomMargin;
        if (wasAtBottom) {
            this.scrollToItem(0, 'end');
        }
    };

    // Lazily create and cache item styles while scrolling,
    // So that pure component sCU will prevent re-renders.
    // We maintain this cache, and pass a style prop rather than index,
    // So that List can clear cached styles and force item re-render if necessary.
    getItemStyle = (index) => {
        const {itemData} = this.props;

        const itemStyleCache = this.itemStyleCache;

        let style;
        // eslint-disable-next-line no-prototype-builtins
        if (itemStyleCache.hasOwnProperty(itemData[index])) {
            style = itemStyleCache[itemData[index]];
        } else {
            style = {
                left: 0,
                top: getItemOffset(this.props, index, this.listMetaData),
                height: getItemSize(this.props, index, this.listMetaData),
                width: '100%',
            };
            itemStyleCache[itemData[index]] = style;
        }

        return style;
    };

    getRangeToRender(scrollTop) {
        const {
            itemData,
            overscanCountForward,
            overscanCountBackward,
        } = this.props;
        const {scrollDirection, scrollOffset} = this.state;
        const itemCount = itemData.length;

        if (itemCount === 0) {
            return [0, 0, 0, 0];
        }
        const scrollOffsetValue = scrollTop >= 0 ? scrollTop : scrollOffset;
        const startIndex = getStartIndexForOffset(
            this.props,
            scrollOffsetValue,
            this.listMetaData,
        );
        const stopIndex = getStopIndexForStartIndex(
            this.props,
            startIndex,
            scrollOffsetValue,
            this.listMetaData,
        );

        // Overscan by one item in each direction so that tab/focus works.
        // If there isn't at least one extra item, tab loops back around.
        const overscanBackward = scrollDirection === 'backward' ? overscanCountBackward : Math.max(1, overscanCountForward);

        const overscanForward = scrollDirection === 'forward' ? overscanCountBackward : Math.max(1, overscanCountForward);

        const minValue = Math.max(0, stopIndex - overscanBackward);
        let maxValue = Math.max(0, Math.min(itemCount - 1, startIndex + overscanForward));

        while (!getItemSize(this.props, maxValue, this.listMetaData) && maxValue > 0 && this.listMetaData.totalMeasuredSize > this.props.height) {
            maxValue--;
        }

        if (!this.state.scrolledToInitIndex && this.props.initRangeToRender.length) {
            return this.props.initRangeToRender;
        }

        return [minValue, maxValue, startIndex, stopIndex];
    }

    correctScroll = () => {
        const {scrollOffset} = this.state;
        const element = this.outerRef;
        if (element) {
            element.scrollTop = scrollOffset;
            this.scrollCorrectionInProgress = false;
            this.correctedInstances = 0;
            this.mountingCorrections = 0;
        }
    };

    generateOffsetMeasurements = () => {
        const {itemOffsetMap, itemSizeMap} = this.listMetaData;
        const {itemData} = this.props;
        this.listMetaData.totalMeasuredSize = 0;

        for (let i = itemData.length - 1; i >= 0; i--) {
            const prevOffset = itemOffsetMap[itemData[i + 1]] || 0;

            // In some browsers (e.g. Firefox) fast scrolling may skip rows.
            // In this case, our assumptions about last measured indices may be incorrect.
            // Handle this edge case to prevent NaN values from breaking styles.
            // Slow scrolling back over these skipped rows will adjust their sizes.
            const prevSize = itemSizeMap[itemData[i + 1]] || 0;

            itemOffsetMap[itemData[i]] = prevOffset + prevSize;
            this.listMetaData.totalMeasuredSize += itemSizeMap[itemData[i]] || 0;

            // Reset cached style to clear stale position.
            delete this.itemStyleCache[itemData[i]];
        }
    };

    handleNewMeasurements = (itemId, newSize, forceScrollCorrection) => {
        const {itemSizeMap} = this.listMetaData;
        const {itemData} = this.props;
        const index = itemData.findIndex((item) => item === itemId);

        console.log('handleNewMeasurements', itemId, newSize, forceScrollCorrection);

        // In some browsers (e.g. Firefox) fast scrolling may skip rows.
        // In this case, our assumptions about last measured indices may be incorrect.
        // Handle this edge case to prevent NaN values from breaking styles.
        // Slow scrolling back over these skipped rows will adjust their sizes.
        const oldSize = itemSizeMap[itemId] || 0;
        if (oldSize === newSize) {
            return;
        }

        itemSizeMap[itemId] = newSize;

        if (!this.state.scrolledToInitIndex) {
            this.generateOffsetMeasurements();
            return;
        }

        const element = this.outerRef;
        const wasAtBottom = this.props.height + element.scrollTop >= this.listMetaData.totalMeasuredSize - atBottomMargin;

        if ((wasAtBottom || this.keepScrollToBottom) && this.props.correctScrollToBottom) {
            this.generateOffsetMeasurements();
            this.scrollToItem(0, 'end');
            this.forceUpdate();
            return;
        }

        if (forceScrollCorrection || this.keepScrollPosition) {
            const delta = newSize - oldSize;
            const [, , visibleStartIndex] = this.getRangeToRender(this.state.scrollOffset);
            this.generateOffsetMeasurements();
            if (index < visibleStartIndex + 1) {
                return;
            }

            this.scrollCorrectionInProgress = true;

            this.setState(
                (prevState) => {
                    let deltaValue;
                    if (this.mountingCorrections === 0) {
                        deltaValue = delta;
                    } else {
                        deltaValue = prevState.scrollDelta + delta;
                    }
                    this.mountingCorrections++;
                    const newOffset = prevState.scrollOffset + delta;
                    return {
                        scrollOffset: newOffset,
                        scrollDelta: deltaValue,
                    };
                },
                () => {
                    this.correctedInstances++;
                    if (this.mountingCorrections === this.correctedInstances) {
                        this.correctScroll();
                    }
                },
            );
            return;
        }

        this.generateOffsetMeasurements();
    };

    onItemRowUnmount = (itemId, index) => {
        const {props} = this;
        if (props.itemData[index] === itemId) {
            return;
        }
        const doesItemExist = props.itemData.includes(itemId);
        if (!doesItemExist) {
            delete this.listMetaData.itemSizeMap[itemId];
            delete this.listMetaData.itemOffsetMap[itemId];
            const element = this.outerRef;

            const atBottom = element.offsetHeight + element.scrollTop >= this.listMetaData.totalMeasuredSize - atBottomMargin;

            this.generateOffsetMeasurements();

            if (atBottom) {
                this.scrollToItem(0, 'end');
            }

            this.forceUpdate();
        }
    };

    renderItems = () => {
        const {children, itemData, loaderId} = this.props;
        const width = this.innerRefWidth;
        const [startIndex, stopIndex] = this.getRangeToRender();
        const itemCount = itemData.length;
        const items = [];
        if (itemCount > 0) {
            for (let index = itemCount - 1; index >= 0; index--) {
                const {size} = getItemMetadata(this.props, index, this.listMetaData);

                const [localOlderPostsToRenderStartIndex, localOlderPostsToRenderStopIndex] = this.state.localOlderPostsToRender;

                const isItemInLocalPosts = index >= localOlderPostsToRenderStartIndex && index < localOlderPostsToRenderStopIndex + 1 && localOlderPostsToRenderStartIndex === stopIndex + 1;

                const isLoader = itemData[index] === loaderId;
                const itemId = itemData[index];

                // It's important to read style after fetching item metadata.
                // getItemMetadata() will clear stale styles.
                const style = this.getItemStyle(index);
                if ((index >= startIndex && index < stopIndex + 1) || isItemInLocalPosts || isLoader) {
                    const item = createElement(children, {
                        data: itemData,
                        itemId,
                    });

                    // Always wrap children in a ItemMeasurer to detect changes in size.
                    items.push(
                        createElement(ItemMeasurer, {
                            key: itemId,
                            item,
                            itemId,
                            index,
                            height: size,
                            width,
                            onHeightChange: this.handleNewMeasurements,
                            onUnmount: this.onItemRowUnmount,
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

    onScrollVertical = (event) => {
        if (!this.state.scrolledToInitIndex) {
            return;
        }
        const {scrollTop, scrollHeight} = event.currentTarget;
        if (this.scrollCorrectionInProgress) {
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
                scrollDirection: prevState.scrollOffset < scrollTop ? 'forward' : 'backward',
                scrollOffset: scrollTop,
                scrollUpdateWasRequested: false,
                scrollHeight,
                scrollTop,
                scrollDelta: 0,
            };
        });
    };

    outerRefSetter = (ref) => {
        const {outerRef} = this.props;
        this.innerRefWidth = this.props.innerRef.current.clientWidth;
        this.outerRef = ref;

        if (typeof outerRef === 'function') {
            outerRef(ref);
        // eslint-disable-next-line no-prototype-builtins
        } else if (outerRef != null && typeof outerRef === 'object' && outerRef.hasOwnProperty('current')
        ) {
            outerRef.current = ref;
        }
    };

    render() {
        const items = this.renderItems();

        return (
            <div
                id={this.props.id}
                ref={this.outerRefSetter}
                className={classNames('dynamic_virtualized_list', this.props.className)}
                onScroll={this.onScrollVertical}
                style={{
                    WebkitOverflowScrolling: 'touch',
                    overflowY: 'auto',
                    overflowAnchor: 'none',
                    willChange: 'transform',
                    width: '100%',
                    ...this.props.style,
                }}
            >
                <div
                    ref={this.props.innerRef}
                    role='list'
                    style={this.props.innerListStyle}
                >
                    {items}
                </div>
            </div>
        );
    }
}
