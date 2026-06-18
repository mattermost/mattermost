// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import groupBy from 'lodash/groupBy';
import isEmpty from 'lodash/isEmpty';
import {useMemo} from 'react';

import type {ClientError} from '@mattermost/client';
import type {PropertyField, PropertyFieldOption} from '@mattermost/types/properties';
import {supportsOptions} from '@mattermost/types/properties';
import type {BoardsPropertyField, BoardsPropertyFieldPatch} from '@mattermost/types/properties_board';
import {BOARDS_PROPERTY_GROUP_NAME, BOARDS_PROPERTY_OBJECT_TYPE, BOARDS_PROPERTY_TARGET_TYPE} from '@mattermost/types/properties_board';
import {collectionAddItem, collectionFromArray, collectionRemoveItem, collectionReplaceItem, collectionToArray} from '@mattermost/types/utilities';
import type {IDMappedCollection, IDMappedObjects} from '@mattermost/types/utilities';

import {Client4} from 'mattermost-redux/client';
import {insertWithoutDuplicates} from 'mattermost-redux/utils/array_utils';

import {generateId} from 'utils/utils';

import type {CollectionIO, PendingOps} from '../system_properties/section_utils';
import {useThing, usePendingThing, BatchProcessingError} from '../system_properties/section_utils';

export type BoardPropertyFields = IDMappedCollection<BoardsPropertyField>;

// A field can't be edited once it's a protected (system) field or pending deletion.
export const isPropertyDisabled = (field: BoardsPropertyField): boolean =>
    Boolean(field.protected) || field.delete_at !== 0;

// Options are editable only on option-bearing types (supportsOptions already
// excludes user/multiuser) that aren't protected system fields.
export const canEditFieldOptions = (field: BoardsPropertyField): boolean =>
    supportsOptions(field) && !field.protected;

