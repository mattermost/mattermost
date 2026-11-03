// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, within} from 'tests/react_testing_utils';

import type {BotCreateWarnings} from './bot_create_warnings';
import BotCreateWarningsBanner from './bot_create_warnings_banner';

const TITLE = 'Bot account created, but some settings were not saved';
const TOKEN = "An access token could not be created. Create one from this bot's Create New Token option, or ask a System Admin if you don't have permission.";
const ROLES = 'The role and post permissions could not be saved. Edit the bot to set them again.';
const ATTRS = 'Attributes could not be saved. Edit the bot to add them again.';
const ALL_LINES = [TOKEN, ROLES, ATTRS];

describe('components/integrations/bots/BotCreateWarningsBanner', () => {
    test('renders nothing without warnings', () => {
        const {rerender} = renderWithContext(
            <BotCreateWarningsBanner
                warnings={undefined}
                onDismiss={jest.fn()}
            />,
        );
        expect(screen.queryByTestId('botCreateWarnings')).toBeNull();

        rerender(
            <BotCreateWarningsBanner
                warnings={{}}
                onDismiss={jest.fn()}
            />,
        );
        expect(screen.queryByTestId('botCreateWarnings')).toBeNull();

        rerender(
            <BotCreateWarningsBanner
                warnings={{tokenFailed: false, rolesFailed: false, attributesFailed: false}}
                onDismiss={jest.fn()}
            />,
        );
        expect(screen.queryByTestId('botCreateWarnings')).toBeNull();
    });

    test.each<[string, BotCreateWarnings, string[]]>([
        ['token', {tokenFailed: true}, [TOKEN]],
        ['roles', {rolesFailed: true}, [ROLES]],
        ['attributes', {attributesFailed: true}, [ATTRS]],
        ['token + roles', {tokenFailed: true, rolesFailed: true}, [TOKEN, ROLES]],
        ['token + attributes', {tokenFailed: true, attributesFailed: true}, [TOKEN, ATTRS]],
        ['roles + attributes', {rolesFailed: true, attributesFailed: true}, [ROLES, ATTRS]],
        ['token + roles + attributes', {tokenFailed: true, rolesFailed: true, attributesFailed: true}, [TOKEN, ROLES, ATTRS]],
    ])('renders %s', (_, warnings, expectedLines) => {
        renderWithContext(
            <BotCreateWarningsBanner
                warnings={warnings}
                onDismiss={jest.fn()}
            />,
        );

        const banner = screen.getByTestId('botCreateWarnings');
        expect(banner).toHaveClass('warning');
        expect(within(banner).getByText(TITLE)).toBeInTheDocument();
        for (const line of ALL_LINES) {
            if (expectedLines.includes(line)) {
                expect(within(banner).getByText(line)).toBeInTheDocument();
            } else {
                expect(within(banner).queryByText(line)).toBeNull();
            }
        }
    });

    test('orders lines token, roles, attributes', () => {
        renderWithContext(
            <BotCreateWarningsBanner
                warnings={{attributesFailed: true, rolesFailed: true, tokenFailed: true}}
                onDismiss={jest.fn()}
            />,
        );

        const banner = screen.getByTestId('botCreateWarnings');
        const lines = Array.from(banner.querySelectorAll('.AlertBanner__message > div')).map((div) => div.textContent);
        expect(lines).toEqual([TOKEN, ROLES, ATTRS]);
    });

    test('calls onDismiss from the close button', async () => {
        const onDismiss = jest.fn();
        renderWithContext(
            <BotCreateWarningsBanner
                warnings={{rolesFailed: true}}
                onDismiss={onDismiss}
            />,
        );

        const banner = screen.getByTestId('botCreateWarnings');
        await userEvent.click(within(banner).getByRole('button', {name: 'Close'}));
        expect(onDismiss).toHaveBeenCalledTimes(1);
    });
});
