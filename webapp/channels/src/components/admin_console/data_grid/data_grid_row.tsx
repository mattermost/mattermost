// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {CSSProperties} from 'react';

import type {Row, Column} from './data_grid';

import './data_grid.scss';

type Props = {
    columns: Column[];
    row: Row;
}

class DataGridRow extends React.Component<Props> {
    renderCell(row: Row, column: Column) {
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
                style={style}
            >
                {row.cells[column.field]}
            </div>
        );
    }

    render() {
        const cells = this.props.columns.map((col) => this.renderCell(this.props.row, col));
        return (
            <div
                className='DataGrid_row'
                onClick={this.props.row.onClick}
            >
                {cells}
            </div>
        );
    }
}

export default DataGridRow;
