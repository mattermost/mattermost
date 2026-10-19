// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, type Page} from '@playwright/test';

export type ScrollObservation = {
    distanceFromBottom: number | null;
    clientHeight: number | null;
    scrollTop: number | null;
    scrollHeight: number | null;
    containerTop: number | null;
    separatorTop: number | null;
    separatorViewportTop: number | null;
    at: number;
};

export type PostListScrollWatcher = {
    /** Clear recorded observations. */
    reset: () => Promise<void>;
    /** Waits until the scroll position settles before returning all observations. */
    waitForObservations: (quietMs: number) => Promise<ScrollObservation[]>;
};

/**
 * Installs a watcher that records the scroll position of the post list for the given channel.
 */
export async function watchPostListScroll(page: Page, channelId: string): Promise<PostListScrollWatcher> {
    const SCROLL_WATCHER_KEY = 'postListScrollWatcher';

    type WatcherState = {observations: ScrollObservation[]; lastKey: string};

    await page.addInitScript(
        ([key, channelId]) => {
            const state: WatcherState = {observations: [], lastKey: ''};
            (window as unknown as Record<string, WatcherState>)[key] = state;

            const sample = () => {
                const container = document.querySelector(
                    `#postListContent[data-channel-id="${channelId}"] #postListScrollContainer`,
                );

                if (container) {
                    const containerRect = container.getBoundingClientRect();
                    const distanceFromBottom = container.scrollHeight - container.clientHeight - container.scrollTop;

                    const separator = document.querySelector('.NotificationSeparator');
                    const separatorViewportTop = separator ? separator.getBoundingClientRect().top : null;
                    const separatorTop =
                        separator && separatorViewportTop !== null ? separatorViewportTop - containerRect.top : null;

                    const observation = {
                        distanceFromBottom,
                        clientHeight: container.clientHeight,
                        scrollTop: container.scrollTop,
                        scrollHeight: container.scrollHeight,
                        containerTop: containerRect.top,
                        separatorTop,
                        separatorViewportTop,
                        at: performance.now(),
                    };

                    const dedupeKey = [
                        observation.distanceFromBottom,
                        observation.clientHeight,
                        observation.scrollTop,
                        observation.scrollHeight,
                        observation.containerTop,
                        observation.separatorTop,
                    ].join('|');

                    if (dedupeKey !== state.lastKey) {
                        state.lastKey = dedupeKey;
                        state.observations.push(observation);
                    }
                }

                requestAnimationFrame(sample);
            };

            requestAnimationFrame(sample);
        },
        [SCROLL_WATCHER_KEY, channelId],
    );

    const getObservations = async () => {
        return page.evaluate((key) => {
            const state = (window as unknown as Record<string, WatcherState>)[key];
            return state ? state.observations : [];
        }, SCROLL_WATCHER_KEY);
    };

    const reset = async () => {
        await page.evaluate((key) => {
            const state = (window as unknown as Record<string, WatcherState>)[key];
            if (state) {
                state.observations = [];
                state.lastKey = '';
            }
        }, SCROLL_WATCHER_KEY);
    };

    const waitForObservations = async (quietMs = 750) => {
        await expect
            .poll(
                async () => {
                    const observations = await getObservations();
                    if (observations.length === 0) {
                        return false;
                    }
                    const now = await page.evaluate(() => Math.round(performance.now()));
                    return now - observations[observations.length - 1].at >= quietMs;
                },
                {timeout: 5000, intervals: [100, 200, 300]},
            )
            .toBe(true);

        return getObservations();
    };

    return {reset, waitForObservations};
}
