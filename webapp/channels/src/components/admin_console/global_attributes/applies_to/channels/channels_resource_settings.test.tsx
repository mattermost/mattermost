// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import ChannelsResourceSettings from './channels_resource_settings';
import {DEFAULT_CHANNEL_RESOURCE_CONFIG} from './types';

describe('ChannelsResourceSettings', () => {
    const killSwitchOnState: DeepPartial<GlobalState> = {
        entities: {
            general: {
                config: {FeatureFlagChannelAttributesRequiredDisabled: 'true'},
            },
        },
    };

    const renderSettings = (state?: DeepPartial<GlobalState>) => {
        const onChange = jest.fn();

        renderWithContext(
            <ChannelsResourceSettings
                value={DEFAULT_CHANNEL_RESOURCE_CONFIG}
                onChange={onChange}
            />,
            state,
        );

        return {onChange};
    };

    it('shows the Required toggle by default (kill switch off)', () => {
        renderSettings();

        expect(screen.getByTestId('channelsResourceRequired-button')).toBeInTheDocument();
        expect(screen.getByText('Required')).toBeInTheDocument();
    });

    it('hides the Required toggle entirely when ChannelAttributesRequiredDisabled is on', () => {
        renderSettings(killSwitchOnState);

        expect(screen.queryByTestId('channelsResourceRequired-button')).not.toBeInTheDocument();
        expect(screen.queryByText('Required')).not.toBeInTheDocument();
    });

    it('still shows every other setting when the Required toggle is hidden', () => {
        renderSettings(killSwitchOnState);

        expect(screen.getByText('Display location')).toBeInTheDocument();
        expect(screen.getByText('Changing the value')).toBeInTheDocument();
    });
});
