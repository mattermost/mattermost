// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import {IntlProvider} from 'react-intl';

import WithTooltip from './index';

// Test wrapper with IntlProvider
const renderWithIntl = (ui: React.ReactElement) => {
    return render(
        <IntlProvider locale='en' messages={{}}>
            {ui}
        </IntlProvider>,
    );
};

describe('WithTooltip', () => {
    test('renders children correctly', () => {
        renderWithIntl(
            <WithTooltip title='TooltipOfButton'>
                <button>{'I am a button surrounded by a tooltip'}</button>
            </WithTooltip>,
        );

        expect(screen.getByText('I am a button surrounded by a tooltip')).toBeInTheDocument();
    });

    test('shows tooltip on hover', async () => {
        const user = userEvent.setup();

        renderWithIntl(
            <WithTooltip title='Tooltip will appear on hover'>
                <div>{'Hover Me'}</div>
            </WithTooltip>,
        );

        const trigger = screen.getByText('Hover Me');
        await user.hover(trigger);

        await waitFor(() => {
            expect(screen.getByText('Tooltip will appear on hover')).toBeInTheDocument();
        });
    });

    test('shows tooltip on focus', async () => {
        const user = userEvent.setup();

        renderWithIntl(
            <WithTooltip title='Tooltip will appear on focus'>
                <button>{'Focus Me'}</button>
            </WithTooltip>,
        );

        const trigger = screen.getByText('Focus Me');
        await user.click(trigger);

        await waitFor(() => {
            expect(trigger).toHaveFocus();
            expect(screen.getByText('Tooltip will appear on focus')).toBeInTheDocument();
        });
    });

    test('calls onOpen when tooltip appears', async () => {
        const onOpen = jest.fn();
        const user = userEvent.setup();

        renderWithIntl(
            <WithTooltip
                title='Tooltip will appear on hover'
                onOpen={onOpen}
            >
                <div>{'Hover Me'}</div>
            </WithTooltip>,
        );

        expect(onOpen).not.toHaveBeenCalled();

        const trigger = screen.getByText('Hover Me');
        await user.hover(trigger);

        await waitFor(() => {
            expect(screen.getByText('Tooltip will appear on hover')).toBeInTheDocument();
            expect(onOpen).toHaveBeenCalled();
        });
    });
});
