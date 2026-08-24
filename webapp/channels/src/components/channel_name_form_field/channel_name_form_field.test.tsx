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

describe('ChannelNameFormField - display name validation', () => {
    const emptyErrorMessage = 'Channel names must have at least 1 character.';

    test('should not report an error when focus leaves an untouched pre-filled field', async () => {
        const onErrorStateChange = jest.fn();
        renderWithContext(
            <ChannelNameFormField
                {...baseProps}
                isEditingExistingChannel={true}
                currentUrl='test-channel'
                onErrorStateChange={onErrorStateChange}
            />,
            makeState('false'),
        );

        await userEvent.click(screen.getByRole('textbox', {name: 'Channel name'}));
        await userEvent.tab();

        expect(screen.queryByText(emptyErrorMessage)).not.toBeInTheDocument();
        expect(onErrorStateChange).not.toHaveBeenCalledWith(true, expect.anything());
    });

    test('should report an error when focus leaves a field the user emptied', async () => {
        const Wrapper = () => {
            const [value, setValue] = React.useState('Test Channel');
            return (
                <ChannelNameFormField
                    {...baseProps}
                    value={value}
                    isEditingExistingChannel={true}
                    currentUrl='test-channel'
                    onDisplayNameChange={setValue}
                />
            );
        };

        renderWithContext(<Wrapper/>, makeState('false'));

        const nameInput = screen.getByRole('textbox', {name: 'Channel name'});
        await userEvent.clear(nameInput);
        await userEvent.tab();

        expect(nameInput).toHaveValue('');
        expect(screen.getByText(emptyErrorMessage)).toBeInTheDocument();
    });

    test('should clear the error once the user types a valid name again', async () => {
        const Wrapper = () => {
            const [value, setValue] = React.useState('Test Channel');
            return (
                <ChannelNameFormField
                    {...baseProps}
                    value={value}
                    isEditingExistingChannel={true}
                    currentUrl='test-channel'
                    onDisplayNameChange={setValue}
                />
            );
        };

        renderWithContext(<Wrapper/>, makeState('false'));

        const nameInput = screen.getByRole('textbox', {name: 'Channel name'});
        await userEvent.clear(nameInput);
        await userEvent.tab();
        expect(screen.getByText(emptyErrorMessage)).toBeInTheDocument();

        await userEvent.type(nameInput, 'Renamed Channel');
        await userEvent.tab();

        expect(nameInput).toHaveValue('Renamed Channel');
        expect(screen.queryByText(emptyErrorMessage)).not.toBeInTheDocument();
    });
});
