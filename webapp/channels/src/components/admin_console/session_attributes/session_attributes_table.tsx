// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createColumnHelper, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef} from '@tanstack/react-table';
import type {ComponentType, CSSProperties} from 'react';
import React, {useMemo} from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';

import {CheckboxMarkedCircleOutlineIcon, ChevronDownCircleOutlineIcon, MenuVariantIcon} from '@mattermost/compass-icons/components';
import type IconProps from '@mattermost/compass-icons/components/props';

import PlatformIcons from './platform_icons';
import SessionAttributesDotMenu from './session_attributes_dot_menu';
import StatusChip from './status_chip';
import type {StagedAttrs} from './use_session_attribute_edits';
import type {SessionAttributeDisplayType, SessionAttributeField} from './utils';
import {formatDuration, getDisplayType, getSessionAttrs, getSessionDisplayName, isServerSourced} from './utils';

import {AdminConsoleListTable} from '../list_table';

import './session_attributes.scss';

const columnHelper = createColumnHelper<SessionAttributeField>();

const TYPE_ICONS: Record<SessionAttributeDisplayType, ComponentType<IconProps>> = {
    String: MenuVariantIcon,
    Boolean: CheckboxMarkedCircleOutlineIcon,
    Enum: ChevronDownCircleOutlineIcon,
};

type Props = {
    data: SessionAttributeField[];
    onStageChange: (fieldId: string, partial: StagedAttrs) => void;
    disabled?: boolean;
};

