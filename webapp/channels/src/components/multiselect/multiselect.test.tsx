// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {IntlShape} from 'react-intl';

import {renderWithIntl} from 'tests/react_testing_utils';
import {screen, fireEvent} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import MultiSelect from './multiselect';
import type {Value} from './multiselect';
import type {Props as MultiSelectProps} from './multiselect_list';

const element = () => <div/>;

describe('components/multiselect/multiselect', () => {
    const totalCount = 8;
    const optionsNumber = 8;
    const users = [];
    for (let i = 0; i < optionsNumber; i++) {
        users.push({id: `${i}`, label: `${i}`, value: `${i}`});
    }

    const baseProps = {
        ariaLabelRenderer: element as any,
        handleAdd: jest.fn(),
        handleDelete: jest.fn(),
        handleInput: jest.fn(),
        handleSubmit: jest.fn(),
        intl: {} as IntlShape,
        optionRenderer: element,
        options: users,
        perPage: 5,
        saving: false,
        totalCount,
        users,
        valueRenderer: element as any,
        values: [{id: 'id', label: 'label', value: 'value'}],
        valueWithImage: false,
    };

    test('should render multiselect component', () => {
        renderWithIntl(<MultiSelect {...baseProps}/>);
        
        expect(screen.getByRole('combobox')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /go/i})).toBeInTheDocument();
    });

    test('should handle next page navigation', () => {
        renderWithIntl(<MultiSelect {...baseProps}/>);

        const nextButton = screen.getByRole('button', {name: /next/i});
        fireEvent.click(nextButton);

        expect(screen.getByRole('button', {name: /previous/i})).toBeInTheDocument();
    });

    test('should handle option selection and navigation', () => {
        const renderOption: MultiSelectProps<Value>['optionRenderer'] = (option, isSelected, onAdd, onMouseMove) => {
            return (
                <p
                    key={option.id}
                    data-testid={`option-${option.id}`}
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

        renderWithIntl(
            <MultiSelect
                {...baseProps}
                optionRenderer={renderOption}
                valueRenderer={renderValue}
            />,
        );

        const nextButton = screen.getByRole('button', {name: /next/i});
        fireEvent.click(nextButton);

        // Verify options are rendered
        users.slice(0, baseProps.perPage).forEach((user) => {
            expect(screen.getByTestId(`option-${user.id}`)).toBeInTheDocument();
        });
    });

    test('should render custom no options message', () => {
        const customNoOptionsMessage = (
            <div className='custom-no-options-message'>
                <span>{'No matches found'}</span>
            </div>
        );

        renderWithIntl(
            <MultiSelect
                {...baseProps}
                customNoOptionsMessage={customNoOptionsMessage}
            />,
        );

        expect(screen.getByText('No matches found')).toBeInTheDocument();
    });

    test('should handle back button customization', async () => {
        const handleBackButtonClick = jest.fn();
        
        renderWithIntl(
            <MultiSelect
                {...baseProps}
                backButtonClick={handleBackButtonClick}
                backButtonText='Cancel'
                backButtonClass='tertiary-button'
                saveButtonPosition='bottom'
            />,
        );

        const backButton = screen.getByRole('button', {name: /cancel/i});
        expect(backButton).toHaveClass('tertiary-button');

        await userEvent.click(backButton);
        expect(handleBackButtonClick).toHaveBeenCalled();
    });
});
