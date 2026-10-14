// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import Toggle from './toggle';

describe('components/Toggle', () => {
    it('renders a switch with mapped size and checked state', () => {
        renderWithContext(
            <Toggle
                id='test-toggle'
                toggled={true}
                onToggle={jest.fn()}
                ariaLabel='Test switch'
                size='btn-md'
            />,
        );

        const control = screen.getByRole('switch', {name: 'Test switch'});
        expect(control).toBeChecked();
        expect(control).toHaveAttribute('data-testid', 'test-toggle-button');
    });

    it('calls onToggle when changed', async () => {
        const onToggle = jest.fn();
        renderWithContext(
            <Toggle
                id='test-toggle'
                toggled={false}
                onToggle={onToggle}
                ariaLabel='Test switch'
            />,
        );

        await userEvent.click(screen.getByRole('switch', {name: 'Test switch'}));
        expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('shows on/off text as the Switch label on the left', async () => {
        const onToggle = jest.fn();
        renderWithContext(
            <Toggle
                id='labeled-toggle'
                toggled={true}
                onToggle={onToggle}
                onText='On label'
                offText='Off label'
            />,
        );

        const control = screen.getByRole('switch', {name: 'On label'});
        expect(control).toBeChecked();
        expect(screen.queryByText('Off label')).not.toBeInTheDocument();

        await userEvent.click(screen.getByText('On label'));
        expect(onToggle).toHaveBeenCalledTimes(1);
    });
});
