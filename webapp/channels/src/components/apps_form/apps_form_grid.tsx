// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {AppField} from '@mattermost/types/apps';

import {AppFieldTypes} from 'mattermost-redux/constants/apps';

type Props = {

    // The container field, whose collapsible_config.fields are the rows.
    field: AppField;

    // The container's display name. It is the section heading drawn around the
    // grid, and it is repeated here as the table's accessible name so the table
    // is announced as something rather than as an unnamed one.
    label: string;

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
// column per child field. The heading, caret and border around it are the
// ordinary CollapsibleSection the stacked layout uses; only the arrangement of
// the children differs.
//
// The row's first field is its header: it renders in a sticky <th> so it stays
// visible while the rest of the row scrolls, and it stays editable, because a
// record's identifier is usually something the user is filling in too. Its own
// DisplayName is the leftmost column heading, so there is no separate static
// label duplicating a value that already has a cell.
//
// Cells are matched to columns by position, not by name: a cell's name is
// unique per row (that is what lets a per-cell error address one input), so
// there is nothing to align on but order. Every row is therefore expected to
// hold the same fields in the same order, and a row that omits one in the
// middle shifts the fields after it a column to the left. A row that is merely
// short is padded on the right, and a row longer than the first widens the
// table instead of having its extra cells dropped.
//
// Cell labels are not removed, only visually hidden by
// .apps-form-grid__cell (the column header carries the visible text), so the
// inputs stay labelled for screen readers. An error returned for a cell is not
// part of that label and renders in the cell, under its input.
const AppsFormGrid = ({field, label, renderCell, excludeName}: Props) => {
    const children = (field.collapsible_config?.fields || []).filter((f) => f.name !== excludeName);
    const rows = children.filter(isRow);
    const strays = children.filter((child) => !isRow(child));

    const rowCells = rows.map((row) => cellFields(row, excludeName));

    // The table is as wide as the widest row, not as wide as the first one. A
    // cell past the first row's width is still a real field: it is seeded into
    // the form's values and checked on submit like any other. Dropping it would
    // mean a required cell could block submission with an error that has
    // nowhere to render, leaving a dialog that will not submit and will not say
    // why. For a well-formed grid every row is the same width and this is
    // exactly the first row's columns.
    const columnCount = rowCells.length ? Math.max(...rowCells.map((cells) => cells.length)) : 0;

    // No rows, or rows that are all empty: either way there is no table to draw.
    // Fall back to rendering whatever is there, so a misconfigured form still
    // shows its fields instead of an empty table.
    if (columnCount === 0) {
        return <>{children.map((child, i) => renderCell(child, i === 0))}</>;
    }

    // A heading comes from the first row that actually has a cell in that
    // position, which is the first row unless that row is short. The React key
    // carries the column index as well as the cell name, because two cells in
    // one row may share a name in a misconfigured grid and duplicate keys would
    // cost a row its cells.
    const columns = Array.from({length: columnCount}, (_, columnIndex) => {
        const source = rowCells.find((cells) => cells[columnIndex])?.[columnIndex];
        return {
            label: source ? (source.label || source.name) : '',
            key: (source ? source.name : 'column') + '-' + columnIndex,

            // Each cell keeps its own required marker, but that marker lives in
            // the cell's label, which is clipped here. The heading is the only
            // visible text a column has, so it carries the marker too —
            // otherwise a required cell looks optional until submission fails.
            required: Boolean(source?.is_required),
        };
    });

    return (
        <div className='apps-form-grid'>
            <div className='apps-form-grid__scroll'>
                <table className='apps-form-grid__table'>

                    {/* The section heading is already on screen above the
                        table, so the caption only has to name the table for
                        assistive technology. */}
                    <caption className='sr-only'>{label}</caption>
                    <thead>
                        <tr>
                            {columns.map((column, columnIndex) => (
                                <th
                                    key={column.key}
                                    scope='col'
                                    className={columnIndex === 0 ? 'apps-form-grid__corner' : undefined}
                                >
                                    {column.label}
                                    {column.required && <span className='error-text'>{' *'}</span>}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, rowIndex) => (
                            <tr key={row.name + '-' + rowIndex}>
                                {columns.map((column, columnIndex) => {
                                    const cell = rowCells[rowIndex][columnIndex];
                                    const content = cell ? renderCell(cell, rowIndex === 0 && columnIndex === 0) : null;

                                    // The first column is the row header, so it is a <th
                                    // scope='row'> rather than a <td>, but it holds a real
                                    // field and is styled like any other cell. The row's own
                                    // DisplayName leads it, hidden from sight because the
                                    // cell beneath it usually carries the same identifier,
                                    // and kept in the DOM because it is what names the row
                                    // when a screen reader reads out the cells along it.
                                    if (columnIndex === 0) {
                                        return (
                                            <th
                                                key={row.name + '-' + column.key}
                                                scope='row'
                                                className='apps-form-grid__cell apps-form-grid__row-header'
                                            >
                                                {row.label && <span className='sr-only'>{row.label}</span>}
                                                {content}
                                            </th>
                                        );
                                    }

                                    return (
                                        <td
                                            key={row.name + '-' + column.key}
                                            className='apps-form-grid__cell'
                                        >
                                            {content}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {strays.map((child) => renderCell(child, false))}
        </div>
    );
};

export default AppsFormGrid;
