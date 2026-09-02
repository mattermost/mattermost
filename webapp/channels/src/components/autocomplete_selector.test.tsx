// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {act, render, screen, userEvent} from 'tests/react_testing_utils';

import AutocompleteSelector, {getSuggestionListPosition} from './autocomplete_selector';

let mockOnItemSelected: ((selected: any) => void) | undefined;
let mockListPosition: string | undefined;

jest.mock('components/suggestion/suggestion_box', () => {
    const ReactMod = require('react');
    const MockSuggestionBox = ReactMod.forwardRef(function MockSuggestionBox(props: any, ref: any) {
        const inputRef = ReactMod.useRef(null);
        mockOnItemSelected = props.onItemSelected;
        mockListPosition = props.listPosition;

        ReactMod.useImperativeHandle(ref, () => ({
            getTextbox: () => inputRef.current,
            blur: () => inputRef.current?.blur(),
        }));

        return (
            <input
                ref={inputRef}
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
    beforeEach(() => {
        mockListPosition = undefined;
    });

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

    test('chooses list position from available viewport space on focus when listPosition is auto', async () => {
        Object.defineProperty(window, 'innerHeight', {configurable: true, value: 800});

        render(
            <AutocompleteSelector
                label='some label'
                value='some value'
                providers={[]}
                listPosition='auto'
            />,
        );

        const input = screen.getByRole('textbox');
        jest.spyOn(input, 'getBoundingClientRect').mockReturnValue({
            top: 40,
            bottom: 80,
            left: 0,
            right: 0,
            width: 0,
            height: 40,
            x: 0,
            y: 40,
            toJSON: () => ({}),
        });

        await userEvent.click(input);

        expect(mockListPosition).toBe('bottom');
    });

    test('uses explicit listPosition when provided', async () => {
        render(
            <AutocompleteSelector
                label='some label'
                value='some value'
                providers={[]}
                listPosition='top'
            />,
        );

        const input = screen.getByRole('textbox');
        jest.spyOn(input, 'getBoundingClientRect').mockReturnValue({
            top: 600,
            bottom: 640,
            left: 0,
            right: 0,
            width: 0,
            height: 40,
            x: 0,
            y: 600,
            toJSON: () => ({}),
        });

        await userEvent.click(input);

        expect(mockListPosition).toBe('top');
    });

    test('does not compute list position when listPosition is omitted', async () => {
        Object.defineProperty(window, 'innerHeight', {configurable: true, value: 800});

        render(
            <AutocompleteSelector
                label='some label'
                value='some value'
                providers={[]}
            />,
        );

        const input = screen.getByRole('textbox');
        jest.spyOn(input, 'getBoundingClientRect').mockReturnValue({
            top: 40,
            bottom: 80,
            left: 0,
            right: 0,
            width: 0,
            height: 40,
            x: 0,
            y: 40,
            toJSON: () => ({}),
        });

        await userEvent.click(input);

        expect(mockListPosition).toBeUndefined();
    });
});

describe('getSuggestionListPosition', () => {
    const originalInnerHeight = window.innerHeight;

    afterEach(() => {
        Object.defineProperty(window, 'innerHeight', {configurable: true, value: originalInnerHeight});
    });

    function mockViewportHeight(height: number) {
        Object.defineProperty(window, 'innerHeight', {configurable: true, value: height});
    }

    function mockInput(top: number, bottom: number) {
        return {
            getBoundingClientRect: () => ({
                top,
                bottom,
                left: 0,
                right: 0,
                width: 0,
                height: bottom - top,
                x: 0,
                y: top,
                toJSON: () => ({}),
            }),
        } as HTMLElement;
    }

    test('opens downward when there is more space below', () => {
        mockViewportHeight(800);
        expect(getSuggestionListPosition(mockInput(40, 80))).toBe('bottom');
    });

    test('opens upward when there is more space above', () => {
        mockViewportHeight(800);
        expect(getSuggestionListPosition(mockInput(600, 640))).toBe('top');
    });

    test('prefers top when space above and below is equal', () => {
        mockViewportHeight(800);
        expect(getSuggestionListPosition(mockInput(380, 420))).toBe('top');
    });

    test('defaults to top when input has no bounding rect', () => {
        expect(getSuggestionListPosition({} as HTMLElement)).toBe('top');
    });
});
