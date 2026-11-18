// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ContentFilter, KeyedList} from '@/aria/scope';
import type {Message} from '@/aria/msg';

/** A generated list of posts (the center channel's, the RHS thread's, search results): its post items by id. */
export type PostList<Item> = {
    post(post: {id: string}): Item;
    readonly postList: KeyedList<string, Item>;
};

/** A post list as a `KeyedList`, for the list matchers: `await expect(postsOf(app.center.postList)).toHaveKeyCount(3)`. */
export function postsOf<Item>(list: PostList<Item>): KeyedList<string, Item> {
    return list.postList;
}

/** The list's last post, once it shows at least one: `const post = await lastPost(app.center.postList)`. */
export function lastPost<Item>(list: PostList<Item>, opts?: {timeout?: number}): Promise<Item> {
    return postsOf(list).last(opts);
}

/**
 * The one post with this content, once exactly one shows: `await postWith(app.center.postList, {text: 'hello'})`,
 * or by catalog message, `{message: Msg.…, values}`.
 */
export function postWith<Item, M extends Message<any>>(
    list: PostList<Item>,
    filter: ContentFilter<M>,
    opts?: {timeout?: number},
): Promise<Item> {
    return postsOf(list).itemWith(filter, opts);
}
