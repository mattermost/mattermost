// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {createIntl} from 'react-intl';

import {renderWithContext, screen, fireEvent} from 'tests/vitest_react_testing_utils';

import MultiSelect from './multiselect';
import type {Value} from './multiselect';
import type {Props as MultiSelectProps} from './multiselect_list';

const intl = createIntl({locale: 'en', messages: {}});

const element = () => <div/>;

describe('components/multiselect/multiselect', () => {
    const totalCount = 8;
    const optionsNumber = 8;
    const users: Value[] = [];
    for (let i = 0; i < optionsNumber; i++) {
        users.push({id: `${i}`, label: `${i}`, value: `${i}`});
    }

    const baseProps = {
        ariaLabelRenderer: element as any,
        focusOnLoad: false,
        handleAdd: vi.fn(),
        handleDelete: vi.fn(),
        handleInput: vi.fn(),
        handleSubmit: vi.fn(),
        intl,
        optionRenderer: (option: Value) => (
            <div
                key={option.id}
                data-testid={`option-${option.id}`}
            >
                {option.label}
            </div>
        ),
        options: users,
        perPage: 5,
        saving: false,
        totalCount,
        users,
        valueRenderer: element as any,
        values: [{id: 'id', label: 'label', value: 'value'}],
        valueWithImage: false,
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <MultiSelect
                {...baseProps}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot for page 2', () => {
        const {container} = renderWithContext(
            <MultiSelect
                {...baseProps}
            />,
        );

        // Click Next to go to page 2
        const nextButton = screen.getByRole('button', {name: /next/i});
        fireEvent.click(nextButton);

        // Verify we're on page 2 by checking Previous button is visible
        expect(screen.getByRole('button', {name: /previous/i})).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    test('MultiSelectList should match state on next page', () => {
        const renderOption: MultiSelectProps<Value>['optionRenderer'] = (option, isSelected, onAdd, onMouseMove) => {
            return (
                <div
                    key={option.id}
                    data-testid={`option-${option.id}`}
                    onClick={() => onAdd(option)}
                    onMouseMove={() => onMouseMove(option)}
                >
                    {option.label}
                </div>
            );
        };

        const renderValue = (props: {data: {value: unknown}}) => {
            return props.data.value;
        };

        renderWithContext(
            <MultiSelect
                {...baseProps}
                optionRenderer={renderOption}
                valueRenderer={renderValue}
            />,
        );

        // First 5 options should be visible initially (perPage = 5)
        expect(screen.getByTestId('option-0')).toBeInTheDocument();
        expect(screen.getByTestId('option-4')).toBeInTheDocument();
        expect(screen.queryByTestId('option-5')).not.toBeInTheDocument();

        // Click Next to go to page 2
        fireEvent.click(screen.getByRole('button', {name: /next/i}));

        // After clicking Next, first option on page 2 should be selected (options 5-7)
        expect(screen.getByTestId('option-5')).toBeInTheDocument();
        expect(screen.queryByTestId('option-0')).not.toBeInTheDocument();
    });

    test('MultiSelectList should match snapshot when custom no option message is defined', () => {
        const customNoOptionsMessage = (
            <div className='custom-no-options-message'>
                <span>{'No matches found'}</span>
            </div>
        );

        const {container} = renderWithContext(
            <MultiSelect
                {...baseProps}
                options={[]}
                customNoOptionsMessage={customNoOptionsMessage}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('Back button should be customizable', () => {
        const handleBackButtonClick = vi.fn();

        renderWithContext(
            <MultiSelect
                {...baseProps}
                backButtonClick={handleBackButtonClick}
                backButtonText='Cancel'
                backButtonClass='tertiary-button'
                saveButtonPosition='bottom'
            />,
        );

        const backButton = screen.getByRole('button', {name: /cancel/i});
        expect(backButton).toBeInTheDocument();
        expect(backButton).toHaveClass('tertiary-button');

        fireEvent.click(backButton);

        expect(handleBackButtonClick).toHaveBeenCalled();
    });
});
