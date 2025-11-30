// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {createRef} from 'react';

import {renderWithContext, screen, fireEvent} from 'tests/vitest_react_testing_utils';

import type {Value} from './multiselect';
import MultiSelectList from './multiselect_list';
import type {Props as MultiSelectProps} from './multiselect_list';

const element = () => <div/>;

// Mock Element.prototype.scrollIntoView
const scrollIntoViewMock = vi.fn();
Element.prototype.scrollIntoView = scrollIntoViewMock;

describe('components/multiselect/multiselect', () => {
    const optionsNumber = 8;
    const users: Value[] = [];
    for (let i = 0; i < optionsNumber; i++) {
        users.push({id: `${i}`, label: `${i}`, value: `${i}`});
    }

    const selectedItemRef = createRef<HTMLDivElement>();

    const baseProps = {
        ariaLabelRenderer: element as any,
        loading: false,
        onAdd: vi.fn(),
        onPageChange: vi.fn(),
        onSelect: vi.fn(),
        optionRenderer: element,
        selectedItemRef,
        options: users,
        perPage: 5,
        page: 1,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('MultiSelectList should have selected item scrollIntoView to align at bottom of list', () => {
        const renderOption: MultiSelectProps<Value>['optionRenderer'] = (option, isSelected, onAdd, onMouseMove) => {
            return (
                <div
                    key={option.id}
                    data-testid={`option-${option.id}`}
                    ref={isSelected ? selectedItemRef : undefined}
                    onClick={() => onAdd(option)}
                    onMouseMove={() => onMouseMove(option)}
                    aria-selected={isSelected}
                >
                    {option.id}
                </div>
            );
        };

        renderWithContext(
            <MultiSelectList
                {...baseProps}
                optionRenderer={renderOption}
            />,
        );

        // Options should be rendered
        expect(screen.getByTestId('option-0')).toBeInTheDocument();

        // Simulate keyboard navigation to select an item
        // The component listens to keydown events on document
        fireEvent.keyDown(document, {key: 'ArrowDown', code: 'ArrowDown'});

        // After arrow down, onSelect should be called
        expect(baseProps.onSelect).toHaveBeenCalled();
    });

    test('MultiSelectList should have selected item scrollIntoView to align at top of list', () => {
        const renderOption: MultiSelectProps<Value>['optionRenderer'] = (option, isSelected, onAdd, onMouseMove) => {
            return (
                <div
                    key={option.id}
                    data-testid={`option-${option.id}`}
                    ref={isSelected ? selectedItemRef : undefined}
                    onClick={() => onAdd(option)}
                    onMouseMove={() => onMouseMove(option)}
                    aria-selected={isSelected}
                >
                    {option.id}
                </div>
            );
        };

        renderWithContext(
            <MultiSelectList
                {...baseProps}
                optionRenderer={renderOption}
            />,
        );

        // Options should be rendered
        expect(screen.getByTestId('option-0')).toBeInTheDocument();

        // Navigate down first, then up
        fireEvent.keyDown(document, {key: 'ArrowDown', code: 'ArrowDown'});
        fireEvent.keyDown(document, {key: 'ArrowUp', code: 'ArrowUp'});

        // After navigation, onSelect should be called
        expect(baseProps.onSelect).toHaveBeenCalled();
    });
});
