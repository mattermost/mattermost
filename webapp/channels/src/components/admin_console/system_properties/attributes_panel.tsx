// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useMemo} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {ClientError} from '@mattermost/client';
import type {PropertyField} from '@mattermost/types/properties';
import type {IDMappedCollection, RelationOneToOne} from '@mattermost/types/utilities';
import {collectionAddItem, collectionFromArray, collectionReplaceItem, collectionToArray} from '@mattermost/types/utilities';

import {insertWithoutDuplicates} from 'mattermost-redux/utils/array_utils';

import {setNavigationBlocked} from 'actions/admin_actions';

import LoadingScreen from 'components/loading_screen';
import AdminHeader from 'components/widgets/admin_console/admin_header';

import Constants from 'utils/constants';

import {AdminSection, AdminWrapper, DangerText, SectionContent, SectionHeader, SectionHeading} from './controls';
import {useThing, usePendingThing, BatchProcessingError} from './section_utils';
import type {CollectionIO} from './section_utils';

import SaveChangesPanel from '../save_changes_panel';

// Helper function to generate a unique default name for new fields
// Similar to getIncrementedName in user_properties_utils.ts
const getIncrementedName = <T extends PropertyField>(desiredName: string, collection: IDMappedCollection<T>): string => {
    const names = new Set(Object.values(collection.data).map((field) => (field as T).name));
    let newName = desiredName;
    let n = 1;
    while (names.has(newName)) {
        n++;
        newName = `${desiredName} ${n}`;
    }
    return newName;
};

export type PropertyFieldConfig<T extends PropertyField = PropertyField> = {
    group_id: string;
    getFields: () => Promise<T[]>;
    createField: (field: Partial<T>) => Promise<T>;
    patchField: (id: string, patch: Partial<T>) => Promise<T>;
    deleteField: (id: string) => Promise<void>;
    isCreatePending: (field: T) => boolean;
    isDeletePending: (field: T) => boolean;
    prepareFieldForCreate?: (field: Partial<T>) => Partial<T>;
    prepareFieldForPatch?: (field: Partial<T>) => Partial<T>;
};

type AttributesPanelProps<T extends PropertyField = PropertyField> = {
    group_id: string;
    title: MessageDescriptor;
    subtitle: MessageDescriptor;
    dataTestId: string;
    fieldConfig: PropertyFieldConfig<T>;
    maxFields?: number;
    renderTable: (props: {
        data: IDMappedCollection<T>;
        canCreate: boolean;
        createField: (field: T) => void;
        updateField: (field: T) => void;
        deleteField: (id: string) => void;
        reorderField: (field: T, nextOrder: number) => void;
    }) => React.ReactNode;
    pageTitle: MessageDescriptor;
};

