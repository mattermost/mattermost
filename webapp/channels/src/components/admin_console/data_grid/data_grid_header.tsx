// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {CSSProperties} from 'react';

import type {Column} from './data_grid';

import './data_grid.scss';

export type Props = {
    columns: Column[];
}


const DataGridHeader: React.FC<Props> = ({ columns }: Props) => {
    const renderHeaderElement = (col: Column) => {
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
    };

    return (
        <div className='DataGrid_header'>
            {columns.map((col) => renderHeaderElement(col))}
        </div>
    );
};

export default DataGridHeader;
