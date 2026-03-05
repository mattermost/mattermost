// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

type TrackedItemCallback = (changedHeight: number) => void;
type TrackedItemData = {element: Element; callback: TrackedItemCallback};
type TrackedItemsMap = Map<string, TrackedItemData>;

export class ListItemSizeObserver {
    private observer: ResizeObserver;

    private trackedItems: TrackedItemsMap = new Map();

    private static instance: ListItemSizeObserver | null = null;

    private constructor() {
        this.observer = new ResizeObserver(this.handleResizeObserver);
    }

    public static getInstance(): ListItemSizeObserver {
        if (!ListItemSizeObserver.instance) {
            // Following class based singleton pattern to avoid multiple instances of the observer
            ListItemSizeObserver.instance = new ListItemSizeObserver();
        }
        return ListItemSizeObserver.instance;
    }

    private handleResizeObserver = (resizeEntries: ResizeObserverEntry[]) => {
        resizeEntries.forEach((resizeEntry) => {
            const resizedElement = resizeEntry.target;

            let itemData: TrackedItemData | undefined;
            for (const [, trackedItemData] of this.trackedItems.entries()) {
                // Reverse lookup by element to get the item's data
                if (trackedItemData.element === resizedElement) {
                    itemData = trackedItemData;
                    break;
                }
            }

            if (!itemData) {
                return;
            }

            const changedHeight = Math.ceil(resizeEntry.borderBoxSize[0].blockSize);
            itemData.callback(changedHeight);
        });
    };

    public observe(itemId: string, element: Element, callback: TrackedItemCallback): () => void {
        this.trackedItems.set(itemId, {element, callback});
        this.observer.observe(element);

        return () => this.unobserve(itemId);
    }

    private unobserve(itemId: string): void {
        const trackedItemToUnobserve = this.trackedItems.get(itemId);
        if (trackedItemToUnobserve) {
            this.observer.unobserve(trackedItemToUnobserve.element);
            this.trackedItems.delete(itemId);
        }
    }
}

