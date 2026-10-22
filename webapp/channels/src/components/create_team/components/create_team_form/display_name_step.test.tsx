// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import DisplayNameStep from './display_name_step';
import type {Props} from './display_name_step';

jest.mock('images/logo.png', () => 'logo.png');

describe('DisplayNameStep', () => {
    const defaultProps: Props = {
        teamDisplayName: 'My Team',
        isValidTeamName: true,
        onDisplayNameChange: jest.fn(),
        onSubmit: jest.fn(),
        buttonText: <>{'Next'}<i className='icon icon-chevron-right'/></>,
        isLoading: false,
        nameError: '',
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render with default props', () => {
        renderWithContext(<DisplayNameStep {...defaultProps}/>);

        expect(screen.getByRole('textbox')).toHaveValue('My Team');
        expect(screen.getByRole('button', {name: /next/i})).toBeEnabled();
        expect(screen.getByText('Name your team in any language. Your team name shows in menus and headings.')).toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    test('should disable button when team name is invalid', () => {
        renderWithContext(
            <DisplayNameStep
                {...defaultProps}
                isValidTeamName={false}
            />,
        );

        expect(screen.getByRole('button', {name: /next/i})).toBeDisabled();
    });

    test('should disable button when isLoading is true', () => {
        renderWithContext(
            <DisplayNameStep
                {...defaultProps}
                isLoading={true}
            />,
        );

        expect(screen.getByRole('button', {name: /next/i})).toBeDisabled();
    });

    test('should call onDisplayNameChange when input changes', async () => {
        renderWithContext(<DisplayNameStep {...defaultProps}/>);

        await userEvent.type(screen.getByRole('textbox'), 'a');

        expect(defaultProps.onDisplayNameChange).toHaveBeenCalled();
    });

    test('should call onSubmit when button is clicked', async () => {
        renderWithContext(<DisplayNameStep {...defaultProps}/>);

        await userEvent.click(screen.getByRole('button', {name: /next/i}));

        expect(defaultProps.onSubmit).toHaveBeenCalledTimes(1);
    });

    test('should display error with has-error class when nameError is provided', () => {
        const {container} = renderWithContext(
            <DisplayNameStep
                {...defaultProps}
                nameError='Team name is required'
            />,
        );

        expect(screen.getByRole('alert')).toHaveTextContent('Team name is required');
        expect(container.querySelector('.form-group.has-error')).toBeInTheDocument();
    });

    test('should render with JSX element as nameError', () => {
        renderWithContext(
            <DisplayNameStep
                {...defaultProps}
                nameError={<span>{'Custom JSX error'}</span>}
            />,
        );

        expect(screen.getByText('Custom JSX error')).toBeInTheDocument();
    });
});
