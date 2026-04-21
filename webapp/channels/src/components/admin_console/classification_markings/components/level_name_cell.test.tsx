// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render, screen, fireEvent} from 'tests/react_testing_utils';

import LevelNameCell from './level_name_cell';

function makeProps(overrides = {}) {
    return {
        id: 'level-1',
        value: 'SECRET',
        label: 'Classification level name',
        updateLevel: jest.fn(),
        ...overrides,
    };
}

describe('LevelNameCell', () => {
    test('renders input with initial value', () => {
        render(<LevelNameCell {...makeProps()}/>);
        expect(screen.getByRole('textbox')).toHaveValue('SECRET');
    });

    test('renders input with correct aria-label', () => {
        render(<LevelNameCell {...makeProps()}/>);
        expect(screen.getByRole('textbox', {name: 'Classification level name'})).toBeInTheDocument();
    });

    test('input is readOnly when disabled', () => {
        render(<LevelNameCell {...makeProps({disabled: true})}/>);
        expect(screen.getByRole('textbox')).toHaveAttribute('readOnly');
    });

    test('input is editable when not disabled', () => {
        render(<LevelNameCell {...makeProps()}/>);
        expect(screen.getByRole('textbox')).not.toHaveAttribute('readOnly');
    });

    test('calls updateLevel with trimmed name on blur when value changed', () => {
        const updateLevel = jest.fn();
        render(<LevelNameCell {...makeProps({updateLevel})}/>);

        const input = screen.getByRole('textbox');
        fireEvent.change(input, {target: {value: '  TOP SECRET  '}});
        fireEvent.blur(input);

        expect(updateLevel).toHaveBeenCalledTimes(1);
        expect(updateLevel).toHaveBeenCalledWith('level-1', {name: 'TOP SECRET'});
    });

    test('does not call updateLevel on blur when value is unchanged', () => {
        const updateLevel = jest.fn();
        render(<LevelNameCell {...makeProps({updateLevel})}/>);

        fireEvent.blur(screen.getByRole('textbox'));

        expect(updateLevel).not.toHaveBeenCalled();
    });

    test('reflects local typing before blur', () => {
        render(<LevelNameCell {...makeProps()}/>);
        const input = screen.getByRole('textbox');
        fireEvent.change(input, {target: {value: 'CONFIDENTIAL'}});
        expect(input).toHaveValue('CONFIDENTIAL');
    });

    test('syncs to updated external value prop', () => {
        const {rerender} = render(<LevelNameCell {...makeProps({value: 'SECRET'})}/>);
        expect(screen.getByRole('textbox')).toHaveValue('SECRET');

        rerender(<LevelNameCell {...makeProps({value: 'TOP SECRET'})}/>);
        expect(screen.getByRole('textbox')).toHaveValue('TOP SECRET');
    });
});
