// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import {ChannelModes} from './channel_modes';

describe('admin_console/team_channel_settings/channel/ChannelModes', () => {
    test('should match snapshot', async () => {
        const {container} = await renderWithContext(
            <ChannelModes
                onToggle={jest.fn()}
                isPublic={true}
                isSynced={false}
                isDefault={false}
                isDisabled={false}
                groupsSupported={true}
                policyEnforced={false}
                policyEnforcedToggleAvailable={false}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot - not licensed for Group', async () => {
        const {container} = await renderWithContext(
            <ChannelModes
                onToggle={jest.fn()}
                isPublic={true}
                isSynced={false}
                isDefault={false}
                isDisabled={false}
                groupsSupported={false}
                policyEnforced={false}
                policyEnforcedToggleAvailable={false}
            />,
        );
        expect(container).toMatchSnapshot();
    });
});
