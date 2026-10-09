// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {AppField} from '@mattermost/types/apps';

import {AppFieldTypes} from 'mattermost-redux/constants/apps';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import AppsFormGrid from './apps_form_grid';

describe('AppsFormGrid', () => {
    // cell builds one leaf field, the thing that ends up in a <td>.
    const cell = (name: string, label?: string): AppField => ({
        name,
        type: AppFieldTypes.TEXT,
        label,
    });

    // row builds a child collapsible, which is what the grid treats as a row.
    const row = (name: string, cells: AppField[]): AppField => ({
        name,
        type: AppFieldTypes.COLLAPSIBLE,
        label: name,
        collapsible_config: {fields: cells},
    });

    // container builds the grid field itself: the collapsible whose children
    // are rows.
    const container = (rows: AppField[]): AppField => ({
        name: 'grid',
        type: AppFieldTypes.COLLAPSIBLE,
        label: 'Orders',
        collapsible_config: {fields: rows, layout: 'grid'},
    });

    // renderCell stands in for AppsFormComponent.renderField. It records the
    // autoFocus it was handed so the tests can assert which cell gets focus.
    const renderCell = (field: AppField, autoFocus: boolean) => (
        <input
            key={field.name}
            data-testid={field.name}
            data-autofocus={String(autoFocus)}
        />
    );

    const renderGrid = (field: AppField, excludeName?: string) =>
        renderWithContext(
            <AppsFormGrid
                field={field}
                renderCell={renderCell}
                excludeName={excludeName}
            />,
        );

    const twoByThree = () => container([
        row('r1', [cell('r1_order', 'Order #'), cell('r1_weight', 'Weight'), cell('r1_status', 'Status')]),
        row('r2', [cell('r2_order', 'Order #'), cell('r2_weight', 'Weight'), cell('r2_status', 'Status')]),
    ]);

    describe('column headers', () => {
        it('takes the column headers from the first row', () => {
            renderGrid(twoByThree());

            const headers = screen.getAllByRole('columnheader');
            expect(headers.map((h) => h.textContent)).toEqual(['Order #', 'Weight', 'Status']);
        });

        it('falls back to the field name when a cell has no label', () => {
            renderGrid(container([row('r1', [cell('r1_order'), cell('r1_weight', 'Weight')])]));

            const headers = screen.getAllByRole('columnheader');
            expect(headers.map((h) => h.textContent)).toEqual(['r1_order', 'Weight']);
        });

        it('marks the first column header as the corner cell', () => {
            renderGrid(twoByThree());

            const headers = screen.getAllByRole('columnheader');
            expect(headers[0]).toHaveClass('apps-form-grid__corner');
            expect(headers[1]).not.toHaveClass('apps-form-grid__corner');
        });

        it('does not render the container label, which is the stacked-mode section title', () => {
            renderGrid(twoByThree());

            expect(screen.queryByText('Orders')).not.toBeInTheDocument();
        });
    });

    describe('rows and cells', () => {
        it('renders one row per child collapsible, with a cell per column', () => {
            renderGrid(twoByThree());

            // One header row plus one row per child collapsible.
            expect(screen.getAllByRole('row')).toHaveLength(3);
            expect(screen.getByTestId('r1_order')).toBeInTheDocument();
            expect(screen.getByTestId('r2_status')).toBeInTheDocument();
        });

        it('renders the first cell of each row as a row header, and the rest as data cells', () => {
            renderGrid(twoByThree());

            const rowHeaders = screen.getAllByRole('rowheader');
            expect(rowHeaders).toHaveLength(2);
            expect(rowHeaders[0]).toHaveClass('apps-form-grid__cell', 'apps-form-grid__row-header');

            // The row header still holds a real input; it is not a static label.
            expect(rowHeaders[0]).toContainElement(screen.getByTestId('r1_order'));

            // Two rows of two non-header cells each.
            expect(screen.getAllByRole('cell')).toHaveLength(4);
        });

        it('renders a nested collapsible as an ordinary cell rather than dropping it', () => {
            const nested: AppField = {
                name: 'r1_nested',
                type: AppFieldTypes.COLLAPSIBLE,
                label: 'Nested',
                collapsible_config: {fields: [cell('deep')]},
            };

            renderGrid(container([row('r1', [cell('r1_order', 'Order #'), nested])]));

            expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Order #', 'Nested']);
            expect(screen.getByTestId('r1_nested')).toBeInTheDocument();
        });
    });

    describe('autoFocus', () => {
        it('gives autoFocus to the first cell of the first row only', () => {
            renderGrid(twoByThree());

            expect(screen.getByTestId('r1_order')).toHaveAttribute('data-autofocus', 'true');
            expect(screen.getByTestId('r1_weight')).toHaveAttribute('data-autofocus', 'false');
            expect(screen.getByTestId('r2_order')).toHaveAttribute('data-autofocus', 'false');
        });
    });

    describe('ragged rows', () => {
        it('pads a short row instead of shifting its cells under the wrong column', () => {
            renderGrid(container([
                row('r1', [cell('r1_order', 'Order #'), cell('r1_weight', 'Weight'), cell('r1_status', 'Status')]),
                row('r2', [cell('r2_order', 'Order #'), cell('r2_weight', 'Weight')]),
            ]));

            // Both rows still have three columns; the missing one is empty.
            const [, , shortRow] = screen.getAllByRole('row');
            expect(shortRow.querySelectorAll('th, td')).toHaveLength(3);
            expect(shortRow.querySelectorAll('td')[1]).toBeEmptyDOMElement();

            // The weight value stays under Weight rather than sliding into Status.
            expect(shortRow.querySelectorAll('td')[0]).toContainElement(screen.getByTestId('r2_weight'));
        });

        it('ignores extra cells beyond the column count taken from the first row', () => {
            renderGrid(container([
                row('r1', [cell('r1_order', 'Order #')]),
                row('r2', [cell('r2_order', 'Order #'), cell('r2_extra', 'Extra')]),
            ]));

            expect(screen.getAllByRole('columnheader')).toHaveLength(1);
            expect(screen.queryByTestId('r2_extra')).not.toBeInTheDocument();
        });
    });

    describe('excludeName', () => {
        it('drops the excluded field from the columns and from every row', () => {
            renderGrid(container([
                row('r1', [cell('r1_order', 'Order #'), cell('submit_buttons', 'Submit')]),
                row('r2', [cell('r2_order', 'Order #'), cell('submit_buttons', 'Submit')]),
            ]), 'submit_buttons');

            expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Order #']);
            expect(screen.queryByTestId('submit_buttons')).not.toBeInTheDocument();
        });

        it('drops an excluded row from the grid', () => {
            renderGrid(container([
                row('r1', [cell('r1_order', 'Order #')]),
                row('submit_buttons', [cell('nope', 'Nope')]),
            ]), 'submit_buttons');

            // Header row plus the one remaining row.
            expect(screen.getAllByRole('row')).toHaveLength(2);
            expect(screen.queryByTestId('nope')).not.toBeInTheDocument();
        });
    });

    describe('children that are not rows', () => {
        it('renders a leaf child under the table rather than dropping it', () => {
            const field = container([row('r1', [cell('r1_order', 'Order #')])]);
            field.collapsible_config!.fields!.push(cell('stray', 'Stray'));

            renderGrid(field);

            expect(screen.getByRole('table')).toBeInTheDocument();
            expect(screen.getByTestId('stray')).toBeInTheDocument();

            // The stray is not a column and not a row.
            expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Order #']);
            expect(screen.getAllByRole('row')).toHaveLength(2);
        });

        it('falls back to rendering the children when there is no row to lay out', () => {
            renderGrid(container([cell('a', 'A'), cell('b', 'B')]));

            expect(screen.queryByRole('table')).not.toBeInTheDocument();
            expect(screen.getByTestId('a')).toBeInTheDocument();
            expect(screen.getByTestId('b')).toBeInTheDocument();
        });

        it('gives autoFocus to the first child in the fallback path', () => {
            renderGrid(container([cell('a', 'A'), cell('b', 'B')]));

            expect(screen.getByTestId('a')).toHaveAttribute('data-autofocus', 'true');
            expect(screen.getByTestId('b')).toHaveAttribute('data-autofocus', 'false');
        });

        it('renders nothing but survives a container with no children at all', () => {
            renderGrid(container([]));

            expect(screen.queryByRole('table')).not.toBeInTheDocument();
        });
    });
});
