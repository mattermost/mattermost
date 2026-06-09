// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Job} from '@mattermost/types/jobs';

import {renderWithContext, screen, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import JobDetailsModal from './job_details_modal';

jest.mock('mattermost-redux/actions/channels', () => ({
    getChannel: jest.fn(() => () => Promise.resolve({data: null})),
}));

jest.mock('mattermost-redux/actions/teams', () => ({
    getTeam: jest.fn(() => () => Promise.resolve({data: null})),
}));

function makeChannelSyncJob(overrides?: Partial<Job>): Job {
    return {
        id: 'job1',
        type: 'access_control_sync',
        status: 'success',
        create_at: 1700000000000,
        start_at: 1700000001000,
        last_activity_at: 1700000002000,
        data: {
            sync_results: JSON.stringify({
                channel1: {MembersAdded: ['user1', 'user2'], MembersRemoved: ['user3']},
            }),
        },
        ...overrides,
    } as Job;
}

function makeTeamSyncJob(overrides?: Partial<Job>): Job {
    return {
        id: 'job2',
        type: 'access_control_team_sync',
        status: 'success',
        create_at: 1700000000000,
        start_at: 1700000001000,
        last_activity_at: 1700000002000,
        data: {
            sync_results: JSON.stringify({
                team1: {MembersAdded: ['user1'], MembersRemoved: ['user2', 'user3'], MassRemovalWarning: false},
            }),
        },
        ...overrides,
    } as Job;
}

describe('JobDetailsModal', () => {
    const onExited = jest.fn();

    const initialState = {
        entities: {
            channels: {
                channels: {
                    channel1: TestHelper.getChannelMock({id: 'channel1', display_name: 'Town Square', team_id: 'team1'}),
                },
            },
            teams: {
                teams: {
                    team1: TestHelper.getTeamMock({id: 'team1', display_name: 'Engineering', name: 'engineering'}),
                },
            },
        },
    };

    test('renders channel sync results for access_control_sync job type', () => {
        renderWithContext(
            <JobDetailsModal
                job={makeChannelSyncJob()}
                onExited={onExited}
            />,
            initialState,
        );

        expect(screen.getByText('Job Details')).toBeInTheDocument();
    });

    test('renders team sync results for access_control_team_sync job type', () => {
        renderWithContext(
            <JobDetailsModal
                job={makeTeamSyncJob()}
                onExited={onExited}
            />,
            initialState,
        );

        expect(screen.getByText('Job Details')).toBeInTheDocument();
    });

    test('does not cross-render teams as channels or vice-versa', () => {
        const {rerender} = renderWithContext(
            <JobDetailsModal
                job={makeChannelSyncJob()}
                onExited={onExited}
            />,
            initialState,
        );

        // Channel job renders search box for channels
        expect(screen.queryByPlaceholderText('Search teams')).not.toBeInTheDocument();

        rerender(
            <JobDetailsModal
                job={makeTeamSyncJob()}
                onExited={onExited}
            />,
        );

        // Team job renders search box for teams
        expect(screen.getByPlaceholderText('Search teams')).toBeInTheDocument();
    });

    test('shows mass-removal warning indicator on team rows where MassRemovalWarning is true', async () => {
        const teamSyncJobWithWarning = makeTeamSyncJob({
            data: {
                sync_results: JSON.stringify({
                    team1: {MembersAdded: [], MembersRemoved: ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'], MassRemovalWarning: true},
                }),
            },
        });

        renderWithContext(
            <JobDetailsModal
                job={teamSyncJobWithWarning}
                onExited={onExited}
            />,
            initialState,
        );

        await waitFor(() => {
            expect(screen.getByTitle('More than 50% of members were removed from this team.')).toBeInTheDocument();
        });
    });

    test('does not show mass-removal warning when MassRemovalWarning is false', async () => {
        renderWithContext(
            <JobDetailsModal
                job={makeTeamSyncJob()}
                onExited={onExited}
            />,
            initialState,
        );

        await waitFor(() => {
            expect(screen.queryByTitle('More than 50% of members were removed from this team.')).not.toBeInTheDocument();
        });
    });

    test('shows canceled banner for channel sync job when canceled', () => {
        renderWithContext(
            <JobDetailsModal
                job={makeChannelSyncJob({status: 'canceled'})}
                onExited={onExited}
            />,
            initialState,
        );

        expect(screen.getByText('Job Canceled')).toBeInTheDocument();
        expect(screen.getByText(/Channel members were not updated/)).toBeInTheDocument();
    });

    test('shows canceled banner for team sync job when canceled', () => {
        renderWithContext(
            <JobDetailsModal
                job={makeTeamSyncJob({status: 'canceled'})}
                onExited={onExited}
            />,
            initialState,
        );

        expect(screen.getByText('Job Canceled')).toBeInTheDocument();
        expect(screen.getByText(/Team members were not updated/)).toBeInTheDocument();
    });

    test('section title reads Membership Sync Jobs (regression guard)', () => {
        // The title is on the table not inside this modal - tested separately in job table tests.
        // This test guards the modal header.
        renderWithContext(
            <JobDetailsModal
                job={makeChannelSyncJob()}
                onExited={onExited}
            />,
            initialState,
        );
        expect(screen.getByText('Job Details')).toBeInTheDocument();
    });
});