export default function SessionAttributesTable({data, onStageChange, disabled = false}: Props) {
    const rows = useMemo(
        () => [...data].sort((a, b) => ((a.attrs?.sort_order ?? 0) - (b.attrs?.sort_order ?? 0)) || a.name.localeCompare(b.name)),
        [data],
    );

    const columns = useMemo<Array<ColumnDef<SessionAttributeField, any>>>(() => {
        return [
            columnHelper.accessor((row) => getSessionDisplayName(row), {
                id: 'display_name',
                size: 200,
                header: () => (
                    <div className='SessionAttributes__col-header'>
                        <FormattedMessage
                            id='admin.session_attributes.table.display_name'
                            defaultMessage='Display Name'
                        />
                    </div>
                ),
                cell: ({getValue}) => (
                    <span
                        className='SessionAttributes__display-name'
                        data-testid='session-attribute-display-name'
                    >
                        {getValue()}
                    </span>
                ),
                enableHiding: false,
                enableSorting: false,
            }),
            columnHelper.accessor('name', {
                size: 180,
                header: () => (
                    <div className='SessionAttributes__col-header'>
                        <FormattedMessage
                            id='admin.session_attributes.table.name'
                            defaultMessage='Name'
                        />
                    </div>
                ),
                cell: ({getValue, row}) => (
                    <span className='SessionAttributes__name-cell'>
                        <span className='SessionAttributes__name-text'>{getValue()}</span>
                        {isServerSourced(row.original.name) && (
                            <span
                                className='SessionAttributes__server-badge'
                                data-testid='session-attribute-server-label'
                            >
                                <FormattedMessage
                                    id='admin.session_attributes.table.server_label'
                                    defaultMessage='Server'
                                />
                            </span>
                        )}
                    </span>
                ),
                enableHiding: false,
                enableSorting: false,
            }),
            columnHelper.accessor((row) => getDisplayType(row), {
                id: 'type',
                size: 120,
                header: () => (
                    <div className='SessionAttributes__col-header'>
                        <FormattedMessage
                            id='admin.session_attributes.table.type'
                            defaultMessage='Type'
                        />
                    </div>
                ),
                cell: ({getValue}) => {
                    const displayType = getValue<SessionAttributeDisplayType>();
                    const Icon = TYPE_ICONS[displayType];

                    return (
                        <span
                            className='SessionAttributes__type-cell'
                            data-testid='session-attribute-type'
                        >
                            <Icon size={16}/>
                            <FormattedMessage {...typeLabels[displayType]}/>
                        </span>
                    );
                },
                enableHiding: false,
                enableSorting: false,
            }),
            columnHelper.display({
                id: 'platform',
                size: 120,
                header: () => (
                    <div className='SessionAttributes__col-header'>
                        <FormattedMessage
                            id='admin.session_attributes.table.platform'
                            defaultMessage='Platform'
                        />
                    </div>
                ),
                cell: ({row}) => (
                    <PlatformIcons platforms={getSessionAttrs(row.original).platforms}/>
                ),
                enableHiding: false,
                enableSorting: false,
            }),
            columnHelper.display({
                id: 'ttl',
                size: 80,
                header: () => (
                    <div className='SessionAttributes__col-header'>
                        <FormattedMessage
                            id='admin.session_attributes.table.ttl'
                            defaultMessage='TTL'
                        />
                    </div>
                ),
                cell: ({row}) => (
                    <span
                        className='SessionAttributes__duration'
                        data-testid='session-attribute-ttl'
                    >
                        {formatDuration(getSessionAttrs(row.original).ttl_seconds)}
                    </span>
                ),
                enableHiding: false,
                enableSorting: false,
            }),
            columnHelper.display({
                id: 'grace',
                size: 80,
                header: () => (
                    <div className='SessionAttributes__col-header'>
                        <FormattedMessage
                            id='admin.session_attributes.table.grace'
                            defaultMessage='Grace'
                        />
                    </div>
                ),
                cell: ({row}) => (
                    <span
                        className='SessionAttributes__duration'
                        data-testid='session-attribute-grace'
                    >
                        {formatDuration(getSessionAttrs(row.original).grace_period_seconds)}
                    </span>
                ),
                enableHiding: false,
                enableSorting: false,
            }),
            columnHelper.display({

                // Not named 'status' because that class name collides with the
                // global user status indicator styles (see _status-icon.scss),
                // which add unwanted margin to this column.
                id: 'sessionStatus',
                size: 104,
                header: () => (
                    <div className='SessionAttributes__col-header'>
                        <FormattedMessage
                            id='admin.session_attributes.table.status'
                            defaultMessage='Status'
                        />
                    </div>
                ),
                cell: ({row}) => (
                    <StatusChip enabled={getSessionAttrs(row.original).enabled}/>
                ),
                enableHiding: false,
                enableSorting: false,
            }),
            columnHelper.display({
                id: 'actions',
                size: 56,
                header: () => (
                    <div className='SessionAttributes__col-header SessionAttributes__col-header--right'>
                        <FormattedMessage
                            id='admin.session_attributes.table.actions'
                            defaultMessage='Actions'
                        />
                    </div>
                ),
                cell: ({row}) => (
                    <div className='SessionAttributes__actions'>
                        <SessionAttributesDotMenu
                            field={row.original}
                            onStageChange={onStageChange}
                            disabled={disabled}
                        />
                    </div>
                ),
                enableHiding: false,
                enableSorting: false,
            }),
        ];
    }, [onStageChange, disabled]);

    const table = useReactTable<SessionAttributeField>({
        data: rows,
        columns,
        getCoreRowModel: getCoreRowModel<SessionAttributeField>(),
        getSortedRowModel: getSortedRowModel<SessionAttributeField>(),
        enableSortingRemoval: false,
        enableMultiSort: false,
        renderFallbackValue: '',
        meta: {tableId: 'sessionAttributes', disablePaginationControls: true},
        manualPagination: true,
        enableColumnPinning: false,
    });

    return (
        <div
            className='SessionAttributes__table-wrapper'
            style={{'--session-attributes-table-min-width': `${table.getTotalSize()}px`} as CSSProperties}
        >
            <AdminConsoleListTable<SessionAttributeField> table={table}/>
        </div>
    );
}

const typeLabels = defineMessages({
    String: {id: 'admin.session_attributes.type.string', defaultMessage: 'String'},
    Boolean: {id: 'admin.session_attributes.type.boolean', defaultMessage: 'Boolean'},
    Enum: {id: 'admin.session_attributes.type.enum', defaultMessage: 'Enum'},
});
