// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createColumnHelper, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef} from '@tanstack/react-table';
import type {ReactNode} from 'react';
import React, {useEffect, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import styled from 'styled-components';

import {LockOutlineIcon, PlusIcon} from '@mattermost/compass-icons/components';
import {WithTooltip} from '@mattermost/shared/components/tooltip';
import {supportsOptions} from '@mattermost/types/properties';
import {type BoardsPropertyField} from '@mattermost/types/properties_board';
import {collectionToArray} from '@mattermost/types/utilities';

import LoadingScreen from 'components/loading_screen';

import BoardAttributesDotMenu from './board_attributes_dot_menu';
import SelectType from './board_attributes_type_menu';
import type {BoardPropertyFields} from './board_attributes_utils';
import {isCreatePending, useBoardPropertyFields, ValidationWarningNameRequired, ValidationWarningNameTaken, ValidationWarningNameUnique} from './board_attributes_utils';
import BoardAttributesValues from './board_attributes_values';

import {AdminConsoleListTable} from '../list_table';
import {DangerText, BorderlessInput, LinkButton} from '../system_properties/controls';
import type {SectionHook} from '../system_properties/section_utils';

import './board_attributes_drag_preview.scss';
import './board_attributes_table.scss';

const MAX_BOARD_ATTRIBUTES = 20;

const col = createColumnHelper<BoardsPropertyField>();

type FieldActions = {
    createField: (field: BoardsPropertyField) => void;
    updateField: (field: BoardsPropertyField) => void;
    deleteField: (id: string) => void;
    reorderField: (field: BoardsPropertyField, nextOrder: number) => void;
};

export const useBoardAttributesTable = (): SectionHook => {
    const [boardPropertyFields, readIO, pendingIO, itemOps] = useBoardPropertyFields();
    const nonDeletedCount = Object.values(boardPropertyFields.data).filter((f: BoardsPropertyField) => f.delete_at === 0).length;

    const canCreate = nonDeletedCount < MAX_BOARD_ATTRIBUTES;

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
            <BoardAttributesTable
                data={boardPropertyFields}
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
                        id='admin.board_attributes.add_attribute'
                        defaultMessage='Add attribute'
                    />
                </LinkButton>
            )}
        </>
    );

    return {
        content,
        loading: readIO.loading,
        hasChanges: pendingIO.hasChanges,
        isValid: !boardPropertyFields.warnings,
        save,
        cancel: pendingIO.reset,
        saving: pendingIO.saving,
        saveError: pendingIO.error,
    };
};

type Props = {
    data: BoardPropertyFields;
    canCreate: boolean;
};

