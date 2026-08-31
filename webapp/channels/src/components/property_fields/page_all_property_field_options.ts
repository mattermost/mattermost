// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';

// Graph fields the pickers read live in the access_control property group. The
// identity of a GET is this group plus the field's own object_type and id --
// never linked_field_id, which only pairs a field with the template it copied.
export const ACCESS_CONTROL_GROUP = 'access_control';

// The largest page the options endpoint serves. The endpoint's own default is
// 60, so omitting it would page a hierarchy 60 options at a time.
export const PROPERTY_FIELD_OPTIONS_PER_PAGE = 200;

export type PageAllField = {
    id?: string;
    object_type?: string;
};

export type PageAllPropertyFieldOptionsOpts = {
    signal?: AbortSignal;
};

// One walk per field id, so two mounts of the same field share a single pass
// over the keyset instead of racing each other through it. Entries are removed
// when a walk settles: nothing here is a result cache, and a failed walk must
// not stand in the way of the retry that follows it.
const inFlightWalks = new Map<string, Promise<PropertyFieldOption[]>>();

async function walkPages(fieldId: string, objectType: string): Promise<PropertyFieldOption[]> {
    const all: PropertyFieldOption[] = [];
    let cursorId: string | undefined;
    let cursorCreateAt: number | undefined;

    for (;;) {
        const page = await Client4.getPropertyFieldOptions( // eslint-disable-line no-await-in-loop
            ACCESS_CONTROL_GROUP,
            objectType,
            fieldId,
            {perPage: PROPERTY_FIELD_OPTIONS_PER_PAGE, cursorId, cursorCreateAt},
        );

        all.push(...page);

        if (page.length === 0 || page.length < PROPERTY_FIELD_OPTIONS_PER_PAGE) {
            return all;
        }

        const last = page[page.length - 1];

        // A cursor is both halves or neither: the server refuses half of one, and
        // a create_at of zero is indistinguishable from an absent one both on the
        // wire and to that check. Stop rather than ask for the first page again.
        if (!last.id || !last.create_at) {
            throw new Error(
                `pageAllPropertyFieldOptions: option ${last.id || '(no id)'} of field ${fieldId} has no create_at, so the page after it cannot be asked for`,
            );
        }

        cursorId = last.id;
        cursorCreateAt = last.create_at;
    }
}

function sharedWalk(fieldId: string, objectType: string): Promise<PropertyFieldOption[]> {
    const existing = inFlightWalks.get(fieldId);
    if (existing) {
        return existing;
    }

    // Identity-guarded so a walk settling after the map has moved on cannot evict
    // whatever replaced it.
    const tracked = walkPages(fieldId, objectType).finally(() => {
        if (inFlightWalks.get(fieldId) === tracked) {
            inFlightWalks.delete(fieldId);
        }
    });

    inFlightWalks.set(fieldId, tracked);
    return tracked;
}

/**
 * Every option of a property field, read through the whole keyset in one pass.
 *
 * Resolves only once the walk is complete: a partial hierarchy is not a smaller
 * hierarchy, it is a wrong one, so there is nothing useful to hand back early.
 *
 * Concurrent callers for the same field id share one walk. `opts.signal` cancels
 * the caller, not that shared walk -- an aborted caller rejects with an
 * AbortError and never sees an array, while every other caller of the same walk
 * carries on untouched.
 */
export function pageAllPropertyFieldOptions(
    field: PageAllField,
    opts?: PageAllPropertyFieldOptionsOpts,
): Promise<PropertyFieldOption[]> {
    // A field mounted by a plugin may carry neither, and there is no request to
    // make without both. Answered ahead of the signal: this is the complete
    // answer rather than an abandoned one.
    if (!field.id || !field.object_type) {
        return Promise.resolve([]);
    }

    const walk = sharedWalk(field.id, field.object_type);
    const signal = opts?.signal;
    if (!signal) {
        return walk;
    }

    return new Promise<PropertyFieldOption[]>((resolve, reject) => {
        let settled = false;

        const onAbort = () => {
            if (settled) {
                return;
            }
            settled = true;
            reject(new DOMException('pageAllPropertyFieldOptions aborted', 'AbortError'));
        };

        // Attached before the aborted check below so the shared walk always has a
        // rejection handler, including for a caller that arrives already aborted.
        walk.then(
            (options) => {
                if (settled) {
                    return;
                }
                settled = true;
                signal.removeEventListener('abort', onAbort);
                resolve(options);
            },
            (error) => {
                if (settled) {
                    return;
                }
                settled = true;
                signal.removeEventListener('abort', onAbort);
                reject(error);
            },
        );

        if (signal.aborted) {
            onAbort();
            return;
        }

        signal.addEventListener('abort', onAbort, {once: true});
    });
}

/**
 * Drops every in-flight walk. A test seam: the map is module state and Jest keeps
 * one module instance for a whole test file. Production code must not call this.
 */
export function clearPropertyFieldOptionWalks(): void {
    inFlightWalks.clear();
}
