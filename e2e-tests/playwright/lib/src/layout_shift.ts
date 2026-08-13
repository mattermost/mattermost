// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

export type SizeObservation = {width: number; height: number; at: number};
export type SizeWatcher = {
    /** Callback to clean up and remove the SizeWatcher */
    cleanup: () => Promise<void>;
    /** Returns an array of all height observations made since the last time the page loaded. */
    getObservations: () => Promise<SizeObservation[]>;
    /** Callback that returns true if the watched element has been found. */
    isWatchingElement: () => Promise<boolean>;
};

/**
 * Registers and returns an object that can be used to observe how the height of an element changes over its lifetime
 * The watcher persists through navigation and can be registered before the page loads, but the list of observed
 * heights will be reset when that happens.
 */
export async function watchElementSize(page: Page, elementId: string): Promise<SizeWatcher> {
    const selector = `#${elementId}`;
    const watcherKey = `watchElementSize-${elementId}`;

    type SizeWatcherInternal = {
        element?: Element;
        observations: SizeObservation[];
        mutationObserver?: MutationObserver;
        resizeObserver?: ResizeObserver;
    };

    const disposeWatcher = await page.addInitScript(
        ([selector, watcherKey]) => {
            const sizeWatcher: SizeWatcherInternal = {
                observations: [],
            };
            (window as any)[watcherKey] = sizeWatcher;

            const attachResizeObserver = (el: Element) => {
                sizeWatcher.element = el;

                const resizeObserver = new ResizeObserver((entries) => {
                    for (const e of entries) {
                        const width = e.borderBoxSize[0].inlineSize;
                        const height = e.borderBoxSize[0].blockSize;

                        sizeWatcher.observations.push({width, height, at: performance.now()});
                    }
                });

                resizeObserver.observe(el);
                sizeWatcher.resizeObserver = resizeObserver;
            };

            const existingEl = document.querySelector(selector);
            if (existingEl) {
                attachResizeObserver(existingEl);
            } else {
                const mutationObserver = new MutationObserver(() => {
                    const el = document.querySelector(selector);
                    if (!el || sizeWatcher.element) {
                        return;
                    }

                    attachResizeObserver(el);

                    mutationObserver.disconnect();
                    sizeWatcher.mutationObserver = undefined;
                });

                mutationObserver.observe(document, {childList: true, subtree: true});
                sizeWatcher.mutationObserver = mutationObserver;
            }
        },
        [selector, watcherKey],
    );

    const cleanupWatcher = async () => {
        await page.evaluate((watcherKey) => {
            const sizeWatcher: SizeWatcherInternal = (window as any)[watcherKey];

            sizeWatcher.element = undefined;
            sizeWatcher.mutationObserver?.disconnect();
            sizeWatcher.mutationObserver = undefined;
            sizeWatcher.resizeObserver?.disconnect();
            sizeWatcher.resizeObserver = undefined;
        }, watcherKey);

        await disposeWatcher.dispose();
    };

    const getObservations = async () => {
        return page.evaluate((watcherKey) => {
            const sizeWatcher: SizeWatcherInternal = (window as any)[watcherKey];

            return sizeWatcher.observations;
        }, watcherKey);
    };

    const isWatchingElement = async () => {
        return page.evaluate((watcherKey) => {
            const sizeWatcher: SizeWatcherInternal = (window as any)[watcherKey];

            return Boolean(sizeWatcher.element);
        }, watcherKey);
    };

    return {
        cleanup: cleanupWatcher,
        getObservations,
        isWatchingElement,
    };
}
