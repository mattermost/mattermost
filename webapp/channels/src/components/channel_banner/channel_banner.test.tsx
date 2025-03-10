// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Provider} from 'react-redux';
import {screen, render} from '@testing-library/react';
import {IntlProvider} from 'react-intl';

import {mockStore} from 'tests/test_store';
import {TestHelper} from 'utils/test_helper';

import ChannelBanner from './index';

describe('components/channel_banner', () => {
    const baseState = {
        entities: {
            general: {
                license: {
                    IsLicensed: 'true',
                    Cloud: 'false',
                    EnterpriseReady: 'true',
                },
            },
            channels: {
                channelBanners: {
                    'channel-id-1': {
                        text: 'Test banner message',
                        background_color: '#FF0000',
                        enabled: true,
                    },
                    'channel-id-2': {
                        text: 'Disabled banner',
                        background_color: '#00FF00',
                        enabled: false,
                    },
                    'channel-id-3': {
                        text: 'Banner with **markdown**',
                        background_color: '#0000FF',
                        enabled: true,
                    },
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

    const renderComponent = (channelId: string, state = baseState) => {
        const store = mockStore(state);

        return render(
            <Provider store={store}>
                <IntlProvider locale='en'>
                    <ChannelBanner channelId={channelId} />
                </IntlProvider>
            </Provider>,
        );
    };

    test('should not render when license is not enterprise', () => {
        const nonEnterpriseLicenseState = {
            ...baseState,
            entities: {
                ...baseState.entities,
                general: {
                    license: {
                        IsLicensed: 'true',
                        Cloud: 'true',
                        EnterpriseReady: 'false',
                    },
                },
            },
        };

        renderComponent('channel-id-1', nonEnterpriseLicenseState);
        expect(screen.queryByTestId('channel_banner_container')).not.toBeInTheDocument();
    });

    test('should not render when banner is disabled', () => {
        renderComponent('channel-id-2');
        expect(screen.queryByTestId('channel_banner_container')).not.toBeInTheDocument();
    });

    test('should not render when channel has no banner', () => {
        renderComponent('non-existent-channel-id');
        expect(screen.queryByTestId('channel_banner_container')).not.toBeInTheDocument();
    });

    test('should render banner with correct text and styling', () => {
        renderComponent('channel-id-1');
        
        const bannerContainer = screen.getByTestId('channel_banner_container');
        expect(bannerContainer).toBeInTheDocument();
        expect(bannerContainer).toHaveStyle('background-color: #FF0000');
        
        const bannerText = screen.getByTestId('channel_banner_text');
        expect(bannerText).toBeInTheDocument();
        expect(bannerText.textContent).toBe('Test banner message');
    });

    test('should render markdown in banner text', () => {
        renderComponent('channel-id-3');
        
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
