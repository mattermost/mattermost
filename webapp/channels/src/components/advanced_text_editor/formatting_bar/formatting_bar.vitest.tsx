// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import {renderWithContext, userEvent} from 'tests/vitest_react_testing_utils';
import {Locations} from 'utils/constants';

import FormattingBar from './formatting_bar';
import * as Hooks from './hooks';

vi.mock('./hooks');

let splitFormattingBarControls: typeof Hooks.splitFormattingBarControls;

describe('FormattingBar', () => {
    beforeAll(async () => {
        const actualHooks = await vi.importActual<typeof Hooks>('./hooks');
        splitFormattingBarControls = actualHooks.splitFormattingBarControls;
    });

    const baseProps = {
        getCurrentMessage: vi.fn(() => ''),
        getCurrentSelection: vi.fn(() => ({start: 0, end: 0})),
        applyMarkdown: vi.fn(),
        disableControls: false,
        location: Locations.CENTER,
    };

    test('should render hidden formatting button when screen size is min', () => {
        vi.spyOn(Hooks, 'useFormattingBarControls').mockReturnValue({wideMode: 'min', ...splitFormattingBarControls('min')});

        renderWithContext(
            <FormattingBar {...baseProps}/>,
        );

        expect(screen.getByLabelText('show hidden formatting options')).toBeInTheDocument();
    });

    test('should render hidden formatting button when screen size is narrow', () => {
        vi.spyOn(Hooks, 'useFormattingBarControls').mockReturnValue({wideMode: 'narrow', ...splitFormattingBarControls('narrow')});

        renderWithContext(
            <FormattingBar {...baseProps}/>,
        );

        expect(screen.getByLabelText('show hidden formatting options')).toBeInTheDocument();
    });

    test('should render hidden formatting button when screen size is normal', () => {
        vi.spyOn(Hooks, 'useFormattingBarControls').mockReturnValue({wideMode: 'normal', ...splitFormattingBarControls('normal')});

        renderWithContext(
            <FormattingBar {...baseProps}/>,
        );

        expect(screen.getByLabelText('show hidden formatting options')).toBeInTheDocument();
    });

    test('should not render hidden formatting button when screen size is wide', () => {
        vi.spyOn(Hooks, 'useFormattingBarControls').mockReturnValue({wideMode: 'wide', ...splitFormattingBarControls('wide')});

        renderWithContext(
            <FormattingBar {...baseProps}/>,
        );

        expect(screen.queryByLabelText('show hidden formatting options')).not.toBeInTheDocument();
    });

    test('MM-56705 should not submit form when clicking on hidden formatting button', async () => {
        vi.spyOn(Hooks, 'useFormattingBarControls').mockReturnValue({wideMode: 'narrow', ...splitFormattingBarControls('narrow')});

        const onSubmit = vi.fn();

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
        vi.spyOn(Hooks, 'useFormattingBarControls').mockReturnValue({wideMode: 'narrow', ...splitFormattingBarControls('narrow')});

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
});
