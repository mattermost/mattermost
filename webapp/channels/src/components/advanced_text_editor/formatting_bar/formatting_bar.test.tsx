// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import {renderWithContext, userEvent} from 'tests/react_testing_utils';
import {Locations} from 'utils/constants';

import FormattingBar from './formatting_bar';
import * as Hooks from './hooks';

jest.mock('./hooks');

const {splitFormattingBarControls} = jest.requireActual('./hooks');

describe('FormattingBar', () => {
    const baseProps = {
        getCurrentMessage: jest.fn(() => ''),
        getCurrentSelection: jest.fn(() => ({start: 0, end: 0})),
        applyMarkdown: jest.fn(),
        disableControls: false,
        location: Locations.CENTER,
    };

    test('should render hidden formatting button when screen size is min', () => {
        jest.spyOn(Hooks, 'useFormattingBarControls').mockReturnValue({wideMode: 'min', ...splitFormattingBarControls('min')});

        renderWithContext(
            <FormattingBar {...baseProps}/>,
        );

        expect(screen.getByLabelText('show hidden formatting options')).toBeInTheDocument();
    });

    test('should render hidden formatting button when screen size is narrow', () => {
        jest.spyOn(Hooks, 'useFormattingBarControls').mockReturnValue({wideMode: 'narrow', ...splitFormattingBarControls('narrow')});

        renderWithContext(
            <FormattingBar {...baseProps}/>,
        );

        expect(screen.getByLabelText('show hidden formatting options')).toBeInTheDocument();
    });

    test('should render hidden formatting button when screen size is normal', () => {
        jest.spyOn(Hooks, 'useFormattingBarControls').mockReturnValue({wideMode: 'normal', ...splitFormattingBarControls('normal')});

        renderWithContext(
            <FormattingBar {...baseProps}/>,
        );

        expect(screen.getByLabelText('show hidden formatting options')).toBeInTheDocument();
    });

    test('should not render hidden formatting button when screen size is wide', () => {
        jest.spyOn(Hooks, 'useFormattingBarControls').mockReturnValue({wideMode: 'wide', ...splitFormattingBarControls('wide')});

        renderWithContext(
            <FormattingBar {...baseProps}/>,
        );

        expect(screen.queryByLabelText('show hidden formatting options')).not.toBeInTheDocument();
    });

    test('MM-56705 should not submit form when clicking on hidden formatting button', async () => {
        jest.spyOn(Hooks, 'useFormattingBarControls').mockReturnValue({wideMode: 'narrow', ...splitFormattingBarControls('narrow')});

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
        jest.spyOn(Hooks, 'useFormattingBarControls').mockReturnValue({wideMode: 'narrow', ...splitFormattingBarControls('narrow')});

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

    describe('with additional controls', () => {
        test('should have fewer visible controls when additional controls are present', () => {
            // Mock narrow mode without additional controls (shows 3 icons normally)
            const mockWithoutAdditional = jest.spyOn(Hooks, 'useFormattingBarControls').mockReturnValue({
                wideMode: 'narrow',
                ...splitFormattingBarControls('narrow', 0),
            });

            const {rerender} = renderWithContext(<FormattingBar {...baseProps}/>);

            // Should show bold, italic, strike (3 icons)
            expect(screen.getByLabelText('bold')).toBeInTheDocument();
            expect(screen.getByLabelText('italic')).toBeInTheDocument();
            expect(screen.getByLabelText('strike through')).toBeInTheDocument();

            mockWithoutAdditional.mockRestore();

            // Mock narrow mode WITH 2 additional controls (shows only 1 icon)
            jest.spyOn(Hooks, 'useFormattingBarControls').mockReturnValue({
                wideMode: 'narrow',
                ...splitFormattingBarControls('narrow', 2),
            });

            const mockControl1 = <button key='priority-control'>{'Priority'}</button>;
            const mockControl2 = <button key='bor-control'>{'Burn-on-Read'}</button>;

            rerender(
                <FormattingBar
                    {...baseProps}
                    additionalControls={[mockControl1, mockControl2]}
                />,
            );

            // Should now show only bold (1 icon)
            expect(screen.getByLabelText('bold')).toBeInTheDocument();
            expect(screen.queryByLabelText('italic')).not.toBeInTheDocument();
        });

        test('should show only bold icon in narrow mode with 2+ additional controls', () => {
            jest.spyOn(Hooks, 'useFormattingBarControls').mockReturnValue({wideMode: 'narrow', ...splitFormattingBarControls('narrow', 2)});

            const mockControl1 = <button key='priority-control'>{'Priority'}</button>;
            const mockControl2 = <button key='bor-control'>{'Burn-on-Read'}</button>;

            renderWithContext(
                <FormattingBar
                    {...baseProps}
                    additionalControls={[mockControl1, mockControl2]}
                />,
            );

            expect(screen.getByLabelText('bold')).toBeInTheDocument();
            expect(screen.queryByLabelText('italic')).not.toBeInTheDocument();
        });

        test('should hide all base controls in min mode with additional controls', () => {
            jest.spyOn(Hooks, 'useFormattingBarControls').mockReturnValue({wideMode: 'min', ...splitFormattingBarControls('min', 3)});

            const mockControl1 = <button key='priority-control'>{'Priority'}</button>;
            const mockControl2 = <button key='ai-control'>{'AI Rewrite'}</button>;
            const mockControl3 = <button key='bor-control'>{'Burn-on-Read'}</button>;

            renderWithContext(
                <FormattingBar
                    {...baseProps}
                    additionalControls={[mockControl1, mockControl2, mockControl3]}
                />,
            );

            expect(screen.queryByLabelText('bold')).not.toBeInTheDocument();
            expect(screen.getByLabelText('show hidden formatting options')).toBeInTheDocument();
        });
    });
});
