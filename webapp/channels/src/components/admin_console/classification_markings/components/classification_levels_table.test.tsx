// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, fireEvent} from 'tests/react_testing_utils';

import ClassificationLevelsTable from './classification_levels_table';

const LEVELS = [
    {id: 'lvl-1', name: 'UNCLASSIFIED', color: '#007A33', rank: 1},
    {id: 'lvl-2', name: 'SECRET', color: '#C8102E', rank: 2},
    {id: 'lvl-3', name: 'TOP SECRET', color: '#FF8C00', rank: 3},
];

function makeProps(overrides = {}) {
    return {
        levels: LEVELS,
        updateLevel: jest.fn(),
        deleteLevel: jest.fn(),
        onReorder: jest.fn(),
        ...overrides,
    };
}

describe('ClassificationLevelsTable', () => {
    test('renders column headers', () => {
        renderWithContext(<ClassificationLevelsTable {...makeProps()}/>);

        expect(screen.getByText('Text')).toBeInTheDocument();
        expect(screen.getByText('Color')).toBeInTheDocument();
        expect(screen.getByText('Rank')).toBeInTheDocument();
    });

    test('renders a row for each level', () => {
        renderWithContext(<ClassificationLevelsTable {...makeProps()}/>);

        expect(screen.getByDisplayValue('UNCLASSIFIED')).toBeInTheDocument();
        expect(screen.getByDisplayValue('SECRET')).toBeInTheDocument();
        expect(screen.getByDisplayValue('TOP SECRET')).toBeInTheDocument();
    });

    test('renders rank values for each level', () => {
        renderWithContext(<ClassificationLevelsTable {...makeProps()}/>);

        expect(screen.getByText('1')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
    });

    test('renders delete buttons when not disabled', () => {
        renderWithContext(<ClassificationLevelsTable {...makeProps()}/>);

        const deleteButtons = screen.getAllByRole('button', {name: 'Delete level'});
        expect(deleteButtons).toHaveLength(LEVELS.length);
    });

    test('hides delete buttons when disabled', () => {
        renderWithContext(<ClassificationLevelsTable {...makeProps({disabled: true})}/>);

        expect(screen.queryByRole('button', {name: 'Delete level'})).not.toBeInTheDocument();
    });

    test('calls deleteLevel with the correct id when delete is clicked', () => {
        const deleteLevel = jest.fn();
        renderWithContext(<ClassificationLevelsTable {...makeProps({deleteLevel})}/>);

        const [firstDeleteButton] = screen.getAllByRole('button', {name: 'Delete level'});
        fireEvent.click(firstDeleteButton);

        expect(deleteLevel).toHaveBeenCalledTimes(1);
        expect(deleteLevel).toHaveBeenCalledWith('lvl-1');
    });

    test('renders color swatches in read-only mode when disabled', () => {
        renderWithContext(<ClassificationLevelsTable {...makeProps({disabled: true})}/>);

        expect(screen.getByText('#007A33')).toBeInTheDocument();
        expect(screen.getByText('#C8102E')).toBeInTheDocument();
        expect(screen.getByText('#FF8C00')).toBeInTheDocument();
    });

    test('renders color inputs (editable) when not disabled', () => {
        renderWithContext(<ClassificationLevelsTable {...makeProps()}/>);

        const colorInputs = screen.getAllByTestId('color-inputColorValue');
        expect(colorInputs).toHaveLength(LEVELS.length);
        expect(colorInputs[0]).toHaveValue('#007A33');
    });

    test('displays rows sorted by rank regardless of input order', () => {
        const unsortedLevels = [
            {id: 'lvl-3', name: 'TOP SECRET', color: '#FF8C00', rank: 3},
            {id: 'lvl-1', name: 'UNCLASSIFIED', color: '#007A33', rank: 1},
            {id: 'lvl-2', name: 'SECRET', color: '#C8102E', rank: 2},
        ];

        renderWithContext(<ClassificationLevelsTable {...makeProps({levels: unsortedLevels})}/>);

        const inputs = screen.getAllByRole<HTMLInputElement>('textbox', {name: 'Classification level name'});
        expect(inputs[0]).toHaveValue('UNCLASSIFIED');
        expect(inputs[1]).toHaveValue('SECRET');
        expect(inputs[2]).toHaveValue('TOP SECRET');
    });

    test('renders empty state with no rows when levels array is empty', () => {
        renderWithContext(<ClassificationLevelsTable {...makeProps({levels: []})}/>);

        expect(screen.queryByRole('textbox', {name: 'Classification level name'})).not.toBeInTheDocument();
    });
});
