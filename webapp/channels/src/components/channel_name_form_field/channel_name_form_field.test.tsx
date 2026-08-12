// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import ChannelNameFormField from 'components/channel_name_form_field/channel_name_form_field';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {LicenseSkus} from 'utils/constants';

const baseProps = {
    value: 'Test Channel',
    name: 'channel-name',
    placeholder: 'Enter channel name',
    onDisplayNameChange: jest.fn(),
    onURLChange: jest.fn(),
};

const makeState = (UseAnonymousURLs: string) => ({
    entities: {
        general: {
            config: {
                UseAnonymousURLs,
            },
            license: {SkuShortName: LicenseSkus.EnterpriseAdvanced},
        },
        teams: {
            currentTeamId: 'team-id',
            teams: {
                'team-id': {
                    id: 'team-id',
                    name: 'test-team',
                    display_name: 'Test Team',
                },
            },
        },
    },
});

describe('ChannelNameFormField - blur validation', () => {
    test('does not report empty-name error on blur when controlled value is set', async () => {
        const user = userEvent.setup();
        const onErrorStateChange = jest.fn();
        renderWithContext(
            <ChannelNameFormField
                {...baseProps}
                value='Default remove 1785379992891'
                onErrorStateChange={onErrorStateChange}
                isEditingExistingChannel={true}
            />,
            makeState('false'),
        );

        const nameInput = screen.getByRole('textbox', {name: /channel name/i});
        await user.click(nameInput);
        await user.tab();

        expect(screen.queryByText('Channel names must have at least 1 character.')).not.toBeInTheDocument();
        expect(onErrorStateChange).not.toHaveBeenCalledWith(true, expect.any(String));
    });

    test('does not validate on blur for existing channels until the name is edited', async () => {
        const user = userEvent.setup();
        const onErrorStateChange = jest.fn();
        renderWithContext(
            <ChannelNameFormField
                {...baseProps}
                value='Existing Channel'
                onErrorStateChange={onErrorStateChange}
                isEditingExistingChannel={true}
                autoFocus={true}
            />,
            makeState('false'),
        );

        const nameInput = screen.getByRole('textbox', {name: /channel name/i});
        expect(nameInput).toHaveFocus();
        await user.tab();

        expect(screen.queryByText('Channel names must have at least 1 character.')).not.toBeInTheDocument();
        expect(onErrorStateChange).not.toHaveBeenCalledWith(true, expect.any(String));
    });

    test('clears a sticky empty-name error when the controlled value becomes valid', async () => {
        const user = userEvent.setup();
        const onErrorStateChange = jest.fn();
        const {rerender} = renderWithContext(
            <ChannelNameFormField
                {...baseProps}
                value=''
                onErrorStateChange={onErrorStateChange}
            />,
            makeState('false'),
        );

        const nameInput = screen.getByRole('textbox', {name: /channel name/i});
        await user.click(nameInput);
        await user.tab();
        expect(screen.getByText('Channel names must have at least 1 character.')).toBeInTheDocument();

        rerender(
            <ChannelNameFormField
                {...baseProps}
                value='Recovered Channel'
                onErrorStateChange={onErrorStateChange}
            />,
        );

        expect(screen.queryByText('Channel names must have at least 1 character.')).not.toBeInTheDocument();
    });
});

describe('ChannelNameFormField - URL editor visibility', () => {
    test('should show URL editor when UseAnonymousURLs is false and creating a new channel', () => {
        renderWithContext(
            <ChannelNameFormField {...baseProps}/>,
            makeState('false'),
        );

        expect(screen.getByTestId('urlInputLabel')).toBeVisible();
    });

    test('should show URL editor when UseAnonymousURLs is false and editing an existing channel', () => {
        renderWithContext(
            <ChannelNameFormField
                {...baseProps}
                isEditingExistingChannel={true}
            />,
            makeState('false'),
        );

        expect(screen.getByTestId('urlInputLabel')).toBeVisible();
    });

    test('should not show URL editor when UseAnonymousURLs is true and creating a new channel', () => {
        renderWithContext(
            <ChannelNameFormField {...baseProps}/>,
            makeState('true'),
        );

        expect(screen.queryByTestId('urlInputLabel')).not.toBeInTheDocument();
    });

    test('should show URL editor when UseAnonymousURLs is true and editing an existing channel', () => {
        renderWithContext(
            <ChannelNameFormField
                {...baseProps}
                isEditingExistingChannel={true}
            />,
            makeState('true'),
        );

        expect(screen.getByTestId('urlInputLabel')).toBeVisible();
    });
});
