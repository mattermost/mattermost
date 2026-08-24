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

describe('ChannelNameFormField - default channel URL', () => {
    const defaultChannelProps = {
        ...baseProps,
        value: 'Town Square',
        currentUrl: 'town-square',
        isEditingExistingChannel: true,
        isDefaultChannel: true,
    };

    const ordinaryChannelProps = {
        ...baseProps,
        value: 'Test Channel',
        currentUrl: 'test-channel',
        isEditingExistingChannel: true,
    };

    test('should not offer the URL Edit button for the default channel', () => {
        renderWithContext(
            <ChannelNameFormField {...defaultChannelProps}/>,
            makeState('false'),
        );

        expect(screen.getByTestId('urlInputLabel')).toHaveTextContent('town-square');
        expect(screen.queryByRole('button', {name: 'Edit'})).not.toBeInTheDocument();
        expect(screen.queryByTestId('channelURLInput')).not.toBeInTheDocument();
        expect(screen.getByText('The URL of the default channel cannot be changed.')).toBeVisible();
    });

    test('should keep the default channel URL locked while an error is displayed', () => {
        renderWithContext(
            <ChannelNameFormField
                {...defaultChannelProps}
                urlError='URL is already taken'
            />,
            makeState('false'),
        );

        expect(screen.getByRole('alert')).toHaveTextContent('URL is already taken');
        expect(screen.queryByTestId('channelURLInput')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Edit'})).not.toBeInTheDocument();
    });

    test('should let the user edit the URL of a non-default channel', async () => {
        const onURLChange = jest.fn();

        renderWithContext(
            <ChannelNameFormField
                {...ordinaryChannelProps}
                onURLChange={onURLChange}
            />,
            makeState('false'),
        );

        expect(screen.queryByText('The URL of the default channel cannot be changed.')).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', {name: 'Edit'}));

        const urlInput = screen.getByTestId('channelURLInput');
        expect(urlInput).toHaveValue('test-channel');

        await userEvent.type(urlInput, '-renamed');

        expect(urlInput).toHaveValue('test-channel-renamed');
        expect(onURLChange).toHaveBeenLastCalledWith('test-channel-renamed');
    });
});
