// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, waitFor, fireEvent} from 'tests/vitest_react_testing_utils';

import WithTooltip from './index';

vi.mock('utils/user_agent', () => ({
    isMac: vi.fn().mockReturnValue(false),
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
        renderWithContext(
            <WithTooltip title='Tooltip will appear on hover'>
                <div>{'Hover Me'}</div>
            </WithTooltip>,
        );

        fireEvent.mouseEnter(screen.getByText('Hover Me'));

        await waitFor(() => {
            expect(screen.getByText('Tooltip will appear on hover')).toBeInTheDocument();
        });
    });

    // Skip: floating-ui's useFocus hook uses keyboard modality detection (similar to :focus-visible)
    // which relies on browser APIs that JSDOM doesn't properly implement.
    // The hook checks if focus was triggered via keyboard (Tab navigation) vs mouse click.
    // In JSDOM, neither fireEvent.focus(), element.focus(), userEvent.tab(), nor
    // keyDown + focus combinations properly trigger floating-ui's keyboard detection.
    // This would require real browser testing (e.g., Playwright) to properly test.
    test.skip('shows tooltip on focus', async () => {
        renderWithContext(
            <WithTooltip title='Tooltip will appear on focus'>
                <button>{'Focus Me'}</button>
            </WithTooltip>,
        );

        const trigger = screen.getByRole('button', {name: 'Focus Me'});
        trigger.focus();

        await waitFor(() => {
            expect(screen.getByText('Tooltip will appear on focus')).toBeInTheDocument();
        });
    });

    test('calls onOpen when tooltip appears', async () => {
        const onOpen = vi.fn();

        renderWithContext(
            <WithTooltip
                title='Tooltip will appear on hover'
                onOpen={onOpen}
            >
                <div>{'Hover Me'}</div>
            </WithTooltip>,
        );

        expect(onOpen).not.toHaveBeenCalled();

        fireEvent.mouseEnter(screen.getByText('Hover Me'));

        await waitFor(() => {
            expect(screen.getByText('Tooltip will appear on hover')).toBeInTheDocument();
            expect(onOpen).toHaveBeenCalled();
        });
    });
});
