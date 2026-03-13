// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import TeamUrlStep from './team_url_step';
import type {Props} from './team_url_step';

jest.mock('images/logo.png', () => 'logo.png');

describe('TeamUrlStep', () => {
    const defaultProps: Props = {
        teamURL: 'my-team',
        nameError: '',
        isLoading: false,
        teamURLInput: React.createRef<HTMLInputElement>(),
        onTeamURLChange: jest.fn(),
        onFocus: jest.fn(),
        onSubmit: jest.fn(),
        onBack: jest.fn(),
        buttonText: <>{'Finish'}</>,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render with default props', () => {
        const {container} = renderWithContext(<TeamUrlStep {...defaultProps}/>);

        expect(screen.getByRole('textbox')).toHaveValue('my-team');
        expect(screen.getByRole('button', {name: /finish/i})).not.toBeDisabled();
        expect(screen.getByText('Short and memorable is best')).toBeInTheDocument();
        expect(screen.getByText('Use lowercase letters, numbers and dashes')).toBeInTheDocument();
        expect(screen.getByText("Must start with a letter and can't end in a dash")).toBeInTheDocument();
        expect(screen.getByText('Back to previous step')).toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(container.querySelector('.form-group.has-error')).not.toBeInTheDocument();
    });

    test('should disable button when isLoading is true', () => {
        renderWithContext(
            <TeamUrlStep
                {...defaultProps}
                isLoading={true}
            />,
        );

        expect(screen.getByRole('button', {name: /finish/i})).toBeDisabled();
    });

    test('should call onTeamURLChange when input changes', async () => {
        renderWithContext(<TeamUrlStep {...defaultProps}/>);

        await userEvent.type(screen.getByRole('textbox'), 'a');

        expect(defaultProps.onTeamURLChange).toHaveBeenCalled();
    });

    test('should call onSubmit when button is clicked', async () => {
        renderWithContext(<TeamUrlStep {...defaultProps}/>);

        await userEvent.click(screen.getByRole('button', {name: /finish/i}));

        expect(defaultProps.onSubmit).toHaveBeenCalledTimes(1);
    });

    test('should call onBack when back link is clicked', async () => {
        renderWithContext(<TeamUrlStep {...defaultProps}/>);

        await userEvent.click(screen.getByText('Back to previous step'));

        expect(defaultProps.onBack).toHaveBeenCalledTimes(1);
    });

    test('should display error with has-error class when nameError is provided', () => {
        const {container} = renderWithContext(
            <TeamUrlStep
                {...defaultProps}
                nameError='This URL is taken'
            />,
        );

        expect(screen.getByRole('alert')).toHaveTextContent('This URL is taken');
        expect(container.querySelector('.form-group.has-error')).toBeInTheDocument();
    });

    test('should render with JSX element as nameError', () => {
        renderWithContext(
            <TeamUrlStep
                {...defaultProps}
                nameError={<span>{'Custom JSX error'}</span>}
            />,
        );

        expect(screen.getByText('Custom JSX error')).toBeInTheDocument();
    });

    test('should call onFocus when input receives focus', () => {
        renderWithContext(<TeamUrlStep {...defaultProps}/>);

        const input = screen.getByRole('textbox');

        // The input has autoFocus, so onFocus may already have been called.
        // Clear and explicitly trigger focus.
        (defaultProps.onFocus as jest.Mock).mockClear();
        input.blur();
        input.focus();

        expect(defaultProps.onFocus).toHaveBeenCalled();
    });
});