export function useAttributesPanel<T extends PropertyField = PropertyField>(
    config: PropertyFieldConfig<T>,
): [IDMappedCollection<T>, CollectionIO<T>, ReturnType<typeof usePendingThing<IDMappedCollection<T>, BatchProcessingError<ClientError>>>[1], ReturnType<typeof useThing<IDMappedCollection<T>>>[1]] {
    const [fieldCollection, readIO] = useThing<IDMappedCollection<T>>(useMemo(() => ({
        get: async () => {
            const data = await config.getFields();
            const sorted = data.sort((a, b) => {
                const aOrder = (a.attrs as {sort_order?: number})?.sort_order ?? 0;
                const bOrder = (b.attrs as {sort_order?: number})?.sort_order ?? 0;
                return aOrder - bOrder;
            });
            return collectionFromArray(sorted);
        },
        select: () => undefined,
        opts: {forceInitialGet: true},
    }), [config]), collectionFromArray([]) as unknown as IDMappedCollection<T>);

    const [pendingCollection, pendingIO] = usePendingThing<IDMappedCollection<T>, BatchProcessingError<ClientError>>(
        fieldCollection,
        useMemo(() => ({
            beforeUpdate: (pending: IDMappedCollection<T>, current: IDMappedCollection<T>) => {
                // Validate field names
                const byNamesLower = (fields: T[]) => {
                    const result: {[key: string]: T[]} = {};
                    fields.forEach((field) => {
                        const key = field.name.toLowerCase();
                        if (!result[key]) {
                            result[key] = [];
                        }
                        result[key].push(field);
                    });
                    return result;
                };

                const pendingFields = collectionToArray(pending);
                const currentFields = collectionToArray(current);

                const pendingByName = byNamesLower(pendingFields);
                const currentByName = byNamesLower(currentFields);

                const warnings = pendingFields.reduce<NonNullable<IDMappedCollection<T>['warnings']>>((acc, field) => {
                    if (!field.name) {
                        // name not provided
                        (acc as any)[field.id] = {name: 'name_required'};
                    } else if (pendingByName[field.name.toLowerCase()]?.filter((x) => (x as T & {delete_at?: number}).delete_at === 0)?.length > 1) {
                        // duplicate pending name
                        (acc as any)[field.id] = {name: 'name_unique'};
                    } else if (
                        currentByName?.[field.name.toLowerCase()]?.length >= 1 &&
                        field.id !== currentByName?.[field.name.toLowerCase()]?.[0]?.id
                    ) {
                        // name already in use
                        const conflictingField = currentByName[field.name.toLowerCase()][0];
                        const correspondingPending = pending.data[conflictingField.id as keyof typeof pending.data] as T | undefined;

                        // except when corresponding field is going to be deleted, then it is no longer in conflict
                        if (correspondingPending && (correspondingPending as T & {delete_at?: number}).delete_at === 0) {
                            // not going to be deleted, so in conflict
                            (acc as any)[field.id] = {name: 'name_taken'};
                        }
                    }

                    return acc;
                }, {} as NonNullable<IDMappedCollection<T>['warnings']>);

                return {
                    ...pending,
                    warnings: Object.keys(warnings).length > 0 ? warnings : undefined,
                };
            },
            commit: async (collection: IDMappedCollection<T>, prevCollection: IDMappedCollection<T>) => {
                const process = collectionToArray(collection).reduce<{
                    create: T[];
                    edit: T[];
                    delete: T[];
                }>((ops, item) => {
                    const prevItem = prevCollection.data[item.id as keyof typeof prevCollection.data];

                    // Check if item actually changed by comparing key fields, not just reference
                    // This is important because collectionToArray might return objects that share references
                    const isActuallyUnchanged = prevItem &&
                        item.create_at === prevItem.create_at &&
                        item.delete_at === prevItem.delete_at &&
                        item.name === prevItem.name &&
                        item.type === prevItem.type;

                    // don't process unchanged items - but check actual values, not just reference
                    if (isActuallyUnchanged) {
                        return ops;
                    }

                    const isCreatePending = config.isCreatePending(item);
                    const isDeletePending = config.isDeletePending(item);

                    if (isCreatePending) {
                        ops.create.push(item);
                    } else if (isDeletePending) {
                        ops.delete.push(item);
                    } else if (prevItem) {
                        // Item exists in previous collection, so it's an edit
                        ops.edit.push(item);
                    }

                    return ops;
                }, {delete: [], edit: [], create: []});

                const next: IDMappedCollection<T> = {
                    data: {...collection.data},
                    order: [...collection.order],
                };

                // Delete
                await Promise.all(process.delete.map(async ({id}) => {
                    return config.deleteField(id).
                        then(() => {
                            Reflect.deleteProperty(next.data, id);
                            next.order = next.order.filter((orderId) => orderId !== id);
                        }).
                        catch((reason: ClientError) => {
                            if (!next.errors) {
                                next.errors = {} as RelationOneToOne<T, Error>;
                            }
                            next.errors = {...next.errors, [id]: reason};
                        });
                }));

                // Update
                await Promise.all(process.edit.map(async (pendingItem) => {
                    const {id, ...patch} = pendingItem;
                    const preparedPatch = config.prepareFieldForPatch ? config.prepareFieldForPatch(patch as Partial<T>) : patch;
                    return config.patchField(id, preparedPatch as Partial<T>).
                        then((nextItem) => {
                            (next.data as Record<string, T>)[id] = nextItem;
                        }).
                        catch((reason: ClientError) => {
                            if (!next.errors) {
                                next.errors = {} as RelationOneToOne<T, Error>;
                            }
                            next.errors = {...next.errors, [id]: reason};
                        });
                }));

                // Create
                await Promise.all(process.create.map(async (pendingItem) => {
                    const {id, ...patch} = pendingItem;
                    const preparedPatch = config.prepareFieldForCreate ? config.prepareFieldForCreate(patch as Partial<T>) : patch;
                    return config.createField(preparedPatch as Partial<T>).
                        then((nextItem) => {
                            // Replace temporary id with real id
                            Reflect.deleteProperty(next.data, id);
                            (next.data as Record<string, T>)[nextItem.id] = nextItem;
                            next.order = next.order.map((orderId) => (orderId === id ? nextItem.id : orderId));
                        }).
                        catch((reason: ClientError) => {
                            if (!next.errors) {
                                next.errors = {} as RelationOneToOne<T, Error>;
                            }
                            next.errors = {...next.errors, [id]: reason};
                        });
                }));

                if (next.errors && Object.keys(next.errors).length > 0) {
                    throw new BatchProcessingError<ClientError>('error processing operations', {cause: next.errors});
                }

                return next;
            },
        }), [config]),
    );

    const itemOps: CollectionIO<T> = useMemo(() => ({
        create: (patch?: Partial<T>) => {
            // Ensure create_at and delete_at are always 0 for new fields, even if patch contains them
            // Extract and ignore timestamp/user fields from patch to ensure they're always set correctly
            const patchWithoutTimestamps = patch ? Object.fromEntries(
                Object.entries(patch).filter(([key]) =>
                    !['create_at', 'delete_at', 'update_at', 'created_by', 'updated_by', 'id'].includes(key),
                ),
            ) : {};
            pendingIO.apply((current) => {
                // Calculate sort_order based on number of non-deleted items
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const nonDeletedCount = Object.values(current.data).filter((f: any) => f.delete_at === 0).length;

                // Generate a default name if not provided in patch, similar to User Attributes behavior
                // Ensure we always have a name, even if patch contains an empty string
                const defaultName = (patchWithoutTimestamps.name && patchWithoutTimestamps.name.trim()) || getIncrementedName('Text', current);
                const newField = {
                    id: `temp_${Date.now()}`,
                    type: 'text' as const,
                    group_id: config.group_id,
                    create_at: 0,
                    delete_at: 0,
                    update_at: 0,
                    created_by: '',
                    updated_by: '',
                    attrs: {
                        ...(patchWithoutTimestamps.attrs || {}),
                        sort_order: nonDeletedCount,
                    },
                    ...patchWithoutTimestamps,

                    // Ensure name is always set after spread to prevent empty string from overwriting default
                    name: defaultName,
                } as T;
                return collectionAddItem(current, newField);
            });
        },
        update: (field: T) => {
            pendingIO.apply((current) => {
                // Use collectionReplaceItem to ensure new object reference for change detection
                return collectionReplaceItem(current, field);
            });
        },
        delete: (id: string) => {
            pendingIO.apply((current) => {
                const field = current.data[id as keyof typeof current.data];
                if (field) {
                    if (config.isCreatePending(field)) {
                        // Remove if it was never saved
                        const next = {...current, data: {...current.data}};
                        Reflect.deleteProperty(next.data, id);
                        next.order = next.order.filter((orderId) => orderId !== id);
                        return next;
                    }

                    // Mark as deleted - use collectionReplaceItem to ensure new object reference
                    const newDeleteAt = Date.now();
                    return collectionReplaceItem(current, {...field, delete_at: newDeleteAt} as T);
                }
                return current;
            });
        },
        reorder: (field: T, nextOrder: number) => {
            pendingIO.apply((current) => {
                // Update the order array using insertWithoutDuplicates
                const nextOrderArray = insertWithoutDuplicates(current.order, field.id, nextOrder);

                // If order didn't change, return early
                if (nextOrderArray === current.order) {
                    return current;
                }

                // Recalculate sort_order for all items based on their position in the order array
                const items = collectionToArray(current);
                const nextItems = items.reduce<T[]>((changedItems, item) => {
                    const itemCurrentOrder = (item.attrs as {sort_order?: number})?.sort_order ?? 0;
                    const itemNextOrder = nextOrderArray.indexOf(item.id);

                    // Only update items whose sort_order actually changed
                    if (itemNextOrder !== itemCurrentOrder) {
                        changedItems.push({
                            ...item,
                            attrs: {
                                ...(item.attrs || {}),
                                sort_order: itemNextOrder,
                            },
                        } as T);
                    }

                    return changedItems;
                }, []);

                // Update both the order array and all affected items
                return collectionReplaceItem({...current, order: nextOrderArray}, ...nextItems);
            });
        },
    }), [config, pendingIO]);

    return [pendingCollection, itemOps, pendingIO, readIO];
}

