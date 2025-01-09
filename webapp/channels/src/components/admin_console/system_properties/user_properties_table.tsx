// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createColumnHelper, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef} from '@tanstack/react-table';
import React, {useEffect, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import styled, {css} from 'styled-components';

import {PlusIcon, TrashCanOutlineIcon} from '@mattermost/compass-icons/components';
import type {UserPropertyField} from '@mattermost/types/properties';
import {collectionToArray} from '@mattermost/types/utilities';

import LoadingScreen from 'components/loading_screen';

import {FieldDeleteButton, FieldInput, LinkButton} from './controls';
import type {SectionHook} from './section_utils';
import {useUserPropertyFieldDelete} from './user_properties_delete_modal';
import {isCreatePending, useUserPropertyFields} from './user_properties_utils';

import {AdminConsoleListTable} from '../list_table';

type Props = {
    data: UserPropertyField[];
}

type FieldActions = {
    updateField: (field: UserPropertyField) => void;
    deleteField: (id: string) => void;
}

export const useUserPropertiesTable = (): SectionHook => {
    const [userPropertyFields, readIO, pendingIO, itemOps] = useUserPropertyFields();

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
            <SharedChannelRemotesTable
                data={collectionToArray(userPropertyFields)}
                updateField={itemOps.update}
                deleteField={itemOps.delete}
            />
            <LinkButton onClick={itemOps.create}>
                <PlusIcon size={16}/>
                <FormattedMessage
                    id='admin.system_properties.user_properties.add_property'
                    defaultMessage='Add property'
                />
            </LinkButton>
        </>
    );

    return {
        content,
        loading: readIO.loading,
        hasChanges: pendingIO.hasChanges,
        save,
        cancel: pendingIO.reset,
        saving: pendingIO.saving,
        saveError: pendingIO.error,
    };
};

export function SharedChannelRemotesTable({data, updateField, deleteField}: Props & FieldActions) {
    const col = createColumnHelper<UserPropertyField>();

    const columns = useMemo<Array<ColumnDef<UserPropertyField, any>>>(() => {
        return [
            col.accessor('name', {
                header: () => {
                    return (
                        <ColHeaderLeft>
                            <FormattedMessage
                                id='admin.system_properties.user_properties.table.name'
                                defaultMessage='Name'
                            />
                        </ColHeaderLeft>
                    );
                },
                cell: ({getValue, row}) => (
                    <EditableValue
                        value={getValue()}
                        deleted={row.original.delete_at !== 0}
                        setValue={(value: string) => {
                            updateField({...row.original, name: value});
                        }}
                    />
                ),
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
                cell: ({getValue, row}) => (
                    <TypeCellWrapper $deleted={row.original.delete_at !== 0}>
                        {getValue()}
                    </TypeCellWrapper>
                ),
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
    }, [updateField, deleteField]);

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
            border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
        }

        tbody {
            tr {
                border-top: none;
                td {
                    padding-block-end: 8px;
                    padding-block-start: 8px;
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
                    <TrashCanOutlineIcon size={18}/>
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

const EditableValue = (props: {value: string; setValue: (value: string) => void; disabled?: boolean; deleted?: boolean}) => {
    const [value, setValue] = useState(props.value);

    useEffect(() => {
        setValue(props.value);
    }, [props.value]);

    return (
        <FieldInput
            type='text'
            data-testid='property-field-input'
            disabled={props.disabled ?? props.deleted}
            $deleted={props.deleted}
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
    );
};
