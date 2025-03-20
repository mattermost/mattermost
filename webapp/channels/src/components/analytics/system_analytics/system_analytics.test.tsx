// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent} from '@testing-library/react';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import SystemAnalytics from 'components/analytics/system_analytics';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import Constants from 'utils/constants';

const StatTypes = Constants.StatTypes;

global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
}));

describe('components/analytics/system_analytics/system_analytics.tsx', () => {
    const baseProps = {
        stats: null,
        license: {
            IsLicensed: 'true',
            Cloud: 'true',
        },
    };

    const initialState = {
        entities: {
            general: {
                license: {
                    IsLicensed: 'true',
                    Cloud: 'true',
                },
                config: {
                    TelemetryId: 'test123',
                },
            },
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    current_user_id: {roles: 'system_admin'},
                },
            },
            admin: {
                analytics: {},
            },
        },
        plugins: {
            siteStatsHandlers: {},
        },
    };

    test('no data', () => {
        renderWithContext(<SystemAnalytics {...baseProps}/>, initialState, {useMockedStore: true});

        expect(screen.getByTestId('totalPosts')).toHaveTextContent('Loading...');
        expect(screen.queryByTestId('totalPostsLineChart')).not.toBeInTheDocument();
    });

    test('system data', async () => {
        const state = {
            ...initialState,
            entities: {
                ...initialState.entities,
                admin: {
                    analytics: {
                        [StatTypes.TOTAL_POSTS]: 45,
                        [StatTypes.POST_PER_DAY]: [
                            {
                                name: '2024-05-20',
                                value: 45,
                            },
                            {
                                name: '2024-05-21',
                                value: 45,
                            },
                            {
                                name: '2024-05-22',
                                value: 45,
                            },
                        ],
                        [StatTypes.TOTAL_PUBLIC_CHANNELS]: 4545,
                        [StatTypes.TOTAL_PRIVATE_GROUPS]: 45,
                    },
                },
            },
        };

        renderWithContext(<SystemAnalytics {...baseProps}/>, state, {useMockedStore: true});

        const detailsElement = screen.getByText('Load Advanced Statistics');
        fireEvent.click(detailsElement);

        await screen.findByTestId('totalPostsLineChart');

        expect(screen.getByTestId('totalPosts')).toHaveTextContent('45');
        expect(screen.getByTestId('totalPostsLineChart')).toBeInTheDocument();
    });

    test('plugins data', async () => {
        const totalPlaybooksID = 'total_playbooks';
        const totalPlaybookRunsID = 'total_playbook_runs';
        const playbooksStats = {
            playbook_count: {
                id: 'total_playbooks',
                icon: 'fa-book',
                name:
    <FormattedMessage
        id={totalPlaybooksID}
        defaultMessage='Total Playbooks'
    />,
                value: 45,
            },
            playbook_run_count: {
                id: 'total_runs',
                icon: 'fa-list-alt',
                name:
    <FormattedMessage
        id={totalPlaybookRunsID}
        defaultMessage='Total Runs'
    />,
                value: 45,
            },
        };

        const callsStats = {
            calls_count: {
                visualizationType: 'count',
                name: 'Total Calls',
                id: 'total_calls',
                icon: 'fa-phone',
                value: 1000,
            },
            calls_sessions_count: {
                visualizationType: 'count',
                name: 'Total Calls Sessions',
                id: 'total_calls_sessions',
                icon: 'fa-phone',
                value: 10000,
            },
            calls_per_day: {
                visualizationType: 'line_chart',
                name: 'Calls per day',
                id: 'calls_per_day',
                value: {
                    labels: [
                        '2024-05-18',
                        '2024-05-19',
                        '2024-05-20',
                        '2024-05-21',
                        '2024-05-22',
                        '2024-05-23',
                        '2024-05-24',
                        '2024-05-26',
                        '2024-05-27',
                        '2024-05-28',
                    ],
                    datasets: [{
                        label: '',
                        fillColor: 'rgba(151,187,205,0.2)',
                        borderColor: 'rgba(151,187,205,1)',
                        pointBackgroundColor: 'rgba(151,187,205,1)',
                        pointBorderColor: '#fff',
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: 'rgba(151,187,205,1)',
                        data: [
                            10,
                            45,
                            60,
                            45,
                            25,
                            20,
                            40,
                            45,
                            100,
                            150,
                        ],
                    }],
                },
            },
            calls_per_channel: {
                visualizationType: 'doughnut_chart',
                name: 'Calls per channel',
                id: 'calls_per_channel',
                value: {
                    labels: [
                        'Public',
                        'Private',
                        'Direct',
                        'Group',
                    ],
                    datasets: [{
                        data: [100, 45, 45, 100],
                        backgroundColor: ['#46BFBD', '#FDB45C', '#3CB470', '#502D86'],
                        hoverBackgroundColor: ['#5AD3D1', '#FFC870', '#3CB470', '#502D86'],
                    }],
                },
            },
        };

        const state = {
            ...initialState,
            entities: {
                ...initialState.entities,
                admin: {
                    analytics: {
                        [StatTypes.TOTAL_POSTS]: 45,
                        [StatTypes.POST_PER_DAY]: [
                            {
                                name: '2024-05-20',
                                value: 45,
                            },
                            {
                                name: '2024-05-21',
                                value: 45,
                            },
                            {
                                name: '2024-05-22',
                                value: 45,
                            },
                        ],
                        [StatTypes.TOTAL_PUBLIC_CHANNELS]: 4545,
                        [StatTypes.TOTAL_PRIVATE_GROUPS]: 45,
                    },
                },
            },
            plugins: {
                siteStatsHandlers: {
                    'com.mattermost.calls': () => callsStats,
                    'com.mattermost.playbooks': () => playbooksStats,
                },
            },
        };

        renderWithContext(<SystemAnalytics {...baseProps}/>, state, {useMockedStore: true});

        await new Promise(process.nextTick);

        const detailsElement = screen.getByText('Load Advanced Statistics');
        fireEvent.click(detailsElement);

        await screen.findByTestId('totalPostsLineChart');

        expect(screen.getByTestId('totalPosts')).toHaveTextContent('45');
        expect(screen.getByTestId('totalPostsLineChart')).toBeInTheDocument();
        expect(screen.getByTestId('com.mattermost.playbooks.playbook_count')).toHaveTextContent('45');
        expect(screen.getByTestId('com.mattermost.playbooks.playbook_run_count')).toHaveTextContent('45');

        expect(screen.getByTestId('com.mattermost.calls.calls_count')).toHaveTextContent('1000');
        expect(screen.getByTestId('com.mattermost.calls.calls_sessions_count')).toHaveTextContent('10000');

        expect(screen.getByText('Calls per channel')).toBeInTheDocument();
        expect(screen.getByText('Calls per day')).toBeInTheDocument();
    });
});
