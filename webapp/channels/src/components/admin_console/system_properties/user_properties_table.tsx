// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createColumnHelper, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef} from '@tanstack/react-table';
import React, {useEffect, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import styled, {css} from 'styled-components';

import {TrashCanOutlineIcon} from '@mattermost/compass-icons/components';
import type {UserPropertyField} from '@mattermost/types/properties';

import {FieldDeleteButton, FieldInput} from './controls';
import {useUserPropertyFieldDelete} from './user_properties_delete_modal';
import {isCreatePending} from './user_properties_utils';

import {AdminConsoleListTable} from '../list_table';

type Props = {
    data: UserPropertyField[];
    updateField: (field: UserPropertyField) => void;
};

export function SharedChannelRemotesTable({data, updateField}: Props) {
    const col = createColumnHelper<UserPropertyField>();

    const columns = useMemo<Array<ColumnDef<UserPropertyField, any>>>(() => {
        return [
            col.accessor('name', {
                header: () => {
                    return (
                        <ColHeaderLeft>
                            <FormattedMessage
                                id='admin.user_properties.table.name'
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
                                id='admin.user_properties.table.type'
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
                                id='admin.user_properties.table.actions'
                                defaultMessage='Actions'
                            />
                        </ColHeaderRight>
                    );
                },
                cell: ({row}) => (
                    <Actions
                        field={row.original}
                        updateField={updateField}
                    />
                ),
                enableHiding: false,
                enableSorting: false,
            }),
        ];
    }, [updateField]);

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

const Actions = ({field, updateField}: {field: UserPropertyField; updateField: (field: UserPropertyField) => void}) => {
    const {promptDelete} = useUserPropertyFieldDelete();
    const {formatMessage} = useIntl();

    const handleDelete = () => {
        if (isCreatePending(field)) {
            // skip prompt when field is pending creation
            updateField({...field, delete_at: Date.now()});
        } else {
            promptDelete(field).then(() => updateField({...field, delete_at: Date.now()}));
        }
    };

    return (
        <ActionsRoot>
            {field.delete_at === 0 && (
                <FieldDeleteButton
                    onClick={handleDelete}
                    aria-label={formatMessage({id: 'admin.user_properties.table.actions.delete', defaultMessage: 'Delete'})}
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
