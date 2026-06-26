// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import ChannelNameFormField from 'components/channel_name_form_field/channel_name_form_field';

import {renderWithContext, screen} from 'tests/react_testing_utils';
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