export function BoardAttributesTable({
    data: collection,
    canCreate,
    createField,
    updateField,
    deleteField,
    reorderField,
}: Props & FieldActions) {
    const {formatMessage} = useIntl();
    const data = collectionToArray(collection);
    const columns = useMemo<Array<ColumnDef<BoardsPropertyField, any>>>(() => {
        return [
            col.accessor('name', {
                size: 180,
                header: () => {
                    return (
                        <ColHeaderLeft>
                            <FormattedMessage
                                id='admin.board_attributes.table.property'
                                defaultMessage='Attribute'
                            />
                        </ColHeaderLeft>
                    );
                },
                cell: ({getValue, row}) => {
                    const toDelete = row.original.delete_at !== 0;
                    const isProtected = Boolean(row.original.protected);
                    const warningId = collection.warnings?.[row.original.id]?.name;

                    let warning;

                    if (warningId === ValidationWarningNameRequired) {
                        warning = (
                            <FormattedMessage
                                tagName={DangerText}
                                id='admin.board_attributes.table.validation.name_required'
                                defaultMessage='Please enter an attribute name.'
                            />
                        );
                    } else if (warningId === ValidationWarningNameUnique) {
                        warning = (
                            <FormattedMessage
                                tagName={DangerText}
                                id='admin.board_attributes.table.validation.name_unique'
                                defaultMessage='Attribute names must be unique.'
                            />
                        );
                    } else if (warningId === ValidationWarningNameTaken) {
                        warning = (
                            <FormattedMessage
                                tagName={DangerText}
                                id='admin.board_attributes.table.validation.name_taken'
                                defaultMessage='Attribute name already taken.'
                            />
                        );
                    }

                    return (
                        <>
                            <EditCell
                                strong={true}
                                value={getValue()}
                                label={formatMessage({id: 'admin.board_attributes.table.property_name.input.name', defaultMessage: 'Attribute Name'})}
                                deleted={toDelete}
                                disabled={isProtected || toDelete}
                                testid='board-attribute-field-input'
                                autoFocus={isCreatePending(row.original) && !supportsOptions(row.original)}
                                setValue={(value: string) => {
                                    updateField({...row.original, name: value.trim()});
                                }}
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
                                id='admin.board_attributes.table.type'
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
                            id='admin.board_attributes.table.values'
                            defaultMessage='Values'
                        />
                    </ColHeaderLeft>
                ),
                cell: ({row}) => (
                    <BoardAttributesValues
                        field={row.original}
                        updateField={updateField}
                        warning={collection.warnings?.[row.original.id]?.attrs}
                        autoFocus={isCreatePending(row.original) && supportsOptions(row.original)}
                    />
                ),
                enableHiding: false,
                enableSorting: false,
            }),
            col.display({
                id: 'actions',
                size: 72,
                header: () => {
                    return (
                        <ColHeaderRight>
                            <FormattedMessage
                                id='admin.board_attributes.table.actions'
                                defaultMessage='Actions'
                            />
                        </ColHeaderRight>
                    );
                },
                cell: ({row}) => {
                    return (
                        <ActionsCell
                            field={row.original}
                            canCreate={canCreate}
                            createField={createField}
                            deleteField={deleteField}
                        />
                    );
                },
                enableHiding: false,
                enableSorting: false,
            }),
        ];
    }, [createField, updateField, deleteField, collection.warnings, canCreate]);

    const table = useReactTable<BoardsPropertyField>({
        data,
        columns,
        getCoreRowModel: getCoreRowModel<BoardsPropertyField>(),
        getSortedRowModel: getSortedRowModel<BoardsPropertyField>(),
        enableSortingRemoval: false,
        enableMultiSort: false,
        renderFallbackValue: '',
        meta: {
            tableId: 'boardAttributes',
            disablePaginationControls: true,
            onReorder: (prev: number, next: number) => {
                reorderField(collection.data[collection.order[prev]], next);
            },
            isRowDragDisabled: (rowId: string) => Boolean(collection.data[rowId]?.protected),
            getRowDragPreview: (rowId: string) => {
                const name = collection.data[rowId]?.name;
                if (!name) {
                    return undefined;
                }
                const node = document.createElement('div');
                node.className = 'BoardAttributes__dragPreview';
                node.textContent = name;
                return node;
            },
        },
        manualPagination: true,
    });

    return (
        <div className='BoardAttributesTable'>
            <AdminConsoleListTable<BoardsPropertyField> table={table}/>
        </div>
    );
}

const ColHeaderLeft = styled.div`
    display: inline-block;
`;

const ColHeaderRight = styled.div`
    display: inline-block;
    width: 100%;
    text-align: right;
`;

const ActionsRoot = styled.div`
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;
`;

const ProtectedLock = styled.span`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

type ActionsCellProps = {
    field: BoardsPropertyField;
    canCreate: boolean;
    createField: (field: BoardsPropertyField) => void;
    deleteField: (id: string) => void;
};

const ActionsCell = ({field, canCreate, createField, deleteField}: ActionsCellProps) => {
    const {formatMessage} = useIntl();
    return (
        <ActionsRoot>
            {field.protected && (
                <WithTooltip
                    title={formatMessage({
                        id: 'admin.board_attributes.table.actions.protected_tooltip',
                        defaultMessage: 'System attribute — cannot be modified',
                    })}
                >
                    <ProtectedLock aria-hidden={false}>
                        <LockOutlineIcon size={18}/>
                    </ProtectedLock>
                </WithTooltip>
            )}
            <BoardAttributesDotMenu
                field={field}
                canCreate={canCreate}
                createField={createField}
                deleteField={deleteField}
            />
        </ActionsRoot>
    );
};

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

    useEffect(() => {
        setValue(props.value);
    }, [props.value]);

    return (
        <>
            <BorderlessInput
                type='text'
                aria-label={props.label}
                data-testid={props.testid}
                disabled={props.disabled || props.deleted}
                $deleted={props.deleted}
                $strong={props.strong}
                maxLength={props.maxLength}
                autoFocus={props.autoFocus}
                onFocus={(e: React.FocusEvent<HTMLInputElement>) => {
                    if (props.autoFocus) {
                        e.target.select();
                    }
                }}
                value={value}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
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
