// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

type TrackedItemCallback = (changedHeight: number) => void;

type TrackedItemsMap = Map<string, {element: Element; callback: TrackedItemCallback}>;

export class ListItemSizeObserver {
    private observer: ResizeObserver;

    private trackedItems: TrackedItemsMap = new Map();
    private elementToIdLookup: WeakMap<Element, string> = new WeakMap();

    constructor() {
        this.observer = new ResizeObserver(this.handleResizeObserver);
    }

    private handleResizeObserver = (resizeEntries: ResizeObserverEntry[]) => {
        resizeEntries.forEach((resizeEntry) => {
            const resizedElement = resizeEntry.target;
            const itemId = this.elementToIdLookup.get(resizedElement);

            if (!itemId) {
                return;
            }

            const item = this.trackedItems.get(itemId);
            if (!item) {
                return;
            }

            const changedHeight = Math.ceil(resizeEntry.borderBoxSize[0].blockSize);
            item.callback(changedHeight);
        });
    };

    observe(itemId: string, element: Element, callback: TrackedItemCallback): void {
        this.trackedItems.set(itemId, {element, callback});
        this.elementToIdLookup.set(element, itemId);
        this.observer.observe(element);
    }

    unobserve(itemId: string): void {
        const trackedItem = this.trackedItems.get(itemId);
        if (trackedItem) {
            this.observer.unobserve(trackedItem.element);
            this.trackedItems.delete(itemId);
            this.elementToIdLookup.delete(trackedItem.element);
        }
    }

    disconnect(): void {
        this.observer.disconnect();
        this.trackedItems.clear();
        this.elementToIdLookup = new WeakMap();
    }
}