export const useBoardPropertyFields = () => {
    // current fields
    const [fieldCollection, readIO] = useThing<BoardPropertyFields>(useMemo(() => ({
        get: async () => {
            const data = await Client4.getPropertyFields(BOARDS_PROPERTY_GROUP_NAME, BOARDS_PROPERTY_OBJECT_TYPE, BOARDS_PROPERTY_TARGET_TYPE);

            // Protected (system) fields render first, then custom fields ordered by sort_order.
            const sorted = (data as BoardsPropertyField[]).sort((a, b) => {
                if (Boolean(a.protected) !== Boolean(b.protected)) {
                    return a.protected ? -1 : 1;
                }
                return (a.attrs?.sort_order ?? 0) - (b.attrs?.sort_order ?? 0);
            });
            return collectionFromArray(sorted);
        },
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        select: (state) => {
            return undefined;
        },
        opts: {forceInitialGet: true},
    }), []), collectionFromArray([]));

    // pending fields to be saved
    const [pendingCollection, pendingIO] = usePendingThing<BoardPropertyFields, BatchProcessingError<ClientError>>(fieldCollection, useMemo(() => ({
        commit: async (collection: BoardPropertyFields, prevCollection: BoardPropertyFields) => {
            // Invariant: a field that is "created and then deleted" before save
            // never reaches this loop — itemOps.delete short-circuits via
            // collectionRemoveItem when isCreatePending(field), so create_at=0
            // delete_at!=0 combinations don't end up in either op bucket.
            const process = collectionToArray(collection).reduce<PendingOps<BoardsPropertyField>>((ops, item) => {
                // don't process unchanged items
                if (item === prevCollection.data[item.id]) {
                    return ops;
                }

                switch (true) {
                case isCreatePending(item):
                    ops.create.push(item);
                    break;
                case isDeletePending(item):
                    ops.delete.push(item);
                    break;
                case item !== prevCollection.data[item.id]:
                    ops.edit.push(item);
                    break;
                }

                return ops;
            }, {delete: [], edit: [], create: []});

            const next: BoardPropertyFields = {
                data: {...collection.data},
                order: [...collection.order],
                errors: {}, // start with errors cleared; don't keep stale errors
            };

            // delete
            await Promise.all(process.delete.map(async ({id, protected: isProtected}) => {
                if (isProtected) {
                    return undefined;
                }
                return Client4.deletePropertyField(BOARDS_PROPERTY_GROUP_NAME, BOARDS_PROPERTY_OBJECT_TYPE, id).
                    then(() => {
                        // data:deleted
                        Reflect.deleteProperty(next.data, id);

                        // order:deleted
                        next.order = next.order.filter((orderId) => orderId !== id);
                    }).
                    catch((reason: ClientError) => {
                        next.errors = {...next.errors, [id]: reason};
                    });
            }));

            // update
            await Promise.all(process.edit.map(async (pendingItem) => {
                // Protected fields are immutable via the generic property API.
                if (pendingItem.protected) {
                    next.data[pendingItem.id] = prevCollection.data[pendingItem.id];
                    return undefined;
                }

                const {id, name, type, attrs} = pendingItem;
                const patch: BoardsPropertyFieldPatch = {
                    name,
                    type,
                    attrs: stripIrrelevantOptions(stripPendingFromAttrs(attrs), type),
                };

                return Client4.patchPropertyField(BOARDS_PROPERTY_GROUP_NAME, BOARDS_PROPERTY_OBJECT_TYPE, id, patch as Partial<PropertyField> & Record<string, unknown>).
                    then((nextItem) => {
                        // data:updated
                        next.data[id] = nextItem as BoardsPropertyField;
                    }).
                    catch((reason: ClientError) => {
                        next.errors = {...next.errors, [id]: reason};
                    });
            }));

            // create
            await Promise.all(process.create.map(async (pendingItem) => {
                const {id, name, type, attrs} = pendingItem;

                return Client4.createPropertyField(BOARDS_PROPERTY_GROUP_NAME, BOARDS_PROPERTY_OBJECT_TYPE, {
                    name,
                    type,
                    attrs: stripIrrelevantOptions(stripPendingFromAttrs(attrs), type),
                    target_type: BOARDS_PROPERTY_TARGET_TYPE,
                    target_id: '',
                }).
                    then((newItem) => {
                        // data:created (delete pending data)
                        Reflect.deleteProperty(next.data, id);
                        next.data[newItem?.id] = newItem as BoardsPropertyField;

                        // order:created (replace pending id with created id)
                        next.order = next.order.map((orderId) => (orderId === pendingItem?.id ? newItem.id : orderId));
                    }).
                    catch((reason: ClientError) => {
                        next.errors = {...next.errors, [id]: reason};
                    });
            }));

            if (isEmpty(next.errors)) {
                Reflect.deleteProperty(next, 'errors');
            } else {
                // set pendingIO master error
                throw new BatchProcessingError<ClientError>('error processing operations', {cause: next.errors});
            }

            return next;
        },
        beforeUpdate: (pending, current) => {
            const byNamesLower = (data: IDMappedObjects<BoardsPropertyField>) => {
                return groupBy(data, ({name}) => name.toLowerCase());
            };

            // Name
            const pendingByName = byNamesLower(pending.data);
            const currentByName = byNamesLower(current.data);

            const warnings = Object.values(pending.data).reduce<NonNullable<BoardPropertyFields['warnings']>>((acc, field) => {
                // Skip validation for protected fields - they can't be edited
                if (field.protected) {
                    return acc;
                }

                if (!field.name) {
                    // name not provided
                    acc[field.id] = {name: ValidationWarningNameRequired};
                } else if (pendingByName[field.name.toLowerCase()]?.filter((x) => x.delete_at === 0)?.length > 1) {
                    // duplicate pending name
                    acc[field.id] = {name: ValidationWarningNameUnique};
                } else if (
                    currentByName?.[field.name.toLowerCase()]?.length >= 1 &&
                    field.id !== currentByName?.[field.name.toLowerCase()]?.[0]?.id
                ) {
                    // name already in use
                    const correspondingPending = pending.data[currentByName?.[field.name.toLowerCase()]?.[0]?.id];

                    // except when corresponding field is going to be deleted, then it is no longer in conflict
                    if (correspondingPending.delete_at === 0) {
                        // not going to be deleted, so in conflict
                        acc[field.id] = {name: ValidationWarningNameTaken};
                    }
                }

                if (supportsOptions(field)) {
                    const optionWarning = validateSelectOptions(field.attrs?.options);
                    if (optionWarning) {
                        acc[field.id] = {...acc[field.id], ...optionWarning};
                    }
                }

                return acc;
            }, {});

            const next = {...pending, warnings};

            if (isEmpty(warnings)) {
                Reflect.deleteProperty(next, 'warnings');
            }

            return next;
        },
        isEqual: (a, b) => {
            if (a.order.length !== b.order.length) {
                return false;
            }
            if (!a.order.every((id, i) => id === b.order[i])) {
                return false;
            }
            const aKeys = Object.keys(a.data);
            const bKeys = Object.keys(b.data);
            if (aKeys.length !== bKeys.length) {
                return false;
            }
            return aKeys.every((key) => a.data[key] === b.data[key]);
        },

    }), []));

    // edit pending fields before saving
    const itemOps = useMemo(() => ({
        update: (field) => {
            pendingIO.apply((pending) => {
                return collectionReplaceItem(pending, field);
            });
        },
        create: (patch?) => {
            pendingIO.apply((pending) => {
                const nextOrder = Object.values(pending.data).filter((x) => !isDeletePending(x)).length;

                const field = newPendingBoardField({
                    type: 'text',
                    ...patch,
                    name: getIncrementedName(patch?.name ?? 'Text', pending),
                    attrs: {
                        ...patch?.attrs,
                        sort_order: nextOrder,
                    },
                });

                return collectionAddItem(pending, field);
            });
        },
        reorder: ({id}, nextItemOrder) => {
            pendingIO.apply((pending) => {
                const draggedField = pending.data[id];

                // Protected fields cannot be reordered.
                if (draggedField?.protected) {
                    return pending;
                }

                // Protected fields must remain at the top of the list, so a
                // custom field cannot be dropped above any protected sibling.
                const protectedCount = pending.order.filter((oid) => pending.data[oid]?.protected).length;
                const clampedOrder = Math.max(nextItemOrder, protectedCount);

                const nextOrder = insertWithoutDuplicates(pending.order, id, clampedOrder);

                if (nextOrder === pending.order) {
                    return pending;
                }

                const nextItems = Object.values(pending.data).reduce<BoardsPropertyField[]>((changedItems, item) => {
                    // never patch sort_order on protected fields
                    if (item.protected) {
                        return changedItems;
                    }

                    const itemCurrentOrder = item.attrs?.sort_order;
                    const itemNextOrder = nextOrder.indexOf(item.id);

                    if (itemNextOrder !== itemCurrentOrder) {
                        changedItems.push({...item, attrs: {...item.attrs, sort_order: itemNextOrder}});
                    }

                    return changedItems;
                }, []);

                return collectionReplaceItem({...pending, order: nextOrder}, ...nextItems);
            });
        },
        delete: (id: string) => {
            pendingIO.apply((pending) => {
                const field = pending.data[id];

                // skip if protected
                if (field.protected) {
                    return pending;
                }

                if (isCreatePending(field)) {
                    // immediately remove if deleting a field that is pending creation
                    return collectionRemoveItem(pending, field);
                }

                return collectionReplaceItem(pending, {...field, delete_at: Date.now()});
            });
        },
    } satisfies CollectionIO<BoardsPropertyField>), [pendingIO.apply]);

    return [pendingCollection, readIO, pendingIO, itemOps] as const;
};

