// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import {Api, expect, lastPost as lastPostOf, postWith, settle, type App} from '@mattermost/playwright-lib';

type Post = ReturnType<App['center']['postList']['post']>;

/** The center channel's most recent post, once the list has one. */
export function lastPost(app: App): Promise<Post> {
    return lastPostOf(app.center.postList);
}

/** Sends a message from the center composer, and returns the new post once it shows. */
export async function sendMessage(app: App, message: string): Promise<Post> {
    await app.center.postCreate.message.container.fill(message);
    await settle(app.center.postCreate.sendButton, {wait: Api.CreatePost}).click();
    return postWith(app.center.postList, {text: message});
}

/** The link (`markdown.link--link`) a post's message holds, once it shows with target `href`. */
export async function linkIn(app: App, post: ReturnType<App['center']['postList']['post']>, href: string) {
    const link = post.markdown.linkLink;
    await expect(link).toHaveAttribute('href', href);
    return link;
}

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
                // The init script runs in the page before the app loads, where page objects do not exist, so the
                // scroller and the new-messages separator (`center.post_list.scroller`, `center.post_list.new_messages`)
                // are found by their test ids.
                // eslint-disable-next-line test-surface/e2e-no-literal-locators -- in-page init script cannot use page objects
                const scrollerSelector = `[data-channel-id="${channelId}"] [data-testid="center.post_list.scroller"]`;
                // eslint-disable-next-line test-surface/e2e-no-literal-locators -- in-page init script cannot use page objects
                const container = document.querySelector(scrollerSelector);

                if (container) {
                    const containerRect = container.getBoundingClientRect();
                    const distanceFromBottom = container.scrollHeight - container.clientHeight - container.scrollTop;

                    // eslint-disable-next-line test-surface/e2e-no-literal-locators -- in-page init script cannot use page objects
                    const separator = document.querySelector('[data-testid="center.post_list.new_messages"]');
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
                {intervals: [100, 200, 300]},
            )
            .toBe(true);

        return getObservations();
    };

    return {reset, waitForObservations};
}
