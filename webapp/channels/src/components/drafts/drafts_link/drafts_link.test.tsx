// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {MemoryRouter, Route} from 'react-router-dom';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen, waitFor} from 'tests/react_testing_utils';
import {SCHEDULED_POST_URL_SUFFIX} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import DraftsLink from './drafts_link';

// Mock the actions that are dispatched
jest.mock('actions/views/drafts', () => ({
    getDrafts: jest.fn(() => ({type: 'MOCK_GET_DRAFTS'})),
}));

jest.mock('mattermost-redux/actions/scheduled_posts', () => ({
    fetchTeamScheduledPosts: jest.fn(() => ({type: 'MOCK_FETCH_SCHEDULED_POSTS'})),
}));

// Base state with all required properties
const baseState: DeepPartial<GlobalState> = {
    entities: {
        general: {
            config: {
                ScheduledPosts: 'true',
            },
            license: {
                IsLicensed: 'true',
            },
        },
        preferences: {
            myPreferences: {},
        },
        teams: {
            currentTeamId: 'team1',
            teams: {
                team1: TestHelper.getTeamMock({id: 'team1'}),
            },
        },
        users: {
            currentUserId: 'user1',
            profiles: {
                user1: TestHelper.getUserMock({id: 'user1'}),
            },
        },
        scheduledPosts: {},
        channels: {
            channels: {
                channel_id_1: TestHelper.getChannelMock({id: 'channel_id_1', type: 'O'}),
            },
            channelsInTeam: {
                team1: new Set(['channel_id_1']),
            },
            myMembers: {
                channel_id_1: {channel_id: 'channel_id_1', user_id: 'user1'},
            },
        },
    },
    views: {
        drafts: {
            remotes: {},
        },
    },
};

// Helper function to render the component with router
const renderWithRouter = (state: any, initialEntries = ['/team1/channels/town-square']) => {
    return renderWithContext(
        <MemoryRouter initialEntries={initialEntries}>
            <Route path='/:team'>
                <DraftsLink/>
            </Route>
        </MemoryRouter>,
        state,
    );
};

describe('components/drafts/drafts_link', () => {
    it('should not render when no drafts or scheduled posts exist', () => {
        renderWithRouter(baseState);

        expect(screen.queryByText('Drafts')).not.toBeInTheDocument();
    });

    it('should render when drafts exist', () => {
        const state: DeepPartial<GlobalState> = {
            ...baseState,
            storage: {
                storage: {
                    draft_draft1: {timestamp: new Date(), value: {message: 'Draft message', show: true, channelId: 'channel_id_1'}},
                },
            },
        };

        renderWithRouter(state);

        expect(screen.getByText('Drafts')).toBeInTheDocument();
        expect(screen.getByTestId('draftIcon')).toBeInTheDocument();
    });

    it('should render when scheduled posts exist', () => {
        const state: DeepPartial<GlobalState> = {
            ...baseState,
            entities: {
                ...baseState.entities,
                scheduledPosts: {
                    byTeamId: {
                        team1: ['scheduled_post1', 'scheduled_post2'],
                    },
                },
            },
        };

        renderWithRouter(state);

        expect(screen.getByText('Drafts')).toBeInTheDocument();
        expect(screen.getByTestId('scheduledPostIcon')).toBeInTheDocument();
    });

    it('should not show scheduled posts badge when scheduled posts are disabled', () => {
        const state = {
            ...baseState,
            entities: {
                ...baseState.entities,
                scheduledPosts: {
                    byTeamId: {
                        team1: ['scheduled_post1', 'scheduled_post2'],
                    },
                },
                general: {
                    config: {
                        ScheduledPosts: 'false',
                    },
                },
            },
        };

        renderWithRouter(state);

        expect(screen.queryByTestId('scheduledPostIcon')).not.toBeInTheDocument();
    });

    it('should not show scheduled posts badge when not licensed', () => {
        const state = {
            ...baseState,
            entities: {
                ...baseState.entities,
                scheduledPosts: {
                    byTeamId: {
                        team1: ['scheduled_post1', 'scheduled_post2'],
                    },
                },
                general: {
                    license: {
                        IsLicensed: 'false',
                    },
                },
            },
        };

        renderWithRouter(state);

        expect(screen.queryByTestId('scheduledPostIcon')).not.toBeInTheDocument();
    });

    it('should show error indicator when scheduled posts have errors', () => {
        const state: DeepPartial<GlobalState> = {
            ...baseState,
            entities: {
                ...baseState.entities,
                scheduledPosts: {
                    byTeamId: {
                        team1: ['scheduled_post1', 'scheduled_post2'],
                    },
                    errorsByTeamId: {
                        team1: ['scheduled_post1'],
                    },
                },
            },
        };

        renderWithRouter(state);

        const badge = screen.getByTestId('scheduledPostIcon').closest('.scheduledPostBadge');
        expect(badge).toHaveClass('persistent');
    });

    it('should fetch scheduled posts when component mounts', async () => {
        const fetchTeamScheduledPosts = require('mattermost-redux/actions/scheduled_posts').fetchTeamScheduledPosts;

        renderWithRouter(baseState);

        await waitFor(() => {
            expect(fetchTeamScheduledPosts).toHaveBeenCalledWith('team1', true);
        });
    });

    it('should be active when on drafts route', () => {
        const state: DeepPartial<GlobalState> = {
            ...baseState,
            storage: {
                storage: {
                    draft_draft1: {timestamp: new Date(), value: {message: 'Draft message', show: true, channelId: 'channel_id_1'}},
                },
            },
        };

        renderWithRouter(
            state,
            ['/team1/drafts'],
        );

        const navLink = screen.getByText('Drafts').closest('a');
        expect(navLink).toHaveClass('active');
    });

    it('should be active when on scheduled posts route', () => {
        const state: DeepPartial<GlobalState> = {
            ...baseState,
            storage: {
                storage: {
                    draft_draft1: {timestamp: new Date(), value: {message: 'Draft message', show: true, channelId: 'channel_id_1'}},
                },
            },
        };

        renderWithRouter(
            state,
            [`/team1/${SCHEDULED_POST_URL_SUFFIX}`],
        );

        const navLink = screen.getByText('Drafts').closest('a');
        expect(navLink).toHaveClass('active');
    });
});
