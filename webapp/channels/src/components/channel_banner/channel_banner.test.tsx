// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';
import {renderWithContext} from 'tests/react_testing_utils';
import {LicenseSkus} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import ChannelBanner from './index';

describe('components/channel_banner', () => {
    const channel1 = TestHelper.getChannelMock({
        id: 'channel_id_1',
        team_id: 'team_id',
        display_name: 'Test Channel 1',
        header: 'This is the channel header',
        name: 'test-channel',
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
        banner_info: {
            text: 'Banner with **markdown**',
            background_color: '#0000FF',
            enabled: true,
        },
    });

    const baseState = {
        entities: {
            general: {
                license: {
                    IsLicensed: 'true',
                    SkuShortName: LicenseSkus.Enterprise,
                },
            },
            channels: {
                channels: {
                    [channel1.id]: channel1,
                    [channel2.id]: channel2,
                    [channel3.id]: channel3,
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

    test('should not render when license is not enterprise', () => {
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
});
