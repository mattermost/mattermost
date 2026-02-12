// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {createIntl} from 'react-intl';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import MultiSelect from './multiselect';
import type {Value} from './multiselect';
import type {Props as MultiSelectProps} from './multiselect_list';

describe('components/multiselect/multiselect', () => {
    const intl = createIntl({locale: 'en'});
    const totalCount = 8;
    const optionsNumber = 8;
    const users: Value[] = [];
    for (let i = 0; i < optionsNumber; i++) {
        users.push({id: `${i}`, label: `${i}`, value: `${i}`});
    }

    const baseProps = {
        ariaLabelRenderer: (option: Value) => option?.label ?? '',
        handleAdd: jest.fn(),
        handleDelete: jest.fn(),
        handleInput: jest.fn(),
        handleSubmit: jest.fn(),
        intl,
        optionRenderer: (option: Value) => <div key={option.id}>{option.label}</div>,
        options: users,
        perPage: 5,
        saving: false,
        totalCount,
        users,
        valueRenderer: (props: {data: Value}) => <span>{props.data.label}</span>,
        values: [{id: 'id', label: 'label', value: 'value'}],
        valueWithImage: false,
        focusOnLoad: false,
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <MultiSelect
                {...baseProps}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot for page 2', async () => {
        const {container} = renderWithContext(
            <MultiSelect
                {...baseProps}
            />,
        );

        await userEvent.click(screen.getByText('Next'));
        expect(container).toMatchSnapshot();
    });

    test('MultiSelectList should match state on next page', async () => {
        const renderOption: MultiSelectProps<Value>['optionRenderer'] = (option, isSelected, onAdd, onMouseMove) => {
            return (
                <p
                    key={option.id}
                    className={isSelected ? 'option--selected' : ''}
                    onClick={() => onAdd(option)}
                    onMouseMove={() => onMouseMove(option)}
                >
                    {option.id}
                </p>
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

        // Initially no option should be selected (selected = -1)
        expect(document.querySelector('.option--selected')).not.toBeInTheDocument();

        // Click next page
        await userEvent.click(screen.getByText('Next'));

        // After clicking next, the first option on the new page should be selected (selected = 0)
        expect(document.querySelector('.option--selected')).toBeInTheDocument();
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
                customNoOptionsMessage={customNoOptionsMessage}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('Back button should be customizable', async () => {
        const handleBackButtonClick = jest.fn();
        renderWithContext(
            <MultiSelect
                {...baseProps}
                backButtonClick={handleBackButtonClick}
                backButtonText='Cancel'
                backButtonClass='tertiary-button'
                saveButtonPosition='bottom'
            />,
        );

        const backButton = screen.getByRole('button', {name: 'Cancel'});

        await userEvent.click(backButton);

        expect(backButton).toBeInTheDocument();

        expect(handleBackButtonClick).toHaveBeenCalled();
    });
});
