// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {AppField} from '@mattermost/types/apps';

import {AppFieldTypes} from 'mattermost-redux/constants/apps';

type Props = {

    // The container field, whose collapsible_config.fields are the rows.
    field: AppField;

    // Renders one leaf field. Supplied by AppsFormComponent so the cells share
    // its values and field errors, and so the sanitized-field cache that keeps
    // AsyncSelect from remounting still applies.
    renderCell: (field: AppField, autoFocus: boolean) => React.ReactNode;

    // Names excluded from the grid (the form's submit buttons field).
    excludeName?: string;
};

// A row is a child collapsible; its own children are the cells. Anything else
// among the container's children is a leaf and cannot be a row, so it is
// rendered underneath the table rather than silently dropped.
const isRow = (child: AppField) => child.type === AppFieldTypes.COLLAPSIBLE;

// Every child of a row becomes a cell, including a nested collapsible, which
// renders as an ordinary section inside its cell. Filtering by type here would
// make a nested section disappear without a trace.
const cellFields = (row: AppField, excludeName?: string): AppField[] =>
    (row.collapsible_config?.fields || []).filter((f) => f.name !== excludeName);

// AppsFormGrid lays a collapsible's child sections out as table rows, one
// column per child field.
//
// The row's first field is its header: it renders in a sticky <th> so it stays
// visible while the rest of the row scrolls, and it stays editable, because a
// record's identifier is usually something the user is filling in too. Its own
// DisplayName is the leftmost column heading, so there is no separate static
// label duplicating a value that already has a cell.
//
// The container's DisplayName is not shown in grid mode; it is the section
// title if the same form is rendered stacked.
//
// Column headers come from the first row, so every row is expected to hold the
// same fields in the same order. A row with fewer cells is padded rather than
// shifted, which keeps a short row from silently landing under the wrong
// column.
//
// Cell labels are not removed, only visually hidden by
// .apps-form-grid__cell (the column header carries the visible text), so the
// inputs stay labelled for screen readers.
const AppsFormGrid = ({field, renderCell, excludeName}: Props) => {
    const children = (field.collapsible_config?.fields || []).filter((f) => f.name !== excludeName);
    const rows = children.filter(isRow);
    const strays = children.filter((child) => !isRow(child));

    if (rows.length === 0) {
        // Nothing to lay out as a grid; fall back to rendering whatever is
        // there so a misconfigured form still shows its fields.
        return <>{children.map((child, i) => renderCell(child, i === 0))}</>;
    }

    const columns = cellFields(rows[0], excludeName).map((cell) => cell.label || cell.name);

    return (
        <div className='apps-form-grid'>
            <div className='apps-form-grid__scroll'>
                <table className='apps-form-grid__table'>
                    <thead>
                        <tr>
                            {columns.map((label, columnIndex) => (
                                <th
                                    key={label}
                                    scope='col'
                                    className={columnIndex === 0 ? 'apps-form-grid__corner' : undefined}
                                >
                                    {label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, rowIndex) => {
                            const cells = cellFields(row, excludeName);
                            return (
                                <tr key={row.name}>
                                    {columns.map((_, columnIndex) => {
                                        const cell = cells[columnIndex];
                                        const content = cell ? renderCell(cell, rowIndex === 0 && columnIndex === 0) : null;

                                        // The first column is the row header, so it is a <th
                                        // scope='row'> rather than a <td>, but it holds a real
                                        // field and is styled like any other cell.
                                        if (columnIndex === 0) {
                                            return (
                                                <th
                                                    key={row.name + '-' + columnIndex}
                                                    scope='row'
                                                    className='apps-form-grid__cell apps-form-grid__row-header'
                                                >
                                                    {content}
                                                </th>
                                            );
                                        }

                                        return (
                                            <td
                                                key={row.name + '-' + columnIndex}
                                                className='apps-form-grid__cell'
                                            >
                                                {content}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {strays.map((child) => renderCell(child, false))}
        </div>
    );
};

export default AppsFormGrid;
