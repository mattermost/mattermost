// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {fireEvent, renderWithContext} from 'tests/react_testing_utils';

import type {Value} from './multiselect';
import MultiSelectList from './multiselect_list';
import type {Props as MultiSelectProps} from './multiselect_list';

describe('components/multiselect/multiselect', () => {
    const optionsNumber = 8;
    const users: Value[] = [];
    for (let i = 0; i < optionsNumber; i++) {
        users.push({id: `${i}`, label: `${i}`, value: `${i}`});
    }

    const selectedItemRef = {
        current: {
            getBoundingClientRect: jest.fn(() => ({
                bottom: 100,
                top: 50,
            })) as any,
            scrollIntoView: jest.fn(),
        },
    } as any;

    const baseProps = {
        ariaLabelRenderer: (() => <div/>) as any,
        loading: false,
        onAdd: jest.fn(),
        onSelect: jest.fn(),
        optionRenderer: (() => <div/>) as any,
        selectedItemRef,
        options: users,
    };

    test('MultiSelectList should have selected item scrollIntoView to align at bottom of list', () => {
        const renderOption: MultiSelectProps<Value>['optionRenderer'] = (option, isSelected, onAdd, onMouseMove) => {
            return (
                <p
                    key={option.id}
                    onClick={() => onAdd(option)}
                    onMouseMove={() => onMouseMove(option)}
                >
                    {option.id}
                </p>
            );
        };

        renderWithContext(
            <MultiSelectList
                {...baseProps}
                optionRenderer={renderOption}
            />,
        );

        const listEl = document.getElementById('multiSelectList')!;
        jest.spyOn(listEl, 'getBoundingClientRect').mockReturnValue({
            bottom: 50,
            top: 50,
        } as DOMRect);

        // fireEvent on document used because userEvent.keyboard requires element focus
        fireEvent.keyDown(document, {key: 'ArrowDown'});

        expect(selectedItemRef.current.scrollIntoView).toHaveBeenCalledWith(false);
    });

    test('MultiSelectList should have selected item scrollIntoView to align at top of list', () => {
        const renderOption: MultiSelectProps<Value>['optionRenderer'] = (option, isSelected, onAdd, onMouseMove) => {
            return (
                <p
                    key={option.id}
                    onClick={() => onAdd(option)}
                    onMouseMove={() => onMouseMove(option)}
                >
                    {option.id}
                </p>
            );
        };

        renderWithContext(
            <MultiSelectList
                {...baseProps}
                optionRenderer={renderOption}
            />,
        );

        const listEl = document.getElementById('multiSelectList')!;
        jest.spyOn(listEl, 'getBoundingClientRect').mockReturnValue({
            bottom: 200,
            top: 60,
        } as DOMRect);

        // fireEvent on document used because userEvent.keyboard requires element focus
        fireEvent.keyDown(document, {key: 'ArrowDown'});

        expect(selectedItemRef.current.scrollIntoView).toHaveBeenCalledWith(true);
    });
});
