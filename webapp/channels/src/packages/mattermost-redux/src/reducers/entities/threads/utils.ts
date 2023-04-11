// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GenericAction} from 'mattermost-redux/types/actions';
import type {IDMappedObjects, RelationOneToMany} from '@mattermost/types/utilities';
import type {UserThread} from '@mattermost/types/threads';

import type {ExtraData} from './types';

type State = RelationOneToMany<{id: string}, UserThread>;

// return true only if it's 'newer' than other threads
// older threads will be added by scrolling so no need to manually add.
// furthermore manually adding older thread will BREAK pagination
export function shouldAddThreadId(ids: Array<UserThread['id']>, thread: UserThread, threads: IDMappedObjects<UserThread>) {
    return ids.some((id) => {
        const t = threads![id];
        return thread.last_reply_at > t.last_reply_at;
    });
}

// adds thread to single team
export function handleReceivedThread<S extends State>(state: S, thread: UserThread, key: string, extra: ExtraData): S {
    const nextSet = new Set(state[key] || []);

    // thread exists in state
    if (nextSet.has(thread.id)) {
        return state;
    }

    // check if thread is newer than any of the existing threads
    const shouldAdd = shouldAddThreadId([...nextSet], thread, extra.threads);

    if (shouldAdd) {
        nextSet.add(thread.id);

        return {
            ...state,
            [key]: [...nextSet],
        };
    }

    return state;
}

export function handlePostRemoved<S extends State>(state: S, action: GenericAction): S {
    const post = action.data;
    if (post.root_id) {
        return state;
    }

    const keys = Object.keys(state).
        filter((id) => state[id].indexOf(post.id) !== -1);

    if (!keys?.length) {
        return state;
    }

    const newState: State = {};

    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const index = state[key].indexOf(post.id);

        newState[key] = [
            ...state[key].slice(0, index),
            ...state[key].slice(index + 1),
        ];
    }

    return {
        ...state,
        ...newState,
    };
}

export function handleReceiveThreads<S extends State>(state: S, action: GenericAction, key: string): S {
    const nextSet = new Set(state[key] || []);

    if (action.data.threads.length === 0) {
        return state;
    }

    action.data.threads.forEach((thread: UserThread) => {
        nextSet.add(thread.id);
    });

    return {
        ...state,
        [key]: [...nextSet],
    };
}

// add the thread only if it's 'newer' than other threads
// older threads will be added by scrolling so no need to manually add.
// furthermore manually adding older thread will BREAK pagination
export function handleFollowChanged<S extends State>(state: S, action: GenericAction, key: string, extra: ExtraData): S {
    const {id, following} = action.data;
    const nextSet = new Set(state[key] || []);

    const thread = extra.threads[id];

    if (!thread) {
        return state;
    }

    // thread exists in state
    if (nextSet.has(id)) {
        // remove it if we unfollowed
        if (!following) {
            nextSet.delete(id);
            return {
                ...state,
                [key]: [...nextSet],
            };
        }
        return state;
    }

    // check if thread is newer than any of the existing threads
    const shouldAdd = shouldAddThreadId([...nextSet], thread, extra.threads);

    if (shouldAdd && following) {
        nextSet.add(thread.id);

        return {
            ...state,
            [key]: [...nextSet],
        };
    }

    return state;
}
