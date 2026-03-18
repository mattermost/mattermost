// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {act, render, screen, userEvent} from 'tests/react_testing_utils';

import AutocompleteSelector from './autocomplete_selector';

let mockOnItemSelected: ((selected: any) => void) | undefined;

jest.mock('components/suggestion/suggestion_box', () => {
    const ReactMod = require('react');
    const MockSuggestionBox = ReactMod.forwardRef(function MockSuggestionBox(props: any, ref: any) {
        mockOnItemSelected = props.onItemSelected;
        return (
            <input
                ref={ref}
                className={props.className || 'form-control'}
                value={props.value || ''}
                onChange={(e: any) => props.onChange?.({target: e.target})}
                onFocus={props.onFocus}
                onBlur={props.onBlur}
                placeholder={props.placeholder}
            />
        );
    });
    return {__esModule: true, default: MockSuggestionBox};
});

describe('components/widgets/settings/AutocompleteSelector', () => {
    test('render component with required props', () => {
        const {container} = render(
            <AutocompleteSelector
                id='string.id'
                label='some label'
                value='some value'
                providers={[]}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('check snapshot with value prop and changing focus', async () => {
        const {container} = render(
            <AutocompleteSelector
                providers={[]}
                label='some label'
                value='value from prop'
            />,
        );

        const input = screen.getByRole('textbox');

        // Initially not focused, shows prop value
        expect(input).toHaveValue('value from prop');
        expect(container).toMatchSnapshot();

        // Focus the input and type a new value
        await userEvent.click(input);
        await userEvent.clear(input);
        await userEvent.type(input, 'value from input');

        expect(input).toHaveValue('value from input');
        expect(container).toMatchSnapshot();

        // Blur the input - value should revert to prop value
        await userEvent.tab();
        expect(input).toHaveValue('value from prop');
    });

    test('onSelected', () => {
        const onSelected = jest.fn();
        render(
            <AutocompleteSelector
                label='some label'
                value='some value'
                providers={[]}
                onSelected={onSelected}
            />,
        );

        const selected = {text: 'sometext', value: 'somevalue', id: '', username: '', display_name: ''};
        act(() => {
            mockOnItemSelected!(selected);
        });

        expect(onSelected).toHaveBeenCalledTimes(1);
        expect(onSelected).toHaveBeenCalledWith(selected);
    });
});
