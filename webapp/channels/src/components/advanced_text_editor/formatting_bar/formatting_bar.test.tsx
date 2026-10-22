// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {fireEvent, renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {Locations} from 'utils/constants';

import FormattingBar from './formatting_bar';
import * as Hooks from './hooks';

jest.mock('./hooks');

const {LayoutModes, splitFormattingBarControls} = jest.requireActual('./hooks');

describe('FormattingBar', () => {
    const baseProps = {
        applyFormatting: jest.fn(),
        disableControls: false,
        location: Locations.CENTER,
    };

    test('should render hidden formatting button when screen size is min', () => {
        jest.spyOn(Hooks, 'useFormattingBarControls').mockReturnValue({layoutMode: LayoutModes.Min, ...splitFormattingBarControls('min')});

        renderWithContext(
            <FormattingBar {...baseProps}/>,
        );

        expect(screen.getByLabelText('show hidden formatting options')).toBeInTheDocument();
    });

    test('should render hidden formatting button when screen size is narrow', () => {
        jest.spyOn(Hooks, 'useFormattingBarControls').mockReturnValue({layoutMode: LayoutModes.Narrow, ...splitFormattingBarControls('narrow')});

        renderWithContext(
            <FormattingBar {...baseProps}/>,
        );

        expect(screen.getByLabelText('show hidden formatting options')).toBeInTheDocument();
    });

    test('should render hidden formatting button when screen size is normal', () => {
        jest.spyOn(Hooks, 'useFormattingBarControls').mockReturnValue({layoutMode: LayoutModes.Normal, ...splitFormattingBarControls('normal')});

        renderWithContext(
            <FormattingBar {...baseProps}/>,
        );

        expect(screen.getByLabelText('show hidden formatting options')).toBeInTheDocument();
    });

    test('should not render hidden formatting button when screen size is wide', () => {
        jest.spyOn(Hooks, 'useFormattingBarControls').mockReturnValue({layoutMode: LayoutModes.Wide, ...splitFormattingBarControls('wide')});

        renderWithContext(
            <FormattingBar {...baseProps}/>,
        );

        expect(screen.queryByLabelText('show hidden formatting options')).not.toBeInTheDocument();
    });

    test('MM-56705 should not submit form when clicking on hidden formatting button', async () => {
        jest.spyOn(Hooks, 'useFormattingBarControls').mockReturnValue({layoutMode: LayoutModes.Narrow, ...splitFormattingBarControls('narrow')});

        const onSubmit = jest.fn();

        renderWithContext(
            <form onSubmit={onSubmit}>
                <FormattingBar {...baseProps}/>
            </form>,
        );

        expect(screen.queryByLabelText('heading')).toBe(null);

        await userEvent.click(screen.getByLabelText('show hidden formatting options'));

        expect(screen.queryByLabelText('heading')).toBeVisible();
        expect(onSubmit).not.toHaveBeenCalled();
    });

    test('should disable tooltip when hidden controls are shown', async () => {
        jest.spyOn(Hooks, 'useFormattingBarControls').mockReturnValue({layoutMode: LayoutModes.Narrow, ...splitFormattingBarControls('narrow')});

        const {container} = renderWithContext(
            <FormattingBar {...baseProps}/>,
        );

        const hiddenControlsButton = screen.getByLabelText('show hidden formatting options');

        // Click to show hidden controls
        await userEvent.click(hiddenControlsButton);

        // Find the WithTooltip component and verify it has disabled prop
        const tooltipWrapper = container.querySelector('.tooltipContainer');
        expect(tooltipWrapper).toBeNull(); // Tooltip should not be visible when controls are shown
    });

    test('MM-67352 should prevent formatting buttons from stealing editor focus on mouse down', () => {
        jest.spyOn(Hooks, 'useFormattingBarControls').mockReturnValue({layoutMode: LayoutModes.Wide, ...splitFormattingBarControls('wide')});

        renderWithContext(
            <FormattingBar {...baseProps}/>,
        );

        expect(fireEvent.mouseDown(screen.getByLabelText('code'))).toBe(false);
    });

    test('should only render separator before bold when AI actions menu is present', () => {
        jest.spyOn(Hooks, 'useFormattingBarControls').mockReturnValue({layoutMode: LayoutModes.Wide, ...splitFormattingBarControls('wide')});

        const {container, rerender} = renderWithContext(
            <FormattingBar
                {...baseProps}
                aiActionsMenu={<button type='button'>{'AI Actions'}</button>}
            />,
        );

        expect(container.querySelectorAll('[data-testid="formatting-bar-separator"]')).toHaveLength(2);

        rerender(
            <FormattingBar
                {...baseProps}
                aiActionsMenu={null}
            />,
        );

        expect(container.querySelectorAll('[data-testid="formatting-bar-separator"]')).toHaveLength(1);
    });
});
