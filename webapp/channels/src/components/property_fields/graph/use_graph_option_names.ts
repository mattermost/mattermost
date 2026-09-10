// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useEffect, useMemo, useState} from 'react';

import {joinGraphOptions} from '../graph_option_tree';
import {pageAllAccessControlFieldOptions} from '../page_all_property_field_options';
import type {GraphFieldRef} from '../page_all_property_field_options';

import {assignmentFallbackLabels, computeAssignmentPrefetch} from './assignment_prefetch';

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
const cacheListeners = new Set<() => void>();

function notifyCacheListeners() {
    for (const listener of cacheListeners) {
        listener();
    }
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
    notifyCacheListeners();
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
        if (!walk || didResolve || !computeAssignmentPrefetch(field, [...ids])) {
            return undefined;
        }

        const controller = new AbortController();

        (async () => {
            try {
                const options = await pageAllAccessControlFieldOptions(
                    {id: field.id, object_type: field.object_type},
                    {signal: controller.signal},
                );
                if (controller.signal.aborted) {
                    return;
                }

                const join = joinGraphOptions(options);
                const resolved: Record<string, string> = {};
                for (const id of ids) {
                    const name = join.byId.get(id)?.name;
                    if (name) {
                        resolved[id] = name;
                    }
                }
                commitGraphOptionNames(field.id, resolved);
            } catch {
                // Failed walk does not commit; didResolve stays false.
            }
        })();

        return () => controller.abort();

        // idsKey stands in for ids so a new array identity does not retrigger.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [walk, didResolve, field, idsKey]);

    return {names, didResolve, labelForId};
}
