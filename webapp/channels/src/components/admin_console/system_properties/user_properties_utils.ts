// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useMemo} from 'react';

import {isStatusOK} from '@mattermost/types/client4';
import type {UserPropertyField, UserPropertyFieldPatch} from '@mattermost/types/properties';
import {collectionAddItem, collectionFromArray, collectionRemoveItem, collectionReplaceItem, collectionToArray} from '@mattermost/types/utilities';
import type {PartialExcept, IDMappedCollection} from '@mattermost/types/utilities';

import {Client4} from 'mattermost-redux/client';

import {generateId} from 'utils/utils';

import type {CollectionIO} from './section_utils';
import {useThing, usePendingThing, BatchProcessingError} from './section_utils';

type UserPropertyFields = IDMappedCollection<UserPropertyField>;

export const useUserPropertyFields = () => {
    // current fields
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
    }), []), collectionFromArray([]));

    // save-sync operations
    const onCommit = useCallback(async (collection: UserPropertyFields, prevCollection: UserPropertyFields) => {
        const process = collectionToArray(collection).filter((field) => {
            // process changed fields - create, delete, update
            return field !== prevCollection.data[field.id];
        });

        // prepare operations
        const fieldResults = await Promise.allSettled(process.map((item) => {
            const {id, name, type} = item;
            const patch: UserPropertyFieldPatch = {name, type};

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
        const processedCollection = fieldResults.reduce<UserPropertyFields>((results, op, i) => {
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
                results.errors = {...results.errors, [preparedItem.id]: op.reason};
            }

            return results;
        }, {
            data: {...collection.data},
            order: [...collection.order],
            errors: {}, // start with errors cleared; don't keep stale errors
        });

        if (processedCollection.errors && Object.keys(processedCollection.errors).length) {
            // set pendingIO master error
            throw new BatchProcessingError('error processing operations', {cause: processedCollection.errors});
        } else {
            Reflect.deleteProperty(processedCollection, 'errors');
        }

        return processedCollection;
    }, []);

    // pending fields to be saved
    const [pending, pendingIO] = usePendingThing<UserPropertyFields, BatchProcessingError>(fieldCollection, onCommit);

    // edit pending fields before saving
    const itemOps = useMemo(() => ({
        update: (field) => {
            pendingIO.apply((current) => {
                return collectionReplaceItem(current, field);
            });
        },
        create: () => {
            pendingIO.apply((current) => {
                const field = newPendingField({name: '', type: 'text'});
                return collectionAddItem(current, field);
            });
        },
        delete: (id: string) => {
            pendingIO.apply((current) => {
                const field = current.data[id];

                if (isCreatePending(field)) {
                    // immediately remove if deleting a field that is pending creation
                    return collectionRemoveItem(current, field);
                }

                return collectionReplaceItem(current, {...field, delete_at: Date.now()});
            });
        },
    } satisfies CollectionIO<UserPropertyField>), [pendingIO.apply]);

    return [pending, readIO, pendingIO, itemOps] as const;
};

const PENDING = 'pending_';
export const isCreatePending = <T extends {id: string; delete_at: number; create_at: number}>(item: T) => {
    // has not been created and is not deleted
    return item.create_at === 0 && item.delete_at === 0;
};

export const isDeletePending = <T extends {delete_at: number; create_at: number}>(item: T) => {
    // has been created and needs to be deleted
    return item.create_at !== 0 && item.delete_at !== 0;
};

export const newPendingId = () => `${PENDING}${generateId()}`;

export const newPendingField = (patch: PartialExcept<UserPropertyField, 'name'>): UserPropertyField => {
    return {
        ...patch,
        type: 'text',
        id: newPendingId(),
        create_at: 0,
        delete_at: 0,
        update_at: 0,
    };
};
