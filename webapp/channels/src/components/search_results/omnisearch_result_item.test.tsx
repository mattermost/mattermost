// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen} from '@testing-library/react';
import React from 'react';
import {IntlProvider} from 'react-intl';
import {Provider} from 'react-redux';

import mockStore from 'tests/test_store';

import OmniSearchResultItem from './omnisearch_result_item';

describe('components/search_results/OmniSearchResultItem', () => {
    const defaultStore = {
        entities: {
            general: {
                config: {
                    EnableLinkPreviews: 'true',
                    EnableSVGs: 'true',
                    HasImageProxy: 'true',
                    TelemetryId: 'telemetry_id',
                },
                license: {
                    Cloud: 'false',
                },
            },
            preferences: {
                myPreferences: {},
            },
            users: {
                currentUserId: 'user-1',
                profiles: {
                    'user-1': {
                        id: 'user-1',
                        username: 'test-user',
                    },
                },
            },
            channels: {
                channels: {},
                myMembers: {},
                channelsInTeam: {},
                currentChannelId: '',
            },
            teams: {
                currentTeamId: 'team1',
                teams: {
                    team1: {
                        id: 'team1',
                        name: 'team1',
                    },
                },
            },
            groups: {
                groups: {},
                syncables: {},
                myGroups: [],
                stats: {},
            },
            emojis: {
                customEmoji: {},
                nonExistentEmoji: new Set(),
            },
        },
    };
    const baseProps = {
        icon: 'https://example.com/icon.png',
        link: 'https://example.com/result',
        title: 'Test Result',
        subtitle: 'Test Subtitle',
        description: 'Test Description',
        createAt: 1234567890,
        source: 'test_source',
    };

    const renderComponent = (props = {}, storeData = {}) => {
        const store = mockStore({
            ...defaultStore,
            ...storeData,
        } as any);

        return render(
            <Provider store={store}>
                <IntlProvider locale='en'>
                    <OmniSearchResultItem
                        {...baseProps}
                        {...props}
                    />
                </IntlProvider>
            </Provider>,
        );
    };

    test('renders all components correctly', () => {
        renderComponent();

        // Check main elements are present
        expect(screen.getByText('Test Result')).toBeInTheDocument();
        expect(screen.getByText('Test Subtitle')).toBeInTheDocument();
        expect(screen.getByText('Test Description')).toBeInTheDocument();
        expect(screen.getByText('test_source')).toBeInTheDocument();

        // Check icon
        const icon = screen.getByRole('img');
        expect(icon).toHaveAttribute('src', 'https://example.com/icon.png');

        // Check link
        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('href', 'https://example.com/result');
    });

    test('renders without subtitle', () => {
        renderComponent({subtitle: ''});

        expect(screen.queryByText('Test Subtitle')).not.toBeInTheDocument();
        expect(screen.getByText('Test Result')).toBeInTheDocument();
        expect(screen.getByText('Test Description')).toBeInTheDocument();
    });

    test('renders timestamp correctly', () => {
        renderComponent();

        // Note: The actual timestamp display will depend on the user's locale and timezone
        // We're just checking if the Timestamp component is rendered
        expect(screen.getByTestId('timestamp')).toBeInTheDocument();
    });

    test('renders markdown in description', () => {
        renderComponent({
            description: '**Bold** and *italic* text',
        });

        const boldText = screen.getByText('Bold');
        expect(boldText).toHaveStyle('font-weight: bold');

        const italicText = screen.getByText('italic');
        expect(italicText).toHaveStyle('font-style: italic');
    });

    test('handles external link attributes', () => {
        renderComponent();

        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('rel', 'noreferrer');
        expect(link).toHaveAttribute('target', '_blank');
    });
});
