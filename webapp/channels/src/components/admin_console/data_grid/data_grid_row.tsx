// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {CSSProperties} from 'react';

import type {Row, Column} from './data_grid';

import './data_grid.scss';

type DataGridRowProps = {
    columns: Column[];
    row: Row;
    testIdScope?: string;
    testKey?: string;
};

type DataGridCellProps = {
    testIdScope?: string;
    column: Column;
    row: Row;
};

const DataGridCell = ({row, column, testIdScope}: DataGridCellProps) => {
    const style: CSSProperties = {};
    if (column.width) {
        style.flexGrow = column.width;
    }

    if (column.textAlign) {
        style.textAlign = column.textAlign;
    }

    if (column.overflow) {
        style.overflow = column.overflow;
    }

    return (
        <div
            key={column.field}
            className={classNames('DataGrid_cell', column.className)}
            role='cell'
            data-testid={testIdScope ? `${testIdScope}.row.cell:${column.field}--text` : undefined}
            style={style}
        >
            {row.cells[column.field]}
        </div>
    );
};

const DataGridRow = ({row, columns, testIdScope, testKey}: DataGridRowProps) => {
    const cells = columns.map((column, index) => (
        <DataGridCell
            key={index}
            row={row}
            column={column}
            testIdScope={testIdScope}
        />
    ));
    return (
        <div
            className='DataGrid_row'
            role='row'
            data-testid={testIdScope && testKey ? `${testIdScope}.row:${testKey}--row` : undefined}
            onClick={row.onClick}
        >
            {cells}
        </div>
    );
};

export default React.memo(DataGridRow);
