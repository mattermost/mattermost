// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createColumnHelper, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef} from '@tanstack/react-table';
import type {ReactNode} from 'react';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage, useIntl} from 'react-intl';
import styled from 'styled-components';

import {PlusIcon} from '@mattermost/compass-icons/components';
import type {PropertyField} from '@mattermost/types/properties';
import type {IDMappedCollection} from '@mattermost/types/utilities';
import {collectionToArray} from '@mattermost/types/utilities';

import {DangerText, BorderlessInput, LinkButton} from './controls';
import PropertyValuesInput from './property_values_input';

import {AdminConsoleListTable} from '../list_table';

export type AttributesTableConfig<T extends PropertyField> = {
    // i18n keys
    i18n: {
        attribute: MessageDescriptor;
        type: MessageDescriptor;
        values: MessageDescriptor;
        actions: MessageDescriptor;
        addAttribute: MessageDescriptor;
        nameRequired: MessageDescriptor;
        nameUnique: MessageDescriptor;
        nameTaken: MessageDescriptor;
        attributeNameInput: MessageDescriptor;
    };
    // Validation warning IDs
    validationWarnings: {
        nameRequired: string;
        nameUnique: string;
        nameTaken: string;
    };
    // Constants
    maxNameLength: number;
    // Render functions
    renderActionsMenu: (props: {
        field: T;
        canCreate: boolean;
        createField: (field: T) => void;
        updateField: (field: T) => void;
        deleteField: (id: string) => void;
    }) => React.ReactNode;
    renderTypeSelector: (props: {
        field: T;
        updateField: (field: T) => void;
    }) => React.ReactNode;
    // Utility functions
    isCreatePending: (field: T) => boolean;
    supportsOptions: (field: T) => boolean;
    // Table ID for reordering
    tableId: string;
};

type AttributesTableProps<T extends PropertyField> = {
    data: IDMappedCollection<T>;
    canCreate: boolean;
    createField: (field: T) => void;
    updateField: (field: T) => void;
    deleteField: (id: string) => void;
    reorderField: (field: T, nextOrder: number) => void;
    config: AttributesTableConfig<T>;
};

export function AttributesTable<T extends PropertyField>({
    data: collection,
    canCreate,
    createField,
    updateField,
    deleteField,
    reorderField,
    config,
}: AttributesTableProps<T>) {
    const {formatMessage} = useIntl();
    const data = collectionToArray(collection);
    const col = createColumnHelper<T>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const columns = useMemo<Array<ColumnDef<T, any>>>(() => {
        return [
            col.accessor('name', {
                size: 180,
                header: () => {
                    return (
                        <ColHeaderLeft>
                            <FormattedMessage {...config.i18n.attribute}/>
                        </ColHeaderLeft>
                    );
                },
                cell: ({getValue, row}) => {
                    const toDelete = row.original.delete_at !== 0;
                    const warningId = collection.warnings?.[row.original.id]?.name;

                    let warning;

                    if (warningId === config.validationWarnings.nameRequired) {
                        warning = (
                            <FormattedMessage
                                tagName={DangerText}
                                {...config.i18n.nameRequired}
                            />
                        );
                    } else if (warningId === config.validationWarnings.nameUnique) {
                        warning = (
                            <FormattedMessage
                                tagName={DangerText}
                                {...config.i18n.nameUnique}
                            />
                        );
                    } else if (warningId === config.validationWarnings.nameTaken) {
                        warning = (
                            <FormattedMessage
                                tagName={DangerText}
                                {...config.i18n.nameTaken}
                            />
                        );
                    }

                    return (
                        <>
                            <EditCell
                                strong={true}
                                value={getValue()}
                                label={formatMessage(config.i18n.attributeNameInput)}
                                deleted={toDelete}
                                testid='property-field-input'
                                // eslint-disable-next-line jsx-a11y/no-autofocus
                                autoFocus={config.isCreatePending(row.original) && !config.supportsOptions(row.original)}
                                setValue={(value: string) => {
                                    updateField({...row.original, name: value.trim()} as T);
                                }}
                                maxLength={config.maxNameLength}
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
                            <FormattedMessage {...config.i18n.type}/>
                        </ColHeaderLeft>
                    );
                },
                cell: ({row}) => {
                    return config.renderTypeSelector({
                        field: row.original,
                        updateField,
                    });
                },
                enableHiding: false,
                enableSorting: false,
            }),
            col.display({
                id: 'options',
                size: 300,
                header: () => (
                    <ColHeaderLeft>
                        <FormattedMessage {...config.i18n.values}/>
                    </ColHeaderLeft>
                ),
                cell: ({row}) => (
                    <>
                        <PropertyValuesInput
                            field={row.original}
                            updateField={updateField as (field: PropertyField) => void}
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
                            <FormattedMessage {...config.i18n.actions}/>
                        </ColHeaderRight>
                    );
                },
                cell: ({row}) => (
                    <ActionsRoot>
                        {config.renderActionsMenu({
                            field: row.original,
                            canCreate,
                            createField,
                            updateField,
                            deleteField,
                        })}
                    </ActionsRoot>
                ),
                enableHiding: false,
                enableSorting: false,
            }),
        ];
    }, [col, formatMessage, createField, updateField, deleteField, collection.warnings, canCreate, config]);

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel<T>(),
        getSortedRowModel: getSortedRowModel<T>(),
        enableSortingRemoval: false,
        enableMultiSort: false,
        renderFallbackValue: '',
        meta: {
            tableId: config.tableId,
            disablePaginationControls: true,
            onReorder: (prev: number, next: number) => {
                reorderField(collection.data[collection.order[prev]], next);
            },
        },
        manualPagination: true,
    });

    return (
        <>
            <TableWrapper>
                <AdminConsoleListTable<T> table={table}/>
            </TableWrapper>
            {canCreate && (
                <LinkButton onClick={() => createField(undefined as unknown as T)}>
                    <PlusIcon size={16}/>
                    <FormattedMessage {...config.i18n.addAttribute}/>
                </LinkButton>
            )}
        </>
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
};
const EditCell = (props: EditCellProps) => {
    const [value, setValue] = useState(props.value);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setValue(props.value);
    }, [props.value]);

    // Focus and select text when autoFocus is true and component mounts
    useEffect(() => {
        if (props.autoFocus && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [props.autoFocus]);

    return (
        <>
            <BorderlessInput
                ref={inputRef}
                type='text'
                aria-label={props.label}
                data-testid={props.testid}
                disabled={props.disabled ?? props.deleted}
                $deleted={props.deleted}
                $strong={props.strong}
                maxLength={props.maxLength}
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
