// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, userEvent, screen} from 'tests/react_testing_utils';

import BurnOnReadButton from './burn_on_read_button';

jest.mock('components/with_tooltip', () => {
    return ({children}: { children: React.ReactNode }) => <div>{children}</div>;
});

describe('BurnOnReadButton', () => {
    const defaultProps = {
        enabled: false,
        onToggle: jest.fn(),
        disabled: false,
        durationMinutes: 10,
    };

    it('should render correctly when disabled', () => {
        renderWithContext(
            <BurnOnReadButton {...defaultProps}/>,
        );

        const button = screen.getByRole('button');
        expect(button).toBeInTheDocument();
        expect(button).toHaveAttribute('id', 'burnOnReadButton');
    });

    it('should render correctly when enabled', () => {
        renderWithContext(
            <BurnOnReadButton
                {...defaultProps}
                enabled={true}
            />,
        );

        const button = screen.getByRole('button');
        expect(button).toBeInTheDocument();
        expect(button).toHaveClass('control');
    });

    it('should call onToggle with true when clicked while disabled', async () => {
        const onToggle = jest.fn();
        renderWithContext(
            <BurnOnReadButton
                {...defaultProps}
                enabled={false}
                onToggle={onToggle}
            />,
        );

        const button = screen.getByRole('button');
        await userEvent.click(button);

        expect(onToggle).toHaveBeenCalledTimes(1);
        expect(onToggle).toHaveBeenCalledWith(true);
    });

    it('should call onToggle with false when clicked while enabled', async () => {
        const onToggle = jest.fn();
        renderWithContext(
            <BurnOnReadButton
                {...defaultProps}
                enabled={true}
                onToggle={onToggle}
            />,
        );

        const button = screen.getByRole('button');
        await userEvent.click(button);

        expect(onToggle).toHaveBeenCalledTimes(1);
        expect(onToggle).toHaveBeenCalledWith(false);
    });

    it('should not be clickable when disabled prop is true', () => {
        const onToggle = jest.fn();
        renderWithContext(
            <BurnOnReadButton
                {...defaultProps}
                disabled={true}
                onToggle={onToggle}
            />,
        );

        const button = screen.getByRole('button');
        expect(button).toBeDisabled();
    });

    it('should display correct duration in tooltip', () => {
        renderWithContext(
            <BurnOnReadButton
                {...defaultProps}
                durationMinutes={15}
            />,
        );

        const button = screen.getByRole('button');
        expect(button).toHaveAttribute('aria-label', expect.stringContaining('15 minutes'));
    });
});
