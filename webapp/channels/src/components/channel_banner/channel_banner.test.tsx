// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';

import {renderWithContext} from 'tests/react_testing_utils';
import {LicenseSkus, Constants} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import ChannelBanner from './channel_banner';

describe('components/channel_banner', () => {
    const channel1 = TestHelper.getChannelMock({
        id: 'channel_id_1',
        team_id: 'team_id',
        display_name: 'Test Channel 1',
        header: 'This is the channel header',
        name: 'test-channel',
        type: Constants.OPEN_CHANNEL as ChannelType,
        banner_info: {
            text: 'Test banner message',
            background_color: '#FF0000',
            enabled: true,
        },
    });

    const channel2 = TestHelper.getChannelMock({
        id: 'channel_id_2',
        team_id: 'team_id',
        display_name: 'Test Channel 2',
        header: 'This is the channel header',
        name: 'test-channel',
        type: Constants.OPEN_CHANNEL as ChannelType,
        banner_info: {
            text: 'Disabled banner',
            background_color: '#00FF00',
            enabled: false,
        },
    });

    const channel3 = TestHelper.getChannelMock({
        id: 'channel_id_3',
        team_id: 'team_id',
        display_name: 'Test Channel 3',
        header: 'This is the channel header',
        name: 'test-channel',
        type: Constants.OPEN_CHANNEL as ChannelType,
        banner_info: {
            text: 'Banner with **markdown**',
            background_color: '#0000FF',
            enabled: true,
        },
    });

    const dmChannel = TestHelper.getChannelMock({
        id: 'dm_channel_id',
        team_id: 'team_id',
        display_name: 'DM Channel',
        name: 'dm-channel',
        type: Constants.DM_CHANNEL as ChannelType,
        banner_info: {
            text: 'DM Banner',
            background_color: '#FF00FF',
            enabled: true,
        },
    });

    const privateChannel = TestHelper.getChannelMock({
        id: 'private_channel_id',
        team_id: 'team_id',
        display_name: 'Private Channel',
        name: 'private-channel',
        type: Constants.PRIVATE_CHANNEL as ChannelType,
        banner_info: {
            text: 'Private Channel Banner',
            background_color: '#FFFF00',
            enabled: true,
        },
    });

    const baseState = {
        entities: {
            general: {
                license: {
                    IsLicensed: 'true',
                    SkuShortName: LicenseSkus.EnterpriseAdvanced,
                },
            },
            channels: {
                channels: {
                    [channel1.id]: channel1,
                    [channel2.id]: channel2,
                    [channel3.id]: channel3,
                    [dmChannel.id]: dmChannel,
                    [privateChannel.id]: privateChannel,
                },
            },
            users: {
                currentUserId: 'current-user-id',
                profiles: {
                    'current-user-id': TestHelper.getUserMock({
                        id: 'current-user-id',
                        username: 'current-user',
                    }),
                },
            },
        },
    };

    test('should not render when license is professional', () => {
        const nonEnterpriseLicenseState = {
            ...baseState,
            entities: {
                ...baseState.entities,
                general: {
                    license: {
                        IsLicensed: 'true',
                        SkuShortName: LicenseSkus.Professional,
                    },
                },
            },
        };

        renderWithContext(
            <ChannelBanner channelId={'channel_id_1'}/>,
            nonEnterpriseLicenseState,
        );
        expect(screen.queryByTestId('channel_banner_container')).not.toBeInTheDocument();
    });

    test('should not render when license is enterprise', () => {
        const nonEnterpriseLicenseState = {
            ...baseState,
            entities: {
                ...baseState.entities,
                general: {
                    license: {
                        IsLicensed: 'true',
                        SkuShortName: LicenseSkus.Enterprise,
                    },
                },
            },
        };

        renderWithContext(
            <ChannelBanner channelId={'channel_id_1'}/>,
            nonEnterpriseLicenseState,
        );
        expect(screen.queryByTestId('channel_banner_container')).not.toBeInTheDocument();
    });

    test('should not render when there is no license', () => {
        const noLicenseState = {
            ...baseState,
            entities: {
                ...baseState.entities,
                general: {},
            },
        };

        renderWithContext(
            <ChannelBanner channelId={'channel_id_1'}/>,
            noLicenseState,
        );
        expect(screen.queryByTestId('channel_banner_container')).not.toBeInTheDocument();
    });

    test('should not render when banner is disabled', () => {
        renderWithContext(
            <ChannelBanner channelId={'channel_id_2'}/>,
            baseState,
        );
        expect(screen.queryByTestId('channel_banner_container')).not.toBeInTheDocument();
    });

    test('should not render when channel has no banner', () => {
        renderWithContext(
            <ChannelBanner channelId={'non-existent-channel-id'}/>,
            baseState,
        );
        expect(screen.queryByTestId('channel_banner_container')).not.toBeInTheDocument();
    });

    test('should not render when banner info is incomplete', () => {
        const channel = TestHelper.getChannelMock({
            id: 'channel_id_1',
            team_id: 'team_id',
            display_name: 'Test Channel 1',
            header: 'This is the channel header',
            name: 'test-channel',
            banner_info: {

                // incomplete channel banner info
                enabled: true,
            },
        });

        const incompleteBannerInfoState = {
            ...baseState,
            entities: {
                ...baseState.entities,
                channels: {
                    ...baseState.entities.channels,
                    channels: {
                        ...baseState.entities.channels.channels,
                        [channel.id]: channel,
                    },
                },
            },
        };

        renderWithContext(
            <ChannelBanner channelId={'channel_id_1'}/>,
            incompleteBannerInfoState,
        );
        expect(screen.queryByTestId('channel_banner_container')).not.toBeInTheDocument();
    });

    test('should render banner with correct text and styling', () => {
        renderWithContext(
            <ChannelBanner channelId={'channel_id_1'}/>,
            baseState,
        );

        const bannerContainer = screen.getByTestId('channel_banner_container');
        expect(bannerContainer).toBeInTheDocument();
        expect(bannerContainer).toHaveStyle('background-color: #FF0000');

        const bannerText = screen.getByTestId('channel_banner_text');
        expect(bannerText).toBeInTheDocument();
        expect(bannerText.textContent).toBe('Test banner message');
    });

    test('should render markdown in banner text', () => {
        renderWithContext(
            <ChannelBanner channelId={'channel_id_3'}/>,
            baseState,
        );

        const bannerContainer = screen.getByTestId('channel_banner_container');
        expect(bannerContainer).toBeInTheDocument();
        expect(bannerContainer).toHaveStyle('background-color: #0000FF');

        const bannerText = screen.getByTestId('channel_banner_text');
        expect(bannerText).toBeInTheDocument();

        // Check that markdown was rendered (bold text)
        const strongElement = bannerText.querySelector('strong');
        expect(strongElement).toBeInTheDocument();
        expect(strongElement?.textContent).toBe('markdown');
    });

    test('should render for private channels', () => {
        renderWithContext(
            <ChannelBanner channelId={'private_channel_id'}/>,
            baseState,
        );

        const bannerContainer = screen.getByTestId('channel_banner_container');
        expect(bannerContainer).toBeInTheDocument();
        expect(bannerContainer).toHaveStyle('background-color: #FFFF00');

        const bannerText = screen.getByTestId('channel_banner_text');
        expect(bannerText).toBeInTheDocument();
        expect(bannerText.textContent).toBe('Private Channel Banner');
    });

    test('should not render for DM channels', () => {
        renderWithContext(
            <ChannelBanner channelId={'dm_channel_id'}/>,
            baseState,
        );

        expect(screen.queryByTestId('channel_banner_container')).not.toBeInTheDocument();
    });

    test('should apply contrasting text color based on dark background color', () => {
        // dark background should have dark text
        const darkBgChannel = TestHelper.getChannelMock({
            id: 'light_bg_channel',
            team_id: 'team_id',
            display_name: 'Light BG Channel',
            name: 'light-bg-channel',
            type: Constants.OPEN_CHANNEL as ChannelType,
            banner_info: {
                text: 'Light background banner',
                background_color: '#000000',
                enabled: true,
            },
        });

        const stateWithLightBgChannel = {
            ...baseState,
            entities: {
                ...baseState.entities,
                channels: {
                    ...baseState.entities.channels,
                    channels: {
                        ...baseState.entities.channels.channels,
                        [darkBgChannel.id]: darkBgChannel,
                    },
                },
            },
        };

        renderWithContext(
            <ChannelBanner channelId={'light_bg_channel'}/>,
            stateWithLightBgChannel,
        );

        // This test might be flaky depending on how getContrastingSimpleColor is implemented
        // We're expecting dark text on light background
        const darkBgBannerText = screen.getByTestId('channel_banner_text');
        expect(darkBgBannerText).toBeInTheDocument();
        expect(darkBgBannerText).toHaveStyle('color: rgb(255, 255, 255)');
        expect(darkBgBannerText).toHaveStyle('--channel-banner-text-color: #FFFFFF');
    });

    test('should apply contrasting text color based on light background color', () => {
        // Light background should have dark text
        const lightBgChannel = TestHelper.getChannelMock({
            id: 'light_bg_channel',
            team_id: 'team_id',
            display_name: 'Light BG Channel',
            name: 'light-bg-channel',
            type: Constants.OPEN_CHANNEL as ChannelType,
            banner_info: {
                text: 'Light background banner',
                background_color: '#FFFFFF',
                enabled: true,
            },
        });

        const stateWithLightBgChannel = {
            ...baseState,
            entities: {
                ...baseState.entities,
                channels: {
                    ...baseState.entities.channels,
                    channels: {
                        ...baseState.entities.channels.channels,
                        [lightBgChannel.id]: lightBgChannel,
                    },
                },
            },
        };

        renderWithContext(
            <ChannelBanner channelId={'light_bg_channel'}/>,
            stateWithLightBgChannel,
        );

        // This test might be flaky depending on how getContrastingSimpleColor is implemented
        // We're expecting dark text on light background
        const lightBgBannerText = screen.getByTestId('channel_banner_text');
        expect(lightBgBannerText).toBeInTheDocument();
        expect(lightBgBannerText).toHaveStyle('color: rgb(0, 0, 0)');
        expect(lightBgBannerText).toHaveStyle('--channel-banner-text-color: #000000');
    });
});