export const ValidationWarningNameRequired = 'board_attributes.validation.name_required';
export const ValidationWarningNameUnique = 'board_attributes.validation.name_unique';
export const ValidationWarningNameTaken = 'board_attributes.validation.name_taken';
export const ValidationWarningOptionsRequired = 'board_attributes.validation.options_required';
export const ValidationWarningOptionsUnique = 'board_attributes.validation.options_unique';

const normalizeOptionName = (name: string) => name.trim().toLowerCase();

const hasDuplicateOptionNames = (options: PropertyFieldOption[]) => {
    const names = options.map((o) => normalizeOptionName(o.name));
    return new Set(names).size !== names.length;
};

// Cell-level pre-commit check: is `candidate` already taken by some other
// option in `options`? Used for live feedback inside the rename dropdown so
// the user sees the conflict before the edit reaches the collection.
export const isOptionNameTaken = (
    candidate: string,
    options: PropertyFieldOption[],
    excluding?: PropertyFieldOption,
): boolean => {
    const normalized = normalizeOptionName(candidate);
    return options.some((o) => o !== excluding && normalizeOptionName(o.name) === normalized);
};

const validateSelectOptions = (options: PropertyFieldOption[] | undefined): {attrs: string} | undefined => {
    if (!options?.length) {
        return {attrs: ValidationWarningOptionsRequired};
    }
    if (hasDuplicateOptionNames(options)) {
        return {attrs: ValidationWarningOptionsUnique};
    }
    return undefined;
};

