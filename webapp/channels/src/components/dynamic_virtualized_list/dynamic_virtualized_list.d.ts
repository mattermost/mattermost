// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

declare module 'components/dynamic_virtualized_list' {
    export type InitialScrollIndex = {
        index: number;
        position: 'start' | 'center' | 'end';
        offset?: number;
    }

    export type OnScrollArgs = {
        scrollDirection: 'backward' | 'forward';
        scrollOffset: number;
        scrollUpdateWasRequested: boolean;
        clientHeight: number;
        scrollHeight: number;
    }

    export type OnItemsRenderedArgs = {
        overscanStartIndex: number;
        overscanStopIndex: number;
        visibleStartIndex: number;
        visibleStopIndex: number;
    }

    export interface DynamicVirtualizedChildProps<ItemType> {
        data: ItemType[];
        itemId: ItemType;
    }

    interface DynamicVirtualizedListProps<ItemType> {
        canLoadMorePosts: (id: 'BEFORE_ID' | 'AFTER_ID' | undefined) => Promise<void>;
        children: (childProps: DynamicVirtualizedChildProps) => JSX.Element;
        height: number;
        initRangeToRender: number[];
        initScrollToIndex: () => InitialScrollIndex;
        initialScrollOffset?: number;
        innerRef: React.Ref<any>;
        itemData: ItemType[];
        onItemsRendered: (args: OnItemsRenderedArgs) => void;
        onScroll: (scrollArgs: OnScrollArgs) => void;
        overscanCountBackward: number;
        overscanCountForward: number;
        scrollToFailed?: (index: number) => void;
        style: CSSProperties;
        width: number;

        id?: string;
        className?: string;
        correctScrollToBottom?: boolean;
        innerListStyle?: CSSProperties;
        loaderId?: string;
    }

    export class DynamicVirtualizedList extends React.PureComponent<DynamicVirtualizedListProps> {
        scrollTo(scrollOffset: number, scrollByValue?: number, useAnimationFrame?: boolean): void;
        scrollToItem(index: number, align: string, offset?: number): void;
        _getRangeToRender(): number[];
    }
}
