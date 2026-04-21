// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createColumnHelper, getCoreRowModel, useReactTable} from '@tanstack/react-table';
import type {ColumnDef} from '@tanstack/react-table';
import React, {useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {TrashCanOutlineIcon} from '@mattermost/compass-icons/components';

import LevelColorCell from './level_color_cell';
import LevelNameCell from './level_name_cell';

import {AdminConsoleListTable} from '../../list_table';
import {
    ActionsCell,
    ColHeaderLeft,
    ColorCellWrapper,
    ColorSwatch,
    DeleteButton,
    RankCell,
    ReadOnlyColor,
    TableWrapper,
} from '../classification_markings_styled';
import type {ClassificationLevel} from '../utils/presets';

type ClassificationLevelsTableProps = {
    levels: ClassificationLevel[];
    updateLevel: (id: string, updates: Partial<ClassificationLevel>) => void;
    deleteLevel: (id: string) => void;
    onReorder: (prev: number, next: number) => void;
    disabled?: boolean;
    reorderDisabled?: boolean;
    lockedLevelId?: string;
    lockedLevelTooltip?: string;
};

export default function ClassificationLevelsTable({levels, updateLevel, deleteLevel, onReorder, disabled, reorderDisabled, lockedLevelId, lockedLevelTooltip}: ClassificationLevelsTableProps) {
    const {formatMessage} = useIntl();

    const rows = useMemo(() => {
        return [...levels].sort((a, b) => a.rank - b.rank);
    }, [levels]);

    const col = createColumnHelper<ClassificationLevel>();

    const columns = useMemo<Array<ColumnDef<ClassificationLevel, any>>>(() => {
        return [
            col.accessor('name', {
                size: 400,
                header: () => (
                    <ColHeaderLeft>
                        <FormattedMessage
                            id='admin.classification_markings.levels.table.text'
                            defaultMessage='Text'
                        />
                    </ColHeaderLeft>
                ),
                cell: ({row}) => (
                    <LevelNameCell
                        value={row.original.name}
                        id={row.original.id}
                        updateLevel={updateLevel}
                        disabled={disabled}
                        label={formatMessage({id: 'admin.classification_markings.levels.table.text.input', defaultMessage: 'Classification level name'})}
                    />
                ),
                enableSorting: false,
            }),
            col.accessor('color', {
                size: 180,
                header: () => (
                    <ColHeaderLeft>
                        <FormattedMessage
                            id='admin.classification_markings.levels.table.color'
                            defaultMessage='Color'
                        />
                    </ColHeaderLeft>
                ),
                cell: ({row}) => (
                    <ColorCellWrapper>
                        {disabled ? (
                            <ReadOnlyColor>
                                <ColorSwatch style={{backgroundColor: row.original.color}}/>
                                <span>{row.original.color}</span>
                            </ReadOnlyColor>
                        ) : (
                            <LevelColorCell
                                id={row.original.id}
                                value={row.original.color}
                                updateLevel={updateLevel}
                                swatchAriaLabel={formatMessage({id: 'admin.classification_markings.color.open_picker', defaultMessage: 'Open color picker'})}
                            />
                        )}
                    </ColorCellWrapper>
                ),
                enableSorting: false,
            }),
            col.accessor('rank', {
                size: 60,
                header: () => (
                    <ColHeaderLeft>
                        <FormattedMessage
                            id='admin.classification_markings.levels.table.rank'
                            defaultMessage='Rank'
                        />
                    </ColHeaderLeft>
                ),
                cell: ({row}) => (
                    <RankCell>{row.original.rank}</RankCell>
                ),
                enableSorting: false,
            }),
            ...(disabled ? [] : [col.display({
                id: 'actions',
                size: 40,
                header: () => null,
                cell: ({row}) => {
                    const isLockedLevel = lockedLevelId && row.original.id === lockedLevelId;
                    return (
                        <ActionsCell>
                            <DeleteButton
                                aria-label={formatMessage({id: 'admin.classification_markings.levels.table.delete', defaultMessage: 'Delete level'})}
                                onClick={() => !isLockedLevel && deleteLevel(row.original.id)}
                                disabled={Boolean(isLockedLevel)}
                                title={isLockedLevel ? lockedLevelTooltip : undefined}
                            >
                                <TrashCanOutlineIcon
                                    size={18}
                                    color={isLockedLevel ? 'rgba(var(--center-channel-color-rgb), 0.32)' : '#D24B4E'}
                                />
                            </DeleteButton>
                        </ActionsCell>
                    );
                },
                enableSorting: false,
            })]),
        ];
    }, [col, updateLevel, deleteLevel, disabled, formatMessage, lockedLevelId, lockedLevelTooltip]);

    const table = useReactTable<ClassificationLevel>({
        data: rows,
        columns,
        getCoreRowModel: getCoreRowModel<ClassificationLevel>(),
        enableSortingRemoval: false,
        enableMultiSort: false,
        renderFallbackValue: '',
        meta: {
            tableId: 'classificationLevels',
            disablePaginationControls: true,
            ...(!disabled && !reorderDisabled && {onReorder}),
        },
        manualPagination: true,
    });

    return (
        <TableWrapper>
            <AdminConsoleListTable<ClassificationLevel> table={table}/>
        </TableWrapper>
    );
}