// Strip trailing ` (copy)` or ` (N)` suffixes (repeatedly) so that duplicating
// `Text (copy)` yields `Text (2)` and duplicating `Text (2)` yields `Text (3)`,
// not `Text (2) (copy)` / `Text (2) (copy) (copy)`.
const stripDuplicateSuffix = (name: string) => {
    let base = name;
    const suffix = / \((copy|\d+)\)$/;
    while (suffix.test(base)) {
        base = base.replace(suffix, '');
    }
    return base;
};

const getIncrementedName = (desiredName: string, collection: BoardPropertyFields) => {
    const names = new Set(Object.values(collection.data).map(({name}) => name));
    const base = stripDuplicateSuffix(desiredName);

    // If the bare base name is free (e.g. first "+ Add" of this type), use it.
    if (!names.has(base)) {
        return base;
    }

    // Otherwise find the next available "(N)" suffix, starting at 2.
    let n = 2;
    while (names.has(`${base} (${n})`)) {
        n++;
    }
    return `${base} (${n})`;
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

export const isPendingId = (id: string) => id.startsWith(PENDING);

// Pending ids are a frontend-only convention so unsaved chips can be uniquely
// keyed (for React keys, FLIP animations, DnD lookups). The server doesn't
// know about them — clear them out before send so the server treats those
// options as creates rather than failing to find a matching record.
export const stripPendingOptionIds = (options?: PropertyFieldOption[]) =>
    options?.map((o) => (isPendingId(o.id) ? {...o, id: ''} : o));

const stripPendingFromAttrs = <A extends BoardsPropertyField['attrs']>(attrs: A): A => {
    if (!attrs?.options) {
        return attrs;
    }
    return {...attrs, options: stripPendingOptionIds(attrs.options)};
};

// Remove `options` from `attrs` when the field type doesn't carry an option
// list, so a stale options array left over from a recent type-switch can't
// be persisted on either create or update.
const stripIrrelevantOptions = <A extends BoardsPropertyField['attrs']>(attrs: A, type: BoardsPropertyField['type']): A => {
    if (type === 'select' || type === 'multiselect') {
        return attrs;
    }
    if (!attrs?.options) {
        return attrs;
    }
    const next = {...attrs} as A;
    Reflect.deleteProperty(next, 'options');
    return next;
};

export const newPendingBoardField = (patch: BoardsPropertyFieldPatch & Pick<BoardsPropertyField, 'name'>): BoardsPropertyField => {
    const attrs = {...patch.attrs};

    if (attrs.options) {
        // Give each option a pending id so chips remain individually keyable
        // (React key, FLIP, DnD). `stripPendingFromAttrs` on save replaces
        // these with '' before hitting the server.
        attrs.options = patch.attrs?.options?.map((option) => ({...option, id: newPendingId()}));
    }

    return {
        type: 'text',
        ...patch,
        group_id: BOARDS_PROPERTY_GROUP_NAME,
        object_type: BOARDS_PROPERTY_OBJECT_TYPE,
        id: newPendingId(),
        create_at: 0,
        delete_at: 0,
        update_at: 0,
        created_by: '',
        updated_by: '',
        target_id: '',
        target_type: BOARDS_PROPERTY_TARGET_TYPE,
        attrs: {
            sort_order: 0,
            ...attrs,
        },
    };
};
