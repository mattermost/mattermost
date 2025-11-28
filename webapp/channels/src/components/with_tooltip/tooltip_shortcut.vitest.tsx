// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage} from 'react-intl';
import {describe, test, expect, vi, afterEach} from 'vitest';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';
import * as userAgentUtils from 'utils/user_agent';

import TooltipShortcut from './tooltip_shortcut';

vi.mock('utils/user_agent', () => ({
    isMac: vi.fn(),
}));

describe('TooltipShortcut', () => {
    const isMacMock = vi.mocked(userAgentUtils.isMac);

    afterEach(() => {
        vi.resetAllMocks();
    });

    test('should show non mac shortcut when on non mac', () => {
        isMacMock.mockReturnValue(false);
        const shortcut = {
            default: ['Ctrl', 'K'],
            mac: ['⌘', 'K'],
        };

        renderWithContext(
            <TooltipShortcut shortcut={shortcut}/>,
        );

        expect(screen.getByText('Ctrl')).toBeInTheDocument();
        expect(screen.getByText('K')).toBeInTheDocument();

        expect(screen.queryByText('⌘')).not.toBeInTheDocument();
    });

    test('should show mac shortcut when on mac', () => {
        isMacMock.mockReturnValue(true);

        const shortcut = {
            default: ['Ctrl', 'K'],
            mac: ['⌘', 'K'],
        };

        renderWithContext(
            <TooltipShortcut shortcut={shortcut}/>,
        );

        expect(screen.getByText('⌘')).toBeInTheDocument();
        expect(screen.getByText('K')).toBeInTheDocument();

        expect(screen.queryByText('Ctrl')).not.toBeInTheDocument();
    });

    test('show shortcut with message descriptor', () => {
        const shortcut = {
            default: [
                defineMessage({
                    id: 'shortcuts.generic.enter',
                    defaultMessage: 'Enter',
                }),
            ],
        };

        renderWithContext(
            <TooltipShortcut shortcut={shortcut}/>,
        );

        expect(screen.getByText('Enter')).toBeInTheDocument();
    });
});
