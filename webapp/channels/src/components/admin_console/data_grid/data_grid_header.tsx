// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Column} from './data_grid';
import type {CSSProperties} from 'react';

import './data_grid.scss';

export type Props = {
    columns: Column[];
}

class DataGridHeader extends React.Component<Props> {
    renderHeaderElement(col: Column) {
        const style: CSSProperties = {};
        if (col.width) {
            style.flexGrow = col.width;
        }

        return (
            <div
                key={col.field}
                className='DataGrid_cell'
                style={style}
            >
                {col.name}
            </div>
        );
    }

    render() {
        return (
            <div className='DataGrid_header'>
                {this.props.columns.map((col) => this.renderHeaderElement(col))}
            </div>
        );
    }
}

export default DataGridHeader;
