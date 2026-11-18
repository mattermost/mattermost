// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, lastPost, type App, type KeyedList} from '@mattermost/playwright-lib';

/**
 * Posts with mm_blocks on the generated page objects. A post's blocks are `<post>.blocks`, an action button
 * `<post>.action:<action_id>--button`, a select `<post>.select:<action_id>` (its input and suggestions inside), and a
 * collapsible `<post>.collapsible` (its toggle and content).
 */

export type CenterPost = ReturnType<App['center']['postList']['post']>;
export type ThreadPost = ReturnType<App['rhs']['thread']['post']>;

async function latestMatching<Item extends {container: {locator: {innerText(): Promise<string>}}}>(
    list: KeyedList<string, Item>,
    text: string | RegExp,
): Promise<Item> {
    let found: string | undefined;
    await expect
        .poll(async () => {
            for (const key of (await list.keys()).reverse()) {
                // The whole post: block text is not inside the message text.
                const message = await list.item(key).container.locator.innerText();
                if (
                    typeof text === 'string'
                        ? message.includes(text)
                        : new RegExp(text.source, text.flags).test(message)
                ) {
                    found = key;
                    return true;
                }
            }
            return false;
        })
        .toBe(true);
    if (found === undefined) {
        throw new Error(`No post containing ${String(text)}`);
    }
    return list.item(found);
}

/** The center channel's most recent post, once it shows. */
export async function lastCenterPost(app: App): Promise<CenterPost> {
    const post = await lastPost(app.center.postList);
    await expect(post).toBeVisible();
    return post;
}

/** The most recent center post whose text contains `text`, once it shows. */
export async function centerPostContaining(app: App, text: string | RegExp): Promise<CenterPost> {
    return latestMatching(app.center.postList.postList, text);
}

/** Opens a center post's thread from its Reply button, and waits for the thread to show. */
export async function openThread(app: App, post: CenterPost) {
    await post.container.hover();
    await post.menu.replyButton.click();
    await expect(app.rhs.postCreate).toBeVisible();
    await expect.poll(async () => (await app.rhs.thread.postList.keys()).length).toBeGreaterThan(0);
}

/** The most recent thread post whose text contains `text`, once it shows. */
export async function threadPostContaining(app: App, text: string | RegExp): Promise<ThreadPost> {
    return latestMatching(app.rhs.thread.postList, text);
}
