// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createColumnHelper, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef} from '@tanstack/react-table';
import type {ReactNode} from 'react';
import React, {useEffect, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import styled, {css} from 'styled-components';

import {PlusIcon, TextBoxOutlineIcon, TrashCanOutlineIcon} from '@mattermost/compass-icons/components';
import type {UserPropertyField} from '@mattermost/types/properties';
import {collectionToArray} from '@mattermost/types/utilities';

import LoadingScreen from 'components/loading_screen';

import Constants from 'utils/constants';

import {DangerText, FieldDeleteButton, FieldInput, LinkButton} from './controls';
import type {SectionHook} from './section_utils';
import {useUserPropertyFieldDelete} from './user_properties_delete_modal';
import type {UserPropertyFields} from './user_properties_utils';
import {isCreatePending, useUserPropertyFields, ValidationWarningNameRequired, ValidationWarningNameTaken, ValidationWarningNameUnique} from './user_properties_utils';

import {AdminConsoleListTable} from '../list_table';

type Props = {
    data: UserPropertyFields;
}

type FieldActions = {
    updateField: (field: UserPropertyField) => void;
    deleteField: (id: string) => void;
}

export const useUserPropertiesTable = (): SectionHook => {
    const [userPropertyFields, readIO, pendingIO, itemOps] = useUserPropertyFields();
    const nonDeletedCount = Object.values(userPropertyFields.data).filter((f) => f.delete_at === 0).length;

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
                updateField={itemOps.update}
                deleteField={itemOps.delete}
            />
            {nonDeletedCount < Constants.MAX_CUSTOM_ATTRIBUTES && (
                <LinkButton onClick={itemOps.create}>
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

export function UserPropertiesTable({data: collection, updateField, deleteField}: Props & FieldActions) {
    const {formatMessage} = useIntl();
    const data = collectionToArray(collection);
    const col = createColumnHelper<UserPropertyField>();
    const columns = useMemo<Array<ColumnDef<UserPropertyField, any>>>(() => {
        return [
            col.accessor('name', {
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
                            <EditableValue
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
                cell: ({getValue, row}) => {
                    let type = getValue();

                    if (type === 'text') {
                        type = (
                            <>
                                <TextBoxOutlineIcon
                                    size={18}
                                    color={'rgba(var(--center-channel-color-rgb), 0.64)'}
                                />
                                <FormattedMessage
                                    id='admin.system_properties.user_properties.table.type.text'
                                    defaultMessage='Text'
                                />
                            </>
                        );
                    }

                    return (
                        <TypeCellWrapper $deleted={row.original.delete_at !== 0}>
                            {type}
                        </TypeCellWrapper>
                    );
                },
                enableHiding: false,
                enableSorting: false,
            }),
            col.display({
                id: 'actions',
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
                    <Actions
                        field={row.original}
                        updateField={updateField}
                        deleteField={deleteField}
                    />
                ),
                enableHiding: false,
                enableSorting: false,
            }),
        ];
    }, [updateField, deleteField, collection.warnings]);

    const table = useReactTable({
        data,
        columns,
        initialState: {
            sorting: [],
        },
        getCoreRowModel: getCoreRowModel<UserPropertyField>(),
        getSortedRowModel: getSortedRowModel<UserPropertyField>(),
        enableSortingRemoval: false,
        enableMultiSort: false,
        renderFallbackValue: '',
        meta: {
            tableId: 'userProperties',
            disablePaginationControls: true,
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
                    padding-block-end: 4px;
                    padding-block-start: 4px;

                    &:last-child {
                        padding-inline-end: 12px;
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

const Actions = ({field, deleteField}: {field: UserPropertyField} & FieldActions) => {
    const {promptDelete} = useUserPropertyFieldDelete();
    const {formatMessage} = useIntl();

    const handleDelete = () => {
        if (isCreatePending(field)) {
            // skip prompt when field is pending creation
            deleteField(field.id);
        } else {
            promptDelete(field).then(() => deleteField(field.id));
        }
    };

    return (
        <ActionsRoot>
            {field.delete_at === 0 && (
                <FieldDeleteButton
                    onClick={handleDelete}
                    aria-label={formatMessage({id: 'admin.system_properties.user_properties.table.actions.delete', defaultMessage: 'Delete'})}
                >
                    <TrashCanOutlineIcon
                        size={18}
                        color={'rgba(var(--center-channel-color-rgb), 0.64)'}
                    />
                </FieldDeleteButton>
            )}
        </ActionsRoot>
    );
};

const TypeCellWrapper = styled.div<{$deleted?: boolean}>`
    ${({$deleted}) => $deleted && css`
        && {
            color: #D24B4E;
            text-decoration: line-through;
        }
    `};

    vertical-align: middle;
    display: inline-flex;
    gap: 6px;
    align-items: center;
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

type EditableValueProps = {
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
const EditableValue = (props: EditableValueProps) => {
    const [value, setValue] = useState(props.value);

    useEffect(() => {
        setValue(props.value);
    }, [props.value]);

    return (
        <>
            <FieldInput
                type='text'
                aria-label={props.label}
                data-testid={props.testid}
                disabled={props.disabled ?? props.deleted}
                $deleted={props.deleted}
                $strong={props.strong}
                $borderless={props.borderless}
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
