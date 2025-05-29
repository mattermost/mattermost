// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createColumnHelper, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef} from '@tanstack/react-table';
import type {ReactNode} from 'react';
import React, {useEffect, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import styled from 'styled-components';

import {PlusIcon} from '@mattermost/compass-icons/components';
import type {UserPropertyField} from '@mattermost/types/properties';
import {collectionToArray} from '@mattermost/types/utilities';

import LoadingScreen from 'components/loading_screen';

import Constants from 'utils/constants';

import {DangerText, BorderlessInput, LinkButton} from './controls';
import type {SectionHook} from './section_utils';
import DotMenu from './user_properties_dot_menu';
import SelectType from './user_properties_type_menu';
import type {UserPropertyFields} from './user_properties_utils';
import {isCreatePending, useUserPropertyFields, ValidationWarningNameRequired, ValidationWarningNameTaken, ValidationWarningNameUnique} from './user_properties_utils';
import UserPropertyValues from './user_properties_values';

import {AdminConsoleListTable} from '../list_table';

type FieldActions = {
    createField: (field: UserPropertyField) => void;
    updateField: (field: UserPropertyField) => void;
    deleteField: (id: string) => void;
    reorderField: (field: UserPropertyField, nextOrder: number) => void;
}

export const useUserPropertiesTable = (): SectionHook => {
    const [userPropertyFields, readIO, pendingIO, itemOps] = useUserPropertyFields();
    const nonDeletedCount = Object.values(userPropertyFields.data).filter((f) => f.delete_at === 0).length;

    const canCreate = nonDeletedCount < Constants.MAX_CUSTOM_ATTRIBUTES;

    const create = () => {
        itemOps.create();
    };

    const save = async () => {
        const newData = await pendingIO.commit();

        // reconcile - zero pending changes
        if (newData && !newData.errors) {
            readIO.setData(newData);
        }
    };

    const content = readIO.loading ? (
        <LoadingScreen/>
    ) : (
        <>
            <UserPropertiesTable
                data={userPropertyFields}
                canCreate={canCreate}
                createField={itemOps.create}
                updateField={itemOps.update}
                deleteField={itemOps.delete}
                reorderField={itemOps.reorder}
            />
            {canCreate && (
                <LinkButton onClick={create}>
                    <PlusIcon size={16}/>
                    <FormattedMessage
                        id='admin.system_properties.user_properties.add_property'
                        defaultMessage='Add property'
                    />
                </LinkButton>
            )}
        </>
    );

    return {
        content,
        loading: readIO.loading,
        hasChanges: pendingIO.hasChanges,
        isValid: !userPropertyFields.warnings,
        save,
        cancel: pendingIO.reset,
        saving: pendingIO.saving,
        saveError: pendingIO.error,
    };
};

type Props = {
    data: UserPropertyFields;
    canCreate: boolean;
}

export function UserPropertiesTable({
    data: collection,
    canCreate,
    createField,
    updateField,
    deleteField,
    reorderField,
}: Props & FieldActions) {
    const {formatMessage} = useIntl();
    const data = collectionToArray(collection);
    const col = createColumnHelper<UserPropertyField>();
    const columns = useMemo<Array<ColumnDef<UserPropertyField, any>>>(() => {
        return [
            col.accessor('name', {
                size: 180,
                header: () => {
                    return (
                        <ColHeaderLeft>
                            <FormattedMessage
                                id='admin.system_properties.user_properties.table.property'
                                defaultMessage='Property'
                            />
                        </ColHeaderLeft>
                    );
                },
                cell: ({getValue, row}) => {
                    const toDelete = row.original.delete_at !== 0;
                    const warningId = collection.warnings?.[row.original.id]?.name;

                    let warning;

                    if (warningId === ValidationWarningNameRequired) {
                        warning = (
                            <FormattedMessage
                                tagName={DangerText}
                                id='admin.system_properties.user_properties.table.validation.name_required'
                                defaultMessage='Please enter a property name.'
                            />
                        );
                    } else if (warningId === ValidationWarningNameUnique) {
                        warning = (
                            <FormattedMessage
                                tagName={DangerText}
                                id='admin.system_properties.user_properties.table.validation.name_unique'
                                defaultMessage='Property names must be unique.'
                            />
                        );
                    } else if (warningId === ValidationWarningNameTaken) {
                        warning = (
                            <FormattedMessage
                                tagName={DangerText}
                                id='admin.system_properties.user_properties.table.validation.name_taken'
                                defaultMessage='Property name already taken.'
                            />
                        );
                    }

                    return (
                        <>
                            <EditCell
                                strong={true}
                                value={getValue()}
                                label={formatMessage({id: 'admin.system_properties.user_properties.table.property_name.input.name', defaultMessage: 'Property Name'})}
                                deleted={toDelete}
                                borderless={!warning}
                                testid='property-field-input'
                                autoFocus={isCreatePending(row.original)}
                                setValue={(value: string) => {
                                    updateField({...row.original, name: value.trim()});
                                }}
                                maxLength={Constants.MAX_CUSTOM_ATTRIBUTE_NAME_LENGTH}
                            />
                            {!toDelete && warning}
                        </>
                    );
                },
                enableHiding: false,
                enableSorting: false,
            }),
            col.accessor('type', {
                size: 100,
                header: () => {
                    return (
                        <ColHeaderLeft>
                            <FormattedMessage
                                id='admin.system_properties.user_properties.table.type'
                                defaultMessage='Type'
                            />
                        </ColHeaderLeft>
                    );
                },
                cell: ({row}) => {
                    return (
                        <SelectType
                            field={row.original}
                            updateField={updateField}
                        />
                    );
                },
                enableHiding: false,
                enableSorting: false,
            }),
            col.display({
                id: 'options',
                size: 300,
                header: () => (
                    <ColHeaderLeft>
                        <FormattedMessage
                            id='admin.system_properties.user_properties.table.values'
                            defaultMessage='Values'
                        />
                    </ColHeaderLeft>
                ),
                cell: ({row}) => (
                    <>
                        <UserPropertyValues
                            field={row.original}
                            updateField={updateField}
                        />
                    </>
                ),
                enableHiding: false,
                enableSorting: false,
            }),
            col.display({
                id: 'actions',
                size: 40,
                header: () => {
                    return (
                        <ColHeaderRight>
                            <FormattedMessage
                                id='admin.system_properties.user_properties.table.actions'
                                defaultMessage='Actions'
                            />
                        </ColHeaderRight>
                    );
                },
                cell: ({row}) => (
                    <ActionsRoot>
                        <DotMenu
                            field={row.original}
                            canCreate={canCreate}
                            createField={createField}
                            updateField={updateField}
                            deleteField={deleteField}
                        />
                    </ActionsRoot>
                ),
                enableHiding: false,
                enableSorting: false,
            }),
        ];
    }, [createField, updateField, deleteField, collection.warnings, canCreate]);

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel<UserPropertyField>(),
        getSortedRowModel: getSortedRowModel<UserPropertyField>(),
        enableSortingRemoval: false,
        enableMultiSort: false,
        renderFallbackValue: '',
        meta: {
            tableId: 'userProperties',
            disablePaginationControls: true,
            onReorder: (prev: number, next: number) => {
                reorderField(collection.data[collection.order[prev]], next);
            },
        },
        manualPagination: true,
    });

    return (
        <TableWrapper>
            <AdminConsoleListTable<UserPropertyField> table={table}/>
        </TableWrapper>
    );
}

