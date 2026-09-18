// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useEffect, useMemo, useState} from 'react';

import {assignmentFallbackLabels, computeAssignmentPrefetch} from './assignment_prefetch';
import {clearPropertyFieldOptionWalk, pageAllAccessControlFieldOptions} from './page_all_access_control_field_options';
import type {GraphFieldRef} from './page_all_access_control_field_options';

import {joinGraphOptions, type GraphOptionJoin} from '.';

export type GraphNameKind = 'name' | 'id' | 'unavailable';

export type GraphNameLabel = {
    kind: GraphNameKind;
    text: string; // '' when kind === 'unavailable' (caller formats the descriptor)
};

export type UseGraphOptionNamesResult = {
    names: Record<string, string>;
    didResolve: boolean;
    labelForId: (id: string) => GraphNameLabel;
};

type FieldNameCache = {
    names: Record<string, string>;
    didResolve: boolean;
};

const nameCache = new Map<string, FieldNameCache>();

// Fields whose walk failed, so it is not started again. The success guard is
// didResolve, which a failure never sets, and readers re-run their walk on every
// write to this cache -- which the picker performs on each selection. Without
// this a field that cannot be paged is re-walked for the rest of the session.
// Cleared with the field's names, so a property_field_updated retries it once.
const failedWalks = new Set<string>();

const cacheListeners = new Set<() => void>();

// Bumped on clear so a walk started before the clear cannot commit.
const fieldGenerations = new Map<string, number>();

function currentGeneration(fieldId: string): number {
    return fieldGenerations.get(fieldId) ?? 0;
}

function notifyCacheListeners() {
    for (const listener of cacheListeners) {
        listener();
    }
}

export function graphJoinNames(join: GraphOptionJoin): Record<string, string> {
    const names: Record<string, string> = {};
    for (const option of join.byId.values()) {
        if (option.id) {
            names[option.id] = option.name;
        }
    }
    return names;
}

export function commitGraphOptionNames(fieldId: string, names: Record<string, string>): void {
    const prev = nameCache.get(fieldId);
    nameCache.set(fieldId, {
        names: {...prev?.names, ...names},
        didResolve: true,
    });
    notifyCacheListeners();
}

export function clearGraphOptionNameCache(): void {
    nameCache.clear();
    failedWalks.clear();
    fieldGenerations.clear();
    notifyCacheListeners();
}

export function clearGraphOptionNamesForField(fieldId: string): void {
    fieldGenerations.set(fieldId, currentGeneration(fieldId) + 1);
    nameCache.delete(fieldId);
    failedWalks.delete(fieldId);
    clearPropertyFieldOptionWalk(fieldId);
    notifyCacheListeners();
}

export function subscribeGraphOptionNames(listener: () => void): () => void {
    cacheListeners.add(listener);
    return () => {
        cacheListeners.delete(listener);
    };
}

// Stable identity for a cache miss, so a caller memoizing on the result does
// not see a new object every read.
const EMPTY_FIELD_NAMES: FieldNameCache = {names: {}, didResolve: false};

export function getGraphOptionNames(fieldId: string): {names: Record<string, string>; didResolve: boolean} {
    return nameCache.get(fieldId) ?? EMPTY_FIELD_NAMES;
}

async function walkGraphOptionNames(field: GraphFieldRef, ids: readonly string[], signal?: AbortSignal): Promise<void> {
    if (failedWalks.has(field.id) || nameCache.get(field.id)?.didResolve || !computeAssignmentPrefetch(field, [...ids])) {
        return;
    }

    try {
        const generation = currentGeneration(field.id);
        const options = await pageAllAccessControlFieldOptions(field, {signal});
        if (signal?.aborted || currentGeneration(field.id) !== generation) {
            return;
        }

        const join = joinGraphOptions(options);
        commitGraphOptionNames(field.id, graphJoinNames(join));
    } catch (error) {
        // Failed walk does not commit; didResolve stays false. An abort is this
        // caller leaving rather than a walk that cannot succeed, so it is left
        // unrecorded and the next caller may try again.
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
            failedWalks.add(field.id);
        }
    }
}

export function ensureGraphOptionNames(field: GraphFieldRef, ids: readonly string[]): void {
    walkGraphOptionNames(field, ids);
}

export function useGraphOptionNames(
    field: GraphFieldRef,
    ids: readonly string[],
    opts?: {walk?: boolean},
): UseGraphOptionNamesResult {
    const [, setCacheEpoch] = useState(0);

    useEffect(() => {
        const onChange = () => setCacheEpoch((epoch) => epoch + 1);
        cacheListeners.add(onChange);
        return () => {
            cacheListeners.delete(onChange);
        };
    }, []);

    const inline = useMemo(() => assignmentFallbackLabels(field), [field]);
    const cached = nameCache.get(field.id);
    const names = useMemo(
        () => ({...inline, ...cached?.names}),
        [inline, cached?.names],
    );
    const didResolve = Boolean(cached?.didResolve);

    const labelForId = useCallback((id: string): GraphNameLabel => {
        if (names[id]) {
            return {kind: 'name', text: names[id]};
        }
        if (didResolve) {
            return {kind: 'id', text: id};
        }
        return {kind: 'unavailable', text: ''};
    }, [names, didResolve]);

    const walk = Boolean(opts?.walk);
    const idsKey = ids.join('\0');

    useEffect(() => {
        if (!walk) {
            return undefined;
        }

        const controller = new AbortController();
        walkGraphOptionNames(field, ids, controller.signal);

        return () => controller.abort();

        // idsKey stands in for ids so a new array identity does not retrigger.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [walk, didResolve, field, idsKey]);

    return {names, didResolve, labelForId};
}
