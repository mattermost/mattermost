// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ReactElement} from 'react';
import {useState, useCallback, useEffect} from 'react';
import {useSelector} from 'react-redux';

import type {GlobalState} from 'types/store';

export class BatchProcessingError<T = Error> extends Error {
    cause?: {[key: string]: T};
}

export type SectionHook = SectionIO & {
    content: ReactElement;
}

export type SectionIO = {
    save: () => void;
    cancel: () => void;
    loading: boolean;
    saving: boolean;
    saveError: Error | undefined;
    hasChanges: boolean;
    isValid: boolean;
};

export type TLoadingState<TError extends Error> = boolean | TError;

const status = <T extends Error>(state: TLoadingState<T>) => {
    const loading = state === true;
    const error = state instanceof Error ? state : undefined;

    return {loading, error};
};

/**
 * Track loading and error states of an async operation.
 * Error is cleared when setting loading status.
 * @param initialState -
 */
export const useOperationStatus = <T extends Error>(initialState: TLoadingState<T>) => {
    const [state, setState] = useState<TLoadingState<T>>(initialState);
    return [status(state), setState] as const;
};

export type ReadOperations<T> = {
    get: () => Promise<T | undefined>;
    select?: (state: GlobalState) => T | undefined;
    opts?: {forceInitialGet: boolean; initial?: Partial<T>};
}

export interface CollectionIO<T extends {id: string}> {
    create?: (patch?: Partial<T>) => void;
    update?: (item: T) => void;
    delete?: ((item: T) => void) | ((id: T['id']) => void);
    reorder?: (item: T, nextOrder: number) => void;
}

/**
 * Monitored async operation with stateful error and loading status handling.
 * @param initialStatus Provide default loading status. e.g. `true` if operation starts immediately or `false` if manually triggered.
 */
export function useOperation<T, TArgs extends unknown[], TErr extends Error>(op: (...args: TArgs) => T | undefined | Promise<T | undefined>, initialStatus = true) {
    const [status, setStatus] = useOperationStatus<TErr>(initialStatus);

    const doOp = useCallback(async (...args: TArgs) => {
        setStatus(true);
        try {
            const response = await op(...args);
            setStatus(false);
            return response;
        } catch (err) {
            setStatus(err);
            return undefined;
        }
    }, [op]);

    return [doOp, status, setStatus] as const;
}

/**
 * Use current thing from redux selector or async read operation
 * @param ops Read
 * @param ops.get Async operation to retrieve thing if not selected or needs hydration. e.g. a client4 method or dispatched action creator.
 * @param ops.select Redux selector to retrieve thing from the store. Selected thing takes precedence over get-acquired thing.
 * @param initial Provide the initial state of the thing, e.g. placeholder while the get operation is pending.
 * @returns The thing and related meta. Use returned `get` action to forcefully or manually get thing.
 * @remarks Current thing is designed to correspond to the real/saved thing e.g. most recent version of the thing on the server
 */
export function useThing<T>(ops: ReadOperations<T>, initial: T) {
    const forceInitialGet = ops.opts?.forceInitialGet ?? true;
    const selected = useSelector<GlobalState, T | undefined>((state) => ops.select?.(state));
    const [data, setData] = useState<T>(initial);
    const [get, status] = useOperation(ops.get, forceInitialGet || !selected);

    useEffect(() => {
        if (forceInitialGet || !selected) {
            get().then((value) => {
                if (value !== undefined) {
                    setData(value);
                }
            });
        }
    }, [forceInitialGet, selected, get, setData]);

    return [selected ?? data, {...status, get, setData}] as const;
}

/**
 * Use a pending thing to be saved in the future. Designed to be used with a corresponding {@link useThing}.
 * Has built-in patching for simple/flat objects, or add your own layered write operations on top in your custom hook.
 * @param data Current version or "source of truth" version of thing.
 * @param opts.commit Action to save pending thing.
 * @remarks After successfully committing, sync the resulting thing back to the current thing to reconcile or complete or the cycle and clear any diffs.
 */
export function usePendingThing<T extends Record<string, unknown>, TErr extends Error>(
    data: T,
    opts: {
        commit: (pending: T, current: T) => T | Promise<T>;
        beforeUpdate?: (pending: T, current: T) => T;
    },
) {
    const [pending, setPending] = useState(data);
    const hasChanges = pending !== data;

    const [doCommit, {loading: saving, error}, setStatus] = useOperation<T, Parameters<typeof opts.commit>, TErr>(opts.commit, false);

    useEffect(() => {
        setPending(data);
    }, [setPending, data]);

    const apply = useCallback((update: T | ((current: T) => T)) => {
        setPending((currentPending) => {
            const next = typeof update === 'function' ? update(currentPending) : ({...currentPending, ...update});

            if (opts.beforeUpdate) {
                return opts?.beforeUpdate(next, data);
            }

            return next;
        });
    }, [setPending, data, opts.beforeUpdate]);

    const reset = useCallback(() => {
        setPending(data);
        setStatus(false);
    }, [setPending, data, setStatus]);

    const commit = useCallback(() => {
        return doCommit(pending, data);
    }, [doCommit, pending, data]);

    return [pending, {saving, error, hasChanges, apply, commit, reset}] as const;
}
