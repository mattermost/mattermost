// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';

// GET identity is this group plus the field's object_type and id, never linked_field_id.
export const ACCESS_CONTROL_GROUP = 'access_control';

// Endpoint default is 60; omit this and a hierarchy pages 60 at a time.
export const PROPERTY_FIELD_OPTIONS_PER_PAGE = 200;

export type PageAllField = {
    id?: string;
    object_type?: string;
};

export type PageAllPropertyFieldOptionsOpts = {
    signal?: AbortSignal;
};

// In-flight walks only: two mounts share one pass. Settled entries are removed so
// a failed walk cannot block the retry. Keyed on object_type + id so a malformed
// field cannot join another field's walk.
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

        // Short page is last (including 200 []). A full page means there may be more.
        if (page.length < PROPERTY_FIELD_OPTIONS_PER_PAGE) {
            return all;
        }

        const last = page[page.length - 1];

        // Cursor is both halves or neither; a missing half would re-request page 1.
        if (!last.id || !last.create_at) {
            const missingHalf = last.id ? 'create_at' : 'id';
            throw new Error(
                `pageAllPropertyFieldOptions: option ${last.id || '(no id)'} of field ${fieldId} has no ${missingHalf}, so the page after it cannot be asked for`,
            );
        }

        cursorId = last.id;
        cursorCreateAt = last.create_at;
    }
}

function sharedWalk(fieldId: string, objectType: string): Promise<PropertyFieldOption[]> {
    const key = `${objectType}:${fieldId}`;

    const existing = inFlightWalks.get(key);
    if (existing) {
        return existing;
    }

    const tracked = walkPages(fieldId, objectType).finally(() => {
        if (inFlightWalks.get(key) === tracked) {
            inFlightWalks.delete(key);
        }
    });

    inFlightWalks.set(key, tracked);
    return tracked;
}

/**
 * Pages every option of a field. Concurrent callers share one walk; `opts.signal`
 * cancels only this caller.
 */
export function pageAllPropertyFieldOptions(
    field: PageAllField,
    opts?: PageAllPropertyFieldOptionsOpts,
): Promise<PropertyFieldOption[]> {
    if (!field.id || !field.object_type) {
        return Promise.resolve([]);
    }

    // Start the walk before reading signal.aborted so an already-aborted caller
    // still attaches a rejection handler (avoids an unhandled 403/404).
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
