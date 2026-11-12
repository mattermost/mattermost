// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Preferences} from 'mattermost-redux/constants';
import type {Theme} from 'mattermost-redux/selectors/entities/preferences';
import {changeOpacity} from 'mattermost-redux/utils/theme_utils';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import ActionButton from './action_button';

describe('components/post_view/message_attachments/action_button.jsx', () => {
    const baseProps = {
        action: {id: 'action_id_1', name: 'action_name_1', cookie: 'cookie-contents'},
        handleAction: jest.fn(),
        theme: Preferences.THEMES.denim as unknown as Theme,
    };

    test('should match default component state with given props', () => {
        renderWithContext(<ActionButton {...baseProps}/>);

        const button = screen.getByRole('button', {name: 'action_name_1'});
        expect(button).toHaveAttribute('data-action-cookie', 'cookie-contents');
        expect(button).toHaveAttribute('data-action-id', 'action_id_1');
        expect(button.querySelector('[role="status"][aria-label="Loading"]')).not.toBeInTheDocument();
    });

    test('should show Compass loading spinner while actionExecuting', () => {
        renderWithContext(
            <ActionButton
                {...baseProps}
                actionExecuting={true}
                actionExecutingMessage='Working...'
            />,
        );

        const button = screen.getByRole('button', {name: 'Working...'});
        expect(button).toBeDisabled();
        expect(button).toHaveAttribute('aria-busy', 'true');
        expect(button.querySelector('[role="status"][aria-label="Loading"]')).toBeInTheDocument();
    });

    test('should call handleAction on click', async () => {
        renderWithContext(<ActionButton {...baseProps}/>);

        const button = screen.getByRole('button');

        await userEvent.click(button);

        expect(baseProps.handleAction).toHaveBeenCalledTimes(1);
    });

    test('should have correct styles when provided color from theme', () => {
        const props = {
            ...baseProps,
            action: {...baseProps.action, style: 'onlineIndicator'},
        };

        renderWithContext(<ActionButton {...props}/>);

        const button = screen.getByRole('button');

        const tint = Preferences.THEMES.denim.onlineIndicator;
        expect(button).toHaveClass('ActionButton--tinted');
        expect(button).toHaveStyle({
            '--action-button-tint': tint,
            '--action-button-bg': changeOpacity(tint, 0.08),
            '--action-button-bg-hover': changeOpacity(tint, 0.12),
            '--action-button-bg-active': changeOpacity(tint, 0.16),
            '--button-fg': tint,
        });
    });

    test('should have correct styles when provided color from not default theme', () => {
        const props = {
            ...baseProps,
            theme: Preferences.THEMES.indigo as unknown as Theme,
            action: {...baseProps.action, style: 'danger'},
        };

        renderWithContext(<ActionButton {...props}/>);

        const button = screen.getByRole('button');
        const tint = Preferences.THEMES.indigo.errorTextColor;

        expect(button).toHaveClass('ActionButton--tinted');
        expect(button).toHaveStyle({
            '--action-button-tint': tint,
            '--action-button-bg': changeOpacity(tint, 0.08),
            '--action-button-bg-hover': changeOpacity(tint, 0.12),
            '--action-button-bg-active': changeOpacity(tint, 0.16),
            '--button-fg': tint,
        });
    });

    test('should have correct styles when provided status color', () => {
        const props = {
            ...baseProps,
            action: {...baseProps.action, style: 'success'},
        };

        renderWithContext(<ActionButton {...props}/>);
        const button = screen.getByRole('button');
        const tint = '#339970';

        expect(button).toHaveClass('ActionButton--tinted');
        expect(button).toHaveStyle({
            '--action-button-tint': tint,
            '--action-button-bg': changeOpacity(tint, 0.08),
            '--action-button-bg-hover': changeOpacity(tint, 0.12),
            '--action-button-bg-active': changeOpacity(tint, 0.16),
            '--button-fg': tint,
        });
    });

    test('should have correct styles when provided hex color', () => {
        const props = {
            ...baseProps,
            action: {...baseProps.action, style: '#28a745'},
        };

        renderWithContext(<ActionButton {...props}/>);
        const button = screen.getByRole('button');
        const tint = props.action.style;

        expect(button).toHaveClass('ActionButton--tinted');
        expect(button).toHaveStyle({
            '--action-button-tint': tint,
            '--action-button-bg': changeOpacity(tint, 0.08),
            '--action-button-bg-hover': changeOpacity(tint, 0.12),
            '--action-button-bg-active': changeOpacity(tint, 0.16),
            '--button-fg': tint,
        });
    });

    test('should have no styles when provided invalid hex color', () => {
        const props = {
            ...baseProps,
            action: {...baseProps.action, style: '#wrong'},
        };

        renderWithContext(<ActionButton {...props}/>);
        const button = screen.getByRole('button');

        expect(button).not.toHaveClass('ActionButton--tinted');
        expect(button.style.length).toBe(0);
    });

    test('should have no styles when provided undefined', () => {
        const props = {
            ...baseProps,
            action: {...baseProps.action, style: undefined},
        };

        renderWithContext(<ActionButton {...props}/>);
        const button = screen.getByRole('button');

        expect(button).not.toHaveClass('ActionButton--tinted');
        expect(button.style.length).toBe(0);
    });

    test('should not show tooltip when action.tooltip is undefined', async () => {
        const props = {
            ...baseProps,
            action: {...baseProps.action, tooltip: undefined},
        };

        renderWithContext(<ActionButton {...props}/>);
        const button = screen.getByRole('button');

        // Hover over the button
        await userEvent.hover(button);

        // Tooltip should not appear
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('should not show tooltip when action.tooltip is empty string', async () => {
        const props = {
            ...baseProps,
            action: {...baseProps.action, tooltip: ''},
        };

        renderWithContext(<ActionButton {...props}/>);
        const button = screen.getByRole('button');

        // Hover over the button
        await userEvent.hover(button);

        // Tooltip should not appear
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('should show tooltip when action.tooltip is provided', async () => {
        const props = {
            ...baseProps,
            action: {...baseProps.action, tooltip: 'This is a tooltip'},
        };

        renderWithContext(<ActionButton {...props}/>);
        const button = screen.getByRole('button');

        // Hover over the button
        await userEvent.hover(button);

        // Wait for tooltip to appear (WithTooltip has a delay)
        const tooltip = await screen.findByRole('tooltip', {}, {timeout: 1000});
        expect(tooltip).toBeInTheDocument();
        expect(tooltip).toHaveTextContent('This is a tooltip');
    });
});
