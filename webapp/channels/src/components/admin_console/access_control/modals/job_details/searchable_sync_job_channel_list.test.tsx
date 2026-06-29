// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

jest.mock('components/channel_type_icon/compass_icon_resolver', () => ({
    compassIconForName: jest.fn(),
}));

import type {Channel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';

import {compassIconForName} from 'components/channel_type_icon';

import {renderWithContext, screen} from 'tests/react_testing_utils';

jest.mock('@mattermost/compass-icons/components', () => ({
    ...jest.requireActual('@mattermost/compass-icons/components'),
    GlobeIcon: () => <span data-testid='default-globe-icon'/>,
    LockOutlineIcon: () => <span data-testid='default-lock-icon'/>,
}));

import SearchableSyncJobChannelList from './searchable_sync_job_channel_list';

describe('SearchableSyncJobChannelList', () => {
    const team: Team = {
        id: 'team1',
        display_name: 'Team One',
    } as Team;

    const openChannel: Channel = {
        id: 'channel1',
        name: 'open-channel',
        display_name: 'Open Channel',
        type: 'O',
        delete_at: 0,
        team_id: 'team1',
        purpose: '',
    } as Channel;

    const baseProps = {
        channels: [openChannel],
        teams: {team1: team},
        channelsPerPage: 10,
        nextPage: jest.fn(),
        isSearch: false,
        search: jest.fn(),
        noResultsText: <>{'No results'}</>,
        loading: false,
        syncResults: {},
    };

    const baseState = {
        entities: {
            users: {currentUserId: 'user1'},
            general: {config: {}},
        },
    };

    describe('plugin channel icon override', () => {
        const mockedCompassIconForName = jest.mocked(compassIconForName);

        afterEach(() => {
            mockedCompassIconForName.mockReset();
        });

        it('renders override SVG icon when plugin matcher matches', () => {
            const StubIcon = ({size}: {size?: number}) => (
                <span
                    data-testid='stub-override-icon'
                    data-size={size}
                />
            );
            mockedCompassIconForName.mockReturnValue(StubIcon as any);

            const stateWithOverride = {
                ...baseState,
                plugins: {
                    components: {
                        ChannelIconOverride: [{
                            id: '1',
                            pluginId: 'test-plugin',
                            matcher: () => true,
                            iconName: 'shield-outline',
                        }],
                    },
                },
            } as any;

            renderWithContext(
                <SearchableSyncJobChannelList {...baseProps}/>,
                stateWithOverride,
            );

            const icon = screen.getByTestId('stub-override-icon');
            expect(icon).toBeInTheDocument();
            expect(icon).toHaveAttribute('data-size', '18');

            expect(screen.queryByTestId('default-globe-icon')).not.toBeInTheDocument();
        });

        it('renders default SVG icon when no plugin matcher matches', () => {
            mockedCompassIconForName.mockReturnValue(null);

            const stateWithNoMatch = {
                ...baseState,
                plugins: {
                    components: {
                        ChannelIconOverride: [{
                            id: '1',
                            pluginId: 'test-plugin',
                            matcher: () => false,
                            iconName: 'shield-outline',
                        }],
                    },
                },
            } as any;

            renderWithContext(
                <SearchableSyncJobChannelList {...baseProps}/>,
                stateWithNoMatch,
            );

            expect(screen.queryByTestId('stub-override-icon')).not.toBeInTheDocument();
            expect(screen.getByTestId('default-globe-icon')).toBeInTheDocument();
        });
    });
});
