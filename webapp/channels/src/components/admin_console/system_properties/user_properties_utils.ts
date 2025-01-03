// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useEffect, useMemo, useState} from 'react';
import {useSelector} from 'react-redux';

import type {ClientError} from '@mattermost/client';
import {isStatusOK} from '@mattermost/types/client4';
import type {UserPropertyField, UserPropertyFieldPatch} from '@mattermost/types/properties';
import {collectionFromArray, collectionToArray, type RelationOneToOne, type IDMappedCollection} from '@mattermost/types/utilities';

import {Client4} from 'mattermost-redux/client';

import {generateId} from 'utils/utils';

import type {GlobalState} from 'types/store';

type UserPropertyFields = IDMappedCollection<UserPropertyField>;

export const useUserPropertyFields = () => {
    const [fieldCollection, readIO] = useThing<UserPropertyFields>(useMemo(() => ({
        get: async () => {
            const data = await Client4.getCustomProfileAttributeFields();
            return collectionFromArray(data);
        },
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        select: (state) => {
            return undefined;
        },
        opts: {forceInitialGet: true},
    }), []), collectionFromArray([] as UserPropertyField[]));

    const [pending, pendingIO] = usePendingCollection(fieldCollection, {
        update: async (collection, prevCollection) => {
            const process = collectionToArray(collection).filter((field) => {
                // process changed fields - create, delete, update
                return field !== prevCollection.data[field.id];
            });

            // prepare operations
            const fieldResults = await Promise.allSettled(process.map((item) => {
                const {id, name} = item;
                const patch: UserPropertyFieldPatch = {name, type: 'text'};

                if (isCreatePending(item)) {
                    // prepare:create
                    return Client4.createCustomProfileAttributeField(patch);
                } else if (isDeletePending(item)) {
                    // prepare:delete
                    return Client4.deleteCustomProfileAttributeField(id);
                }

                // prepare:update
                return Client4.patchCustomProfileAttributeField(id, patch);
            }));

            // process operation results
            const processedCollection = fieldResults.reduce((results, op, i) => {
                const preparedItem = process[i];

                if (op.status === 'fulfilled') {
                    if (isStatusOK(op.value)) {
                        // process:data:deleted
                        Reflect.deleteProperty(results.data, preparedItem.id);

                        // process:order:deleted
                        results.order = results.order.filter((id) => id !== preparedItem.id);
                    } else {
                        const item = op.value;

                        // process:data:created, process:data:updated (set new data)
                        results.data[item?.id] = item;

                        if (item.id !== preparedItem.id) {
                            // process:order:deleted (delete old data)
                            Reflect.deleteProperty(results.data, preparedItem.id);

                            // process:order:created (replace pending id with created id)
                            results.order = results.order.map((id) => (id === preparedItem?.id ? item.id : id));
                        }
                    }
                } else if (op.status === 'rejected') {
                    // failed, log error
                    results.errors[preparedItem.id] = op.reason;
                }

                return results;
            }, {
                data: {...collection.data},
                order: [...collection.order],
                errors: {} as RelationOneToOne<UserPropertyField, Error>,
            });

            if (Object.keys(processedCollection.errors).length) {
                // set pendingIO master error
                throw new Error('error processing operations', {cause: processedCollection.errors});
            } else {
                Reflect.deleteProperty(processedCollection, 'errors');
            }

            return processedCollection;
        },
    });

    return [pending, readIO, pendingIO] as const;
};

export type TLoadingState<TError extends Error = ClientError> = boolean | TError;

const status = <T extends Error>(state: TLoadingState<T>) => {
    const loading = state === true;
    const error = state instanceof Error ? state : undefined;

    return {loading, error};
};

const useOperationStatus = <T extends Error>(initialState: TLoadingState<T> = true) => {
    const [state, setState] = useState<TLoadingState>(initialState);
    return [status(state), setState] as const;
};

export type ReadOperations<T> = {
    get: () => Promise<T | undefined>;
    select?: (state: GlobalState) => T | undefined;
    opts?: {forceInitialGet: boolean; initial?: Partial<T>};
}

export type WriteOperations<T extends Record<string, unknown>, R = T, P = Partial<T>> = {
    update: (next: T, prev: T) => R | Promise<R>;
    patch: (patch: P, current: T) => R | Promise<R>;
    delete: (id: string) => boolean | Promise<boolean>;
}

export type ReadWriteOperations<R, W extends Record<string, unknown>> = ReadOperations<R> & WriteOperations<W, R>;

/**
 * Monitored async operation with stateful error and loading status handling.
 */
export function useOperation<T, TArgs extends unknown[] = any>(op: (...args: TArgs) => T | undefined | Promise<T | undefined>, initialStatus = true) {
    const [status, setStatus] = useOperationStatus(initialStatus);

    const doOp = useCallback(async (...args: TArgs) => {
        setStatus(true);
        try {
            const data = await op(...args);
            setStatus(false);
            return data;
        } catch (err) {
            setStatus(err);
            return undefined;
        }
    }, [op]);

    return [doOp, status] as const;
}

/**
 * Use thing from redux selector or async operation
 */
export function useThing<T>(ops: ReadOperations<T>, initial: T) {
    const selected = useSelector<GlobalState, T | undefined>((state) => ops.select?.(state));
    const [data, setData] = useState<typeof initial>(initial);
    const [get, status] = useOperation(ops.get);

    useEffect(() => {
        if ((ops.opts?.forceInitialGet ?? true) || !selected) {
            get().then((value) => {
                if (value !== undefined) {
                    setData(value);
                }
            });
        }
    }, [selected, get, ops.opts?.forceInitialGet]);

    return [selected ?? data, {...status, get, setData}] as const;
}

export function usePendingCollection<T extends Record<string, unknown>>(data: T, ops: Pick<WriteOperations<T>, 'update'>) {
    const [pending, setPending] = useState(data);
    const hasChanges = pending !== data;

    useEffect(() => {
        setPending(data);
    }, [data]);

    const apply = (update: T | ((current: T) => T)) => {
        setPending((current) => (typeof update === 'function' ? update(current) : ({...current, ...update})));
    };

    const reset = () => setPending(data);

    const [save, {loading: saving, error}] = useOperation(ops.update, false);

    const commit = () => {
        return save(pending, data);
    };

    return [pending, {saving, error, hasChanges, apply, commit, reset}] as const;
}

const PENDING = 'pending_';
export const isCreatePending = <T extends {id: string; delete_at: number; create_at: number}>(item: T) => {
    // has not been created, is not deleted
    return item.create_at === 0 && item.delete_at === 0;
};

export const isDeletePending = <T extends {delete_at: number; create_at: number}>(item: T) => {
    // has been created, and needs to be deleted
    return item.create_at !== 0 && item.delete_at !== 0;
};

export const newPendingId = () => `${PENDING}${generateId()}`;

export const newPendingField = (): UserPropertyField => {
    return {
        id: newPendingId(),
        name: '',
        type: 'text',
        create_at: 0,
        delete_at: 0,
        update_at: 0,
    };
};

