// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen} from '@testing-library/react';
import React from 'react';
import {defineMessage, IntlProvider} from 'react-intl';

import TooltipShortcut from './tooltip_shortcut';

// Test wrapper with IntlProvider
const renderWithIntl = (ui: React.ReactElement) => {
    return render(
        <IntlProvider locale='en' messages={{}}>
            {ui}
        </IntlProvider>,
    );
};

describe('TooltipShortcut', () => {
    test('should show default shortcut', () => {
        const shortcut = {
            default: ['Ctrl', 'K'],
        };

        renderWithIntl(<TooltipShortcut shortcut={shortcut}/>);

        expect(screen.getByText('Ctrl')).toBeInTheDocument();
        expect(screen.getByText('K')).toBeInTheDocument();
    });

    test('should show shortcut with multiple keys', () => {
        const shortcut = {
            default: ['Ctrl', 'Shift', 'K'],
        };

        renderWithIntl(<TooltipShortcut shortcut={shortcut}/>);

        expect(screen.getByText('Ctrl')).toBeInTheDocument();
        expect(screen.getByText('Shift')).toBeInTheDocument();
        expect(screen.getByText('K')).toBeInTheDocument();
    });

    test('should show shortcut with message descriptor', () => {
        const shortcut = {
            default: [
                defineMessage({
                    id: 'shortcuts.generic.enter',
                    defaultMessage: 'Enter',
                }),
            ],
        };

        renderWithIntl(<TooltipShortcut shortcut={shortcut}/>);

        expect(screen.getByText('Enter')).toBeInTheDocument();
    });

    test('should render with mac shortcut when provided', () => {
        const shortcut = {
            default: ['Ctrl', 'K'],
            mac: ['⌘', 'K'],
        };

        renderWithIntl(<TooltipShortcut shortcut={shortcut}/>);

        // Should show at least one set of shortcuts
        const hasDefault = screen.queryByText('Ctrl') !== null;
        const hasMac = screen.queryByText('⌘') !== null;

        expect(hasDefault || hasMac).toBe(true);
        expect(screen.getByText('K')).toBeInTheDocument();
    });
});
