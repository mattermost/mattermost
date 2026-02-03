// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage} from 'react-intl';
import React, {useEffect, useMemo} from 'react';
import {useDispatch} from 'react-redux';

import {setNavigationBlocked} from 'actions/admin_actions';

import AdminHeader from 'components/widgets/admin_console/admin_header';

import type {PropertyField} from '@mattermost/types/properties';
import type {IDMappedCollection} from '@mattermost/types/utilities';
import type {ClientError} from '@mattermost/client';
import {collectionFromArray, collectionReplaceItem, collectionToArray} from '@mattermost/types/utilities';

import LoadingScreen from 'components/loading_screen';

import Constants from 'utils/constants';

import {AdminSection, AdminWrapper, DangerText, SectionContent, SectionHeader, SectionHeading} from './controls';
import type {SectionHook} from './section_utils';
import {useThing, usePendingThing, BatchProcessingError} from './section_utils';
import type {CollectionIO} from './section_utils';
import SaveChangesPanel from '../save_changes_panel';

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
    config: PropertyFieldConfig<T>
): [IDMappedCollection<T>, CollectionIO<T>, ReturnType<typeof usePendingThing<IDMappedCollection<T>, BatchProcessingError<ClientError>>>[1], ReturnType<typeof useThing<IDMappedCollection<T>>>[1]] {
    const [fieldCollection, readIO] = useThing<IDMappedCollection<T>>(useMemo(() => ({
        get: async () => {
            const data = await config.getFields();
            const sorted = data.sort((a, b) => ((a.attrs as any)?.sort_order ?? 0) - ((b.attrs as any)?.sort_order ?? 0));
            return collectionFromArray(sorted);
        },
        select: () => undefined,
        opts: {forceInitialGet: true},
    }), [config]), collectionFromArray([]));

    const [pendingCollection, pendingIO] = usePendingThing<IDMappedCollection<T>, BatchProcessingError<ClientError>>(
        fieldCollection,
        useMemo(() => ({
            commit: async (collection: IDMappedCollection<T>, prevCollection: IDMappedCollection<T>) => {
                console.log('[useAttributesPanel] commit called');
                console.log('[useAttributesPanel] collection:', collection);
                console.log('[useAttributesPanel] prevCollection:', prevCollection);
                
                const process = collectionToArray(collection).reduce<{
                    create: T[];
                    edit: T[];
                    delete: T[];
                }>((ops, item) => {
                    const prevItem = prevCollection.data[item.id];
                    const isSameReference = item === prevItem;
                    
                    console.log(`[useAttributesPanel] Processing item ${item.id}:`, {
                        isSameReference,
                        hasPrevItem: !!prevItem,
                        isCreatePending: config.isCreatePending(item),
                        isDeletePending: config.isDeletePending(item),
                        itemName: (item as any).name,
                        prevItemName: prevItem ? (prevItem as any).name : undefined,
                    });
                    
                    // don't process unchanged items
                    if (isSameReference) {
                        return ops;
                    }

                    if (config.isCreatePending(item)) {
                        ops.create.push(item);
                    } else if (config.isDeletePending(item)) {
                        ops.delete.push(item);
                    } else if (prevItem) {
                        // Item exists in previous collection, so it's an edit
                        ops.edit.push(item);
                    }

                    return ops;
                }, {delete: [], edit: [], create: []});
                
                console.log('[useAttributesPanel] process operations:', process);

                const next: IDMappedCollection<T> = {
                    data: {...collection.data},
                    order: [...collection.order],
                    errors: {},
                };

                // Delete
                console.log('[useAttributesPanel] Processing deletes:', process.delete.length);
                await Promise.all(process.delete.map(async ({id}) => {
                    return config.deleteField(id)
                        .then(() => {
                            console.log('[useAttributesPanel] Delete succeeded for:', id);
                            Reflect.deleteProperty(next.data, id);
                            next.order = next.order.filter((orderId) => orderId !== id);
                        })
                        .catch((reason: ClientError) => {
                            console.error('[useAttributesPanel] Delete failed for:', id, reason);
                            next.errors = {...next.errors, [id]: reason};
                        });
                }));

                // Update
                console.log('[useAttributesPanel] Processing updates:', process.edit.length);
                await Promise.all(process.edit.map(async (pendingItem) => {
                    const {id, ...patch} = pendingItem;
                    const preparedPatch = config.prepareFieldForPatch ? config.prepareFieldForPatch(patch) : patch;
                    console.log('[useAttributesPanel] Updating field:', id, preparedPatch);
                    return config.patchField(id, preparedPatch)
                        .then((nextItem) => {
                            console.log('[useAttributesPanel] Update succeeded for:', id, nextItem);
                            next.data[id] = nextItem;
                        })
                        .catch((reason: ClientError) => {
                            console.error('[useAttributesPanel] Update failed for:', id, reason);
                            next.errors = {...next.errors, [id]: reason};
                        });
                }));

                // Create
                console.log('[useAttributesPanel] Processing creates:', process.create.length);
                await Promise.all(process.create.map(async (pendingItem) => {
                    const {id, ...patch} = pendingItem;
                    const preparedPatch = config.prepareFieldForCreate ? config.prepareFieldForCreate(patch) : patch;
                    console.log('[useAttributesPanel] Creating field:', id, preparedPatch);
                    return config.createField(preparedPatch)
                        .then((nextItem) => {
                            console.log('[useAttributesPanel] Create succeeded, new id:', nextItem.id);
                            // Replace temporary id with real id
                            Reflect.deleteProperty(next.data, id);
                            next.data[nextItem.id] = nextItem;
                            next.order = next.order.map((orderId) => orderId === id ? nextItem.id : orderId);
                        })
                        .catch((reason: ClientError) => {
                            console.error('[useAttributesPanel] Create failed for:', id, reason);
                            next.errors = {...next.errors, [id]: reason};
                        });
                }));

                console.log('[useAttributesPanel] Commit complete, errors:', Object.keys(next.errors).length);
                if (Object.keys(next.errors).length > 0) {
                    console.error('[useAttributesPanel] Throwing BatchProcessingError with errors:', next.errors);
                    throw new BatchProcessingError<ClientError>('error processing operations', {cause: next.errors});
                }

                // Remove errors property if empty (like original implementation)
                Reflect.deleteProperty(next, 'errors');

                console.log('[useAttributesPanel] Returning successful result:', next);
                return next;
            },
        }), [config])
    );

    const itemOps: CollectionIO<T> = useMemo(() => ({
        create: (patch?: Partial<T>) => {
            const newField = {
                id: `temp_${Date.now()}`,
                name: '',
                type: 'text' as const,
                group_id: config.group_id,
                attrs: {},
                ...patch,
            } as T;
            pendingIO.apply((current) => {
                const next = {...current};
                next.data[newField.id] = newField;
                next.order = [...next.order, newField.id];
                return next;
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
                const next = {...current};
                const field = next.data[id];
                if (field) {
                    if (config.isCreatePending(field)) {
                        // Remove if it was never saved
                        Reflect.deleteProperty(next.data, id);
                        next.order = next.order.filter((orderId) => orderId !== id);
                    } else {
                        // Mark as deleted
                        next.data[id] = {...field, delete_at: Date.now()} as T;
                    }
                }
                return next;
            });
        },
        reorder: (field: T, nextOrder: number) => {
            pendingIO.apply((current) => {
                const next = {...current};
                const updatedField = {
                    ...field,
                    attrs: {
                        ...(field.attrs || {}),
                        sort_order: nextOrder,
                    },
                };
                next.data[field.id] = updatedField as T;
                return next;
            });
        },
    }), [config.group_id, config.isCreatePending, pendingIO]);

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
    const [fieldCollection, itemOps, pendingIO, readIO] = useAttributesPanel(fieldConfig);
    const nonDeletedCount = Object.values(fieldCollection.data).filter((f) => (f as any).delete_at === 0).length;
    const canCreate = nonDeletedCount < maxFields;

    const handleSave = () => {
        console.log('[AttributesPanel] handleSave called');
        console.log('[AttributesPanel] pendingIO.hasChanges:', pendingIO.hasChanges);
        console.log('[AttributesPanel] pendingIO.saving:', pendingIO.saving);
        console.log('[AttributesPanel] fieldCollection:', fieldCollection);
        
        pendingIO.commit().then((newData) => {
            console.log('[AttributesPanel] commit resolved, newData:', newData);
            if (newData) {
                // Check if there are any errors (errors property should be removed if empty)
                const hasErrors = newData.errors && Object.keys(newData.errors).length > 0;
                if (!hasErrors) {
                    console.log('[AttributesPanel] Setting new data, no errors');
                    // Reconcile - zero pending changes
                    readIO.setData(newData);
                } else {
                    console.log('[AttributesPanel] Commit returned with errors:', newData.errors);
                }
            } else {
                console.log('[AttributesPanel] Commit returned no data');
            }
        }).catch((error) => {
            // Error is already handled by pendingIO.error
            console.error('[AttributesPanel] Error saving attributes:', error);
        });
    };

    useEffect(() => {
        dispatch(setNavigationBlocked(pendingIO.hasChanges));
    }, [pendingIO.hasChanges, dispatch]);

    // Check for warnings (validation errors)
    const hasWarnings = fieldCollection.warnings && Object.keys(fieldCollection.warnings).length > 0;
    const isValid = !hasWarnings;

    const content = pendingIO.loading ? (
        <LoadingScreen/>
    ) : (
        <>
            {renderTable({
                data: fieldCollection,
                canCreate,
                createField: itemOps.create!,
                updateField: itemOps.update!,
                deleteField: itemOps.delete!,
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
                savingMessage={<FormattedMessage id='admin.system_properties.details.saving_changes' defaultMessage='Saving configuration…'/>}
                isDisabled={pendingIO.saving || !pendingIO.hasChanges || !isValid}
            />
        </div>
    );
}
