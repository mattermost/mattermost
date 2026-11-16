// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {MatrixConfig} from '@mattermost/types/apps';

import {render, screen, userEvent} from 'tests/react_testing_utils';

import CheckboxMatrixSetting, {parseMatrixValue, encodeMatrixValue} from './checkbox_matrix_setting';

describe('components/widgets/settings/checkbox_matrix_setting helpers', () => {
    describe('parseMatrixValue', () => {
        test('parses row entries into a map of column sets', () => {
            const result = parseMatrixValue(['row1:a,b', 'row2:a']);

            expect(result.get('row1')).toEqual(new Set(['a', 'b']));
            expect(result.get('row2')).toEqual(new Set(['a']));
            expect(result.size).toBe(2);
        });

        test('trims whitespace around column values', () => {
            const result = parseMatrixValue(['row1: a , b ']);
            expect(result.get('row1')).toEqual(new Set(['a', 'b']));
        });

        test('skips malformed entries with no colon or a leading colon', () => {
            const result = parseMatrixValue(['row1a', ':a', 'row1:a']);
            expect(result.size).toBe(1);
            expect(result.get('row1')).toEqual(new Set(['a']));
        });

        test('skips entries whose columns are all empty', () => {
            const result = parseMatrixValue(['row1:', 'row2: , ']);
            expect(result.size).toBe(0);
        });
    });

    describe('encodeMatrixValue', () => {
        test('encodes a selection map into row entry strings', () => {
            const selection = new Map<string, Set<string>>([
                ['row1', new Set(['a', 'b'])],
                ['row2', new Set(['a'])],
            ]);
            expect(encodeMatrixValue(selection)).toEqual(['row1:a,b', 'row2:a']);
        });

        test('omits rows with no selected columns', () => {
            const selection = new Map<string, Set<string>>([
                ['row1', new Set<string>()],
                ['row2', new Set(['a'])],
            ]);
            expect(encodeMatrixValue(selection)).toEqual(['row2:a']);
        });

        test('round-trips with parseMatrixValue', () => {
            const entries = ['row1:a,b', 'row2:a'];
            expect(encodeMatrixValue(parseMatrixValue(entries))).toEqual(entries);
        });
    });
});

describe('components/widgets/settings/CheckboxMatrixSetting', () => {
    const matrixConfig: MatrixConfig = {
        rows: [
            {label: 'Row 1', value: 'row1'},
            {label: 'Row 2', value: 'row2'},
        ],
        columns: [
            {label: 'Col A', value: 'a'},
            {label: 'Col B', value: 'b'},
        ],
    };

    test('renders a checkbox grid reflecting the current value in multiple mode', () => {
        render(
            <CheckboxMatrixSetting
                id='matrix'
                label='Matrix'
                matrixConfig={{...matrixConfig, row_selection: 'multiple'}}
                value={['row1:a']}
                onChange={jest.fn()}
            />,
        );

        expect(screen.getByText('Matrix')).toBeInTheDocument();
        expect(screen.getByRole('checkbox', {name: 'Row 1, Col A'})).toBeChecked();
        expect(screen.getByRole('checkbox', {name: 'Row 1, Col B'})).not.toBeChecked();
        expect(screen.getByRole('checkbox', {name: 'Row 2, Col A'})).not.toBeChecked();
    });

    test('checking a box adds the column to that row', async () => {
        const onChange = jest.fn();
        render(
            <CheckboxMatrixSetting
                id='matrix'
                label='Matrix'
                matrixConfig={{...matrixConfig, row_selection: 'multiple'}}
                value={['row1:a']}
                onChange={onChange}
            />,
        );

        await userEvent.click(screen.getByRole('checkbox', {name: 'Row 1, Col B'}));

        expect(onChange).toHaveBeenCalledWith('matrix', ['row1:a,b']);
    });

    test('unchecking the last column in a row removes the row from the selection', async () => {
        const onChange = jest.fn();
        render(
            <CheckboxMatrixSetting
                id='matrix'
                label='Matrix'
                matrixConfig={{...matrixConfig, row_selection: 'multiple'}}
                value={['row1:a', 'row2:a']}
                onChange={onChange}
            />,
        );

        await userEvent.click(screen.getByRole('checkbox', {name: 'Row 1, Col A'}));

        // row1 drops out entirely; row2 is untouched
        expect(onChange).toHaveBeenCalledWith('matrix', ['row2:a']);
    });

    test('single mode renders radios and replaces the row selection without affecting other rows', async () => {
        const onChange = jest.fn();
        render(
            <CheckboxMatrixSetting
                id='matrix'
                label='Matrix'
                matrixConfig={{...matrixConfig, row_selection: 'single'}}
                value={['row1:a', 'row2:a']}
                onChange={onChange}
            />,
        );

        // single mode uses radio inputs
        expect(screen.getByRole('radio', {name: 'Row 1, Col A'})).toBeChecked();

        await userEvent.click(screen.getByRole('radio', {name: 'Row 1, Col B'}));

        // row1 switches from a to b; row2 remains a
        expect(onChange).toHaveBeenCalledWith('matrix', ['row1:b', 'row2:a']);
    });
});
