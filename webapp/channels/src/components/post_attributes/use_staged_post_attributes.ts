// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useMemo, useState} from 'react';

import {isPropertyValueSet} from 'mattermost-redux/utils/property_utils';

export type ComposerPropertyValue = {field_id: string; value: unknown};

type StagedPostAttributes = {

    // What goes out on `metadata.property_values` when the post is sent. Never
    // holds an empty value: an attribute the user emptied is simply not sent.
    values: ComposerPropertyValue[];

    // Field ids picked from the picker this composing session, so a `when_set`
    // field keeps its chip before it has a value, and after its value is
    // emptied again.
    added: ReadonlySet<string>;

    // The field the picker just added, so its chip opens its control. Cleared
    // on the next edit so a later re-render does not reopen it.
    justAdded: string | null;

    add: (fieldId: string) => void;
    change: (fieldId: string, next: unknown) => void;
    remove: (fieldId: string) => void;
    clear: () => void;
};

const EMPTY_VALUES: ComposerPropertyValue[] = [];
const EMPTY_ADDED: ReadonlySet<string> = new Set();

function withoutField(values: ComposerPropertyValue[], fieldId: string): ComposerPropertyValue[] {
    return values.filter((value) => value.field_id !== fieldId);
}

/**
 * The post attributes staged in the message composer.
 *
 * Lives with the editor rather than inside the chip row because the editor
 * knows when staging ends: when a post is created (a slash command or a
 * reaction empties the message box but keeps these), and when the channel or
 * thread changes. One `clear` resets everything, so the values and their chips
 * cannot fall out of step.
 */
export function useStagedPostAttributes(): StagedPostAttributes {
    const [values, setValues] = useState<ComposerPropertyValue[]>(EMPTY_VALUES);
    const [added, setAdded] = useState<ReadonlySet<string>>(EMPTY_ADDED);
    const [justAdded, setJustAdded] = useState<string | null>(null);

    const add = useCallback((fieldId: string) => {
        setAdded((current) => new Set(current).add(fieldId));
        setJustAdded(fieldId);
    }, []);

    // An emptied value is dropped rather than stored, so the server is never
    // asked to write an empty attribute. The field stays in `added`, which is
    // what keeps its chip on screen for the user to fill in again.
    const change = useCallback((fieldId: string, next: unknown) => {
        setJustAdded(null);
        setValues((current) => {
            const rest = withoutField(current, fieldId);
            return isPropertyValueSet(next) ? [...rest, {field_id: fieldId, value: next}] : rest;
        });
    }, []);

    // Takes the field out of the picked set as well as the values, so a picked
    // field's chip goes away. A `visibility: always` field keeps its chip
    // regardless, which leaves it showing empty — the same as before anything
    // was staged for it.
    const remove = useCallback((fieldId: string) => {
        setJustAdded(null);
        setValues((current) => withoutField(current, fieldId));
        setAdded((current) => {
            if (!current.has(fieldId)) {
                return current;
            }

            const next = new Set(current);
            next.delete(fieldId);
            return next;
        });
    }, []);

    const clear = useCallback(() => {
        setValues(EMPTY_VALUES);
        setAdded(EMPTY_ADDED);
        setJustAdded(null);
    }, []);

    return useMemo(
        () => ({values, added, justAdded, add, change, remove, clear}),
        [values, added, justAdded, add, change, remove, clear],
    );
}
