// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createColumnHelper, getCoreRowModel, useReactTable} from '@tanstack/react-table';
import type {ColumnDef} from '@tanstack/react-table';
import React, {createContext, useContext, useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {TrashCanOutlineIcon} from '@mattermost/compass-icons/components';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import OptionRemovalErrors from 'components/admin_console/global_attributes/attribute_details/option_removal_errors';
import type {OptionRemovalGuard} from 'components/admin_console/global_attributes/attribute_details/use_option_removal_guard';

import LevelColorCell from './level_color_cell';
import LevelNameCell from './level_name_cell';

import {AdminConsoleListTable} from '../../list_table';
import {
    ActionsCell,
    ColHeaderLeft,
    ColorCellWrapper,
    ColorSwatch,
    DeleteButton,
    LevelRemovalError,
    RankCell,
    ReadOnlyColor,
    TableWrapper,
} from '../classification_markings_styled';
import type {ClassificationLevel} from '../utils/presets';
import {isPendingLevel} from '../utils/presets';

type ClassificationLevelsTableProps = {
    levels: ClassificationLevel[];
    updateLevel: (id: string, updates: Partial<ClassificationLevel>) => void;
    deleteLevel: (id: string) => void;

    // Present when removing a saved level must first check that channels do not use it.
    removalGuard?: OptionRemovalGuard;
    onReorder: (prev: number, next: number) => void;
    disabled?: boolean;
};

const col = createColumnHelper<ClassificationLevel>();

// The guard changes whenever a check starts or ends. Cells read it from context
// so the columns stay stable and their cells are not remounted.
const RemovalGuardContext = createContext<OptionRemovalGuard | undefined>(undefined);

function LevelRemovalMessage({level}: {level: ClassificationLevel}) {
    const guard = useContext(RemovalGuardContext);
    if (!guard) {
        return null;
    }
    return (
        <LevelRemovalError>
            <OptionRemovalErrors
                options={[level]}
                guard={guard}
                className='ClassificationLevels__removalError'
            />
        </LevelRemovalError>
    );
}

function DeleteLevelButton({id, label, deleteLevel}: {id: string; label: string; deleteLevel: (id: string) => void}) {
    const guard = useContext(RemovalGuardContext);
    return (
        <WithTooltip title={label}>
            <DeleteButton
                aria-label={label}
                onClick={() => deleteLevel(id)}
                disabled={guard?.isChecking(id)}
            >
                <TrashCanOutlineIcon
                    size={18}
                    color='var(--error-text)'
                />
            </DeleteButton>
        </WithTooltip>
    );
}

export default function ClassificationLevelsTable({levels, updateLevel, deleteLevel, removalGuard, onReorder, disabled}: ClassificationLevelsTableProps) {
    const {formatMessage} = useIntl();

    const rows = useMemo(() => {
        return [...levels].sort((a, b) => a.rank - b.rank);
    }, [levels]);

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
                    <>
                        <LevelNameCell
                            value={row.original.name}
                            id={row.original.id}
                            updateLevel={updateLevel}
                            disabled={disabled}
                            autoFocus={isPendingLevel(row.original)}
                            label={formatMessage({id: 'admin.classification_markings.levels.table.text.input', defaultMessage: 'Classification level name'})}
                        />
                        <LevelRemovalMessage level={row.original}/>
                    </>
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
                cell: ({row}) => (
                    <ActionsCell>
                        <DeleteLevelButton
                            id={row.original.id}
                            label={formatMessage({id: 'admin.classification_markings.levels.table.delete', defaultMessage: 'Delete level'})}
                            deleteLevel={deleteLevel}
                        />
                    </ActionsCell>
                ),
                enableSorting: false,
            })]),
        ];
    }, [updateLevel, deleteLevel, disabled, formatMessage]);

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
            onReorder,
        },
        manualPagination: true,
    });

    return (
        <RemovalGuardContext.Provider value={removalGuard}>
            <TableWrapper>
                <AdminConsoleListTable<ClassificationLevel> table={table}/>
            </TableWrapper>
        </RemovalGuardContext.Provider>
    );
}