const TableWrapper = styled.div`
    table.adminConsoleListTable {

        td, th {
            &:after, &:before {
                display: none;
            }
        }

        thead {
            border-top: none;
            border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
            tr {
                th.pinned {
                    background: rgba(var(--center-channel-color-rgb), 0.04);
                    padding-block-end: 8px;
                    padding-block-start: 8px;
                }
            }
        }

        tbody {
            tr {
                border-top: none;
                border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
                border-bottom-color: rgba(var(--center-channel-color-rgb), 0.08) !important;
                td {
                    padding-block-end: 0;
                    padding-block-start: 0;

                    &:not(:first-child):not(:last-child) {
                        padding-inline-end: 0;
                        padding-inline-start: 0;
                    }

                    &:last-child {
                        padding-inline-end: 12px;
                    }
                    &.pinned {
                        background: none;
                    }
                }
            }
        }

        tfoot {
            border-top: none;
        }
    }
    .adminConsoleListTableContainer {
        padding: 2px 0px;
    }
`;

const ColHeaderLeft = styled.div`
    display: inline-block;
`;

const ColHeaderRight = styled.div`
    display: inline-block;
    width: 100%;
    text-align: right;
`;

const ActionsRoot = styled.div`
    text-align: right;
`;

type EditCellProps = {
    value: string;
    label?: string;
    testid?: string;
    setValue: (value: string) => void;
    autoFocus?: boolean;
    disabled?: boolean;
    deleted?: boolean;
    footer?: ReactNode;
    strong?: boolean;
    maxLength?: number;
    borderless?: boolean;
};
const EditCell = (props: EditCellProps) => {
    const [value, setValue] = useState(props.value);

    useEffect(() => {
        setValue(props.value);
    }, [props.value]);

    return (
        <>
            <BorderlessInput
                type='text'
                aria-label={props.label}
                data-testid={props.testid}
                disabled={props.disabled ?? props.deleted}
                $deleted={props.deleted}
                $strong={props.strong}
                maxLength={props.maxLength}
                autoFocus={props.autoFocus}
                onFocus={(e) => {
                    if (props.autoFocus) {
                        e.target.select();
                    }
                }}
                value={value}
                onChange={(e) => {
                    setValue(e.target.value);
                }}
                onBlur={() => {
                    if (value !== props.value) {
                        props.setValue(value);
                    }
                }}
            />
            {props.footer}
        </>
    );
};
