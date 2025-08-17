// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import userEvent from '@testing-library/user-event';
import React from 'react';

import {renderWithContext, screen, waitFor, act} from 'tests/react_testing_utils';

import WithTooltip from './index';

jest.mock('utils/user_agent', () => ({
    isMac: jest.fn().mockReturnValue(false),
}));

describe('WithTooltip', () => {
    test('renders children correctly', async () => {
        renderWithContext(
            <WithTooltip title='TooltipOfButton'>
                <button>{'I am a button surrounded by a tooltip'}</button>
            </WithTooltip>,
        );

        expect(screen.getByText('I am a button surrounded by a tooltip')).toBeInTheDocument();
    });

    test('shows tooltip on hover', async () => {
        jest.useFakeTimers();

        renderWithContext(
            <WithTooltip title='Tooltip will appear on hover'>
                <div>{'Hover Me'}</div>
            </WithTooltip>,
        );

        await act(async () => {
            userEvent.hover(screen.getByText('Hover Me'));

            jest.advanceTimersByTime(1000);

            await waitFor(() => {
                expect(screen.getByText('Tooltip will appear on hover')).toBeInTheDocument();
            });
        });
    });

    test('shows tooltip on focus', async () => {
        jest.useFakeTimers();

        renderWithContext(
            <WithTooltip title='Tooltip will appear on hover'>
                <button>{'Hover Me'}</button>
            </WithTooltip>,
        );

        await act(async () => {
            const trigger = screen.getByText('Hover Me');

            // Clicking the button will simulate a focus event
            userEvent.click(trigger);

            jest.advanceTimersByTime(1000);

            await waitFor(() => {
                expect(trigger).toHaveFocus();
                expect(screen.getByText('Tooltip will appear on hover')).toBeInTheDocument();
            });
        });
    });

    test('calls onOpen when tooltip appears', async () => {
        const onOpen = jest.fn();

        jest.useFakeTimers();

        renderWithContext(
            <WithTooltip
                title='Tooltip will appear on hover'
                onOpen={onOpen}
            >
                <div>{'Hover Me'}</div>
            </WithTooltip>,
        );

        await act(async () => {
            expect(onOpen).not.toHaveBeenCalled();

            userEvent.hover(screen.getByText('Hover Me'));

            jest.advanceTimersByTime(1000);

            await waitFor(() => {
                expect(screen.getByText('Tooltip will appear on hover')).toBeInTheDocument();
                expect(onOpen).toHaveBeenCalled();
            });
        });
    });
});
