// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import groupBy from 'lodash/groupBy';
import isEmpty from 'lodash/isEmpty';
import {useCallback, useMemo} from 'react';

import type {ClientError} from '@mattermost/client';
import {isStatusOK} from '@mattermost/types/client4';
import type {UserPropertyField, UserPropertyFieldPatch} from '@mattermost/types/properties';
import {collectionAddItem, collectionFromArray, collectionRemoveItem, collectionReplaceItem, collectionToArray} from '@mattermost/types/utilities';
import type {PartialExcept, IDMappedCollection} from '@mattermost/types/utilities';

import {Client4} from 'mattermost-redux/client';

import {generateId} from 'utils/utils';

import type {CollectionIO} from './section_utils';
import {useThing, usePendingThing, BatchProcessingError} from './section_utils';

export type UserPropertyFields = IDMappedCollection<UserPropertyField>;

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
    const commit = useCallback(async (collection: UserPropertyFields, prevCollection: UserPropertyFields) => {
        const process = collectionToArray(collection).filter((field) => {
            // process changed fields
            return field !== prevCollection.data[field.id];
        });

        // prepare operations - create, delete, update
        const fieldResults = await Promise.allSettled(process.map((item) => {
            const {id, name, type} = item;
            const patch: UserPropertyFieldPatch = {name, type};

            if (isCreatePending(item)) {
                return Client4.createCustomProfileAttributeField(patch);
            } else if (isDeletePending(item)) {
                return Client4.deleteCustomProfileAttributeField(id);
            }

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

        if (isEmpty(processedCollection.errors)) {
            Reflect.deleteProperty(processedCollection, 'errors');
        } else {
            // set pendingIO master error
            throw new BatchProcessingError<ClientError>('error processing operations', {cause: processedCollection.errors});
        }

        return processedCollection;
    }, []);

    // pending fields to be saved
    const [pendingCollection, pendingIO] = usePendingThing<UserPropertyFields, BatchProcessingError<ClientError>>(fieldCollection, {commit});

    // edit pending fields before saving
    const itemOps = useMemo(() => ({
        update: (field) => {
            pendingIO.apply((pending) => {
                return validate(collectionReplaceItem(pending, field));
            });
        },
        create: () => {
            pendingIO.apply((pending) => {
                const name = getIncrementedName('Text', pending);
                const field = newPendingField({name, type: 'text'});
                return collectionAddItem(pending, field);
            });
        },
        delete: (id: string) => {
            pendingIO.apply((pending) => {
                const field = pending.data[id];

                if (isCreatePending(field)) {
                    // immediately remove if deleting a field that is pending creation
                    return validate(collectionRemoveItem(pending, field));
                }

                return validate(collectionReplaceItem(pending, {...field, delete_at: Date.now()}));
            });
        },
    } satisfies CollectionIO<UserPropertyField>), [pendingIO.apply]);

    return [pendingCollection, readIO, pendingIO, itemOps] as const;
};

const validate = (pending: UserPropertyFields) => {
    // Name
    const byName = groupBy(pending.data, 'name');

    const warnings = Object.values(pending.data).reduce<NonNullable<UserPropertyFields['warnings']>>((acc, field) => {
        if (!field.name) {
            acc[field.id] = {name: ValidationWarningNameRequired};
        } else if (byName[field.name].length > 1) {
            acc[field.id] = {name: ValidationWarningNameUnique};
        }

        return acc;
    }, {});

    const next = {...pending, warnings};

    if (isEmpty(warnings)) {
        Reflect.deleteProperty(next, 'warnings');
    }

    return next;
};

export const ValidationWarningNameRequired = 'user_properties.validation.name_required';
export const ValidationWarningNameUnique = 'user_properties.validation.name_unique';

const getIncrementedName = (desiredName: string, collection: UserPropertyFields) => {
    const names = new Set(Object.values(collection.data).map(({name}) => name));
    let newName = desiredName;
    let n = 1;
    while (names.has(newName)) {
        n++;
        newName = `${desiredName} ${n}`;
    }
    return newName;
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
