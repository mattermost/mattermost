// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render, screen, fireEvent} from 'tests/react_testing_utils';

import LevelColorCell from './level_color_cell';

function makeProps(overrides = {}) {
    return {
        id: 'level-1',
        value: '#FF0000',
        swatchAriaLabel: 'Open color picker',
        updateLevel: jest.fn(),
        ...overrides,
    };
}

describe('LevelColorCell', () => {
    test('renders the color input with the initial value', () => {
        render(<LevelColorCell {...makeProps()}/>);
        expect(screen.getByTestId('color-inputColorValue')).toHaveValue('#FF0000');
    });

    test('calls updateLevel on blur when color has changed', () => {
        const updateLevel = jest.fn();
        render(<LevelColorCell {...makeProps({updateLevel})}/>);

        const input = screen.getByTestId('color-inputColorValue');
        fireEvent.focus(input);
        fireEvent.change(input, {target: {value: '#0000FF'}});
        fireEvent.blur(input);

        expect(updateLevel).toHaveBeenCalledWith('level-1', {color: '#0000ff'});
    });

    test('does not call updateLevel on blur when color is unchanged', () => {
        const updateLevel = jest.fn();
        render(<LevelColorCell {...makeProps({value: '#ff0000', updateLevel})}/>);

        fireEvent.blur(screen.getByTestId('color-inputColorValue'));

        expect(updateLevel).not.toHaveBeenCalled();
    });

    test('syncs to updated external value prop', () => {
        const {rerender} = render(<LevelColorCell {...makeProps({value: '#FF0000'})}/>);
        expect(screen.getByTestId('color-inputColorValue')).toHaveValue('#FF0000');

        rerender(<LevelColorCell {...makeProps({value: '#00FF00'})}/>);
        expect(screen.getByTestId('color-inputColorValue')).toHaveValue('#00FF00');
    });

    test('renders the color swatch button with the correct aria-label', () => {
        render(<LevelColorCell {...makeProps()}/>);
        expect(screen.getByRole('button', {name: 'Open color picker'})).toBeInTheDocument();
    });
});
