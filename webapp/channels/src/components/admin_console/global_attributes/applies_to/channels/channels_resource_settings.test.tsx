// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {DISPLAY_BANNER_TOP, DISPLAY_LABEL_HEADER} from 'mattermost-redux/constants/properties';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import ChannelsResourceSettings from './channels_resource_settings';
import type {ChannelResourceConfig} from './types';
import {DEFAULT_CHANNEL_RESOURCE_CONFIG} from './types';

describe('ChannelsResourceSettings', () => {
    const requiredEnabledState: DeepPartial<GlobalState> = {
        entities: {
            general: {
                config: {
                    FeatureFlagChannelAttributes: 'true',
                    FeatureFlagChannelAttributesRequired: 'true',
                },
            },
        },
    };

    const renderSettings = (
        value: ChannelResourceConfig = DEFAULT_CHANNEL_RESOURCE_CONFIG,
        state?: DeepPartial<GlobalState>,
        props: {disabled?: boolean} = {},
    ) => {
        const onChange = jest.fn();

        renderWithContext(
            <ChannelsResourceSettings
                value={value}
                onChange={onChange}
                testIdScope='admin.attribute.applies_to.channel.settings'
                disabled={props.disabled}
            />,
            state,
        );

        return {onChange};
    };

    it('hides the Required toggle by default (ChannelAttributesRequired off)', () => {
        renderSettings();

        expect(screen.queryByTestId('admin.attribute.applies_to.channel.settings.required--switch')).not.toBeInTheDocument();
        expect(screen.queryByText('Required')).not.toBeInTheDocument();
    });

    it('shows the Required toggle when ChannelAttributesRequired is on', () => {
        renderSettings(DEFAULT_CHANNEL_RESOURCE_CONFIG, requiredEnabledState);

        expect(screen.getByTestId('admin.attribute.applies_to.channel.settings.required--switch')).toBeInTheDocument();
        expect(screen.getByText('Required')).toBeInTheDocument();
    });

    it('still shows every other setting when the Required toggle is hidden', () => {
        renderSettings();

        expect(screen.getByText('Display location')).toBeInTheDocument();
        expect(screen.getByText('Changing the value')).toBeInTheDocument();
    });

    it('renders Header and Banner location checkboxes', () => {
        renderSettings({
            ...DEFAULT_CHANNEL_RESOURCE_CONFIG,
            displayLocations: [DISPLAY_LABEL_HEADER],
        });

        const header = screen.getByTestId(`admin.attribute.applies_to.channel.settings.location:${DISPLAY_LABEL_HEADER}--checkbox`);
        const banner = screen.getByTestId(`admin.attribute.applies_to.channel.settings.location:${DISPLAY_BANNER_TOP}--checkbox`);

        expect(header).toBeChecked();
        expect(banner).not.toBeChecked();
        expect(screen.getByText('Header')).toBeInTheDocument();
        expect(screen.getByText('Banner')).toBeInTheDocument();
    });

    it('toggles a display location via Compass Checkbox', async () => {
        const {onChange} = renderSettings({
            ...DEFAULT_CHANNEL_RESOURCE_CONFIG,
            displayLocations: [],
        });

        await userEvent.click(screen.getByTestId(`admin.attribute.applies_to.channel.settings.location:${DISPLAY_LABEL_HEADER}--checkbox`));

        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
            displayLocations: [DISPLAY_LABEL_HEADER],
        }));
    });

    it('disables location checkboxes when disabled', () => {
        renderSettings(DEFAULT_CHANNEL_RESOURCE_CONFIG, undefined, {disabled: true});

        expect(screen.getByTestId(`admin.attribute.applies_to.channel.settings.location:${DISPLAY_LABEL_HEADER}--checkbox`)).toBeDisabled();
        expect(screen.getByTestId(`admin.attribute.applies_to.channel.settings.location:${DISPLAY_BANNER_TOP}--checkbox`)).toBeDisabled();
    });

    it('keeps the Required control as a switch, not a Compass Checkbox', () => {
        renderSettings(DEFAULT_CHANNEL_RESOURCE_CONFIG, requiredEnabledState);

        expect(screen.getByTestId('admin.attribute.applies_to.channel.settings.required--switch')).toHaveAttribute('role', 'switch');
    });
});