export function AttributesPanel<T extends PropertyField = PropertyField>({
    title,
    subtitle,
    dataTestId,
    fieldConfig,
    maxFields = Constants.MAX_CUSTOM_ATTRIBUTES,
    renderTable,
    pageTitle,
}: AttributesPanelProps<T>) {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const [fieldCollection, itemOps, pendingIO, readIO] = useAttributesPanel(fieldConfig);
    const nonDeletedCount = (Object.values(fieldCollection.data) as T[]).filter((f) => f.delete_at === 0).length;
    const canCreate = nonDeletedCount < maxFields;

    const handleSave = () => {
        pendingIO.commit().then((newData) => {
            if (newData) {
                // Check if there are any errors (errors property should be removed if empty)
                const hasErrors = newData.errors && Object.keys(newData.errors).length > 0;
                if (hasErrors) {
                    return;
                }

                // Reconcile - refresh from server to ensure we have the latest state
                // This ensures deleted items are actually gone from the server
                readIO.get().then((serverData) => {
                    if (serverData) {
                        readIO.setData(serverData);
                    } else {
                        // Fallback to local data if refresh fails
                        readIO.setData(newData);
                    }
                }).catch(() => {
                    // Fallback to local data if refresh fails
                    readIO.setData(newData);
                });
            }
        }).catch(() => {
            // Error is already handled by pendingIO.error
        });
    };

    useEffect(() => {
        dispatch(setNavigationBlocked(pendingIO.hasChanges));
    }, [pendingIO.hasChanges, dispatch]);

    // Check for warnings (validation errors)
    const hasWarnings = fieldCollection.warnings && Object.keys(fieldCollection.warnings).length > 0;
    const isValid = !hasWarnings;

    const content = readIO.loading ? (
        <LoadingScreen/>
    ) : (
        <>
            {renderTable({
                data: fieldCollection,
                canCreate,
                createField: itemOps.create!,
                updateField: itemOps.update!,
                deleteField: (id: string) => {
                    if (itemOps.delete) {
                        // TypeScript can't infer which overload, so we cast
                        (itemOps.delete as (id: string) => void)(id);
                    }
                },
                reorderField: itemOps.reorder!,
            })}
        </>
    );

    return (
        <div
            className='wrapper--fixed'
            data-testid={dataTestId}
        >
            <AdminHeader>
                <FormattedMessage {...pageTitle}/>
            </AdminHeader>
            <AdminWrapper>
                <AdminSection data-testid={dataTestId}>
                    <SectionHeader>
                        <hgroup>
                            <FormattedMessage
                                tagName={SectionHeading}
                                {...title}
                            />
                            <FormattedMessage {...subtitle}/>
                        </hgroup>
                    </SectionHeader>
                    <SectionContent $compact={true}>
                        {content}
                    </SectionContent>
                </AdminSection>
            </AdminWrapper>
            <SaveChangesPanel
                saving={pendingIO.saving}
                saveNeeded={pendingIO.hasChanges}
                onClick={handleSave}
                serverError={pendingIO.error ? (
                    <FormattedMessage
                        tagName={DangerText}
                        id='admin.system_properties.details.saving_changes_error'
                        defaultMessage='There was an error while saving the configuration'
                    />
                ) : undefined}
                savingMessage={formatMessage({id: 'admin.system_properties.details.saving_changes', defaultMessage: 'Saving configuration…'})}
                isDisabled={pendingIO.saving || !pendingIO.hasChanges || !isValid}
            />
        </div>
    );
}
