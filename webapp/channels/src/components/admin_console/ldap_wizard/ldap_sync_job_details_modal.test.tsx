// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, screen} from '@testing-library/react';
import React from 'react';

import type {Group} from '@mattermost/types/groups';
import type {Job} from '@mattermost/types/jobs';
import type {UserProfile} from '@mattermost/types/users';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import LdapSyncJobDetailsModal from './ldap_sync_job_details_modal';

// Avoid network: the modal prefetches the affected users/groups on mount.
jest.mock('mattermost-redux/actions/users', () => ({
    ...jest.requireActual('mattermost-redux/actions/users'),
    getMissingProfilesByIds: jest.fn(() => ({type: 'MOCK_GET_MISSING_PROFILES'})),
}));
jest.mock('mattermost-redux/actions/groups', () => ({
    ...jest.requireActual('mattermost-redux/actions/groups'),
    getGroup: jest.fn(() => ({type: 'MOCK_GET_GROUP'})),
}));

describe('components/admin_console/ldap_wizard/LdapSyncJobDetailsModal', () => {
    const baseJob: Job = {
        id: 'job1',
        type: 'ldap_sync',
        priority: 0,
        create_at: 1000,
        start_at: 1000,
        last_activity_at: 2000,
        status: 'warning',
        progress: 100,
        data: {},
    };

    // makeWarnings mirrors the server SyncWarning schema: {type, user_id, group_id, reason}.
    const makeWarnings = (count: number) => {
        return JSON.stringify(Array.from({length: count}, (_, i) => {
            const isGroup = i % 2 !== 0;
            return {
                type: isGroup ? 'group_member_add' : 'user_update',
                user_id: `user${i}`,
                ...(isGroup ? {group_id: `group${i}`} : {}),
                reason: `reason ${i}`,
            };
        }));
    };

    const profilesState = (count: number) => {
        const profiles: Record<string, UserProfile> = {};
        for (let i = 0; i < count; i++) {
            profiles[`user${i}`] = TestHelper.getUserMock({id: `user${i}`, username: `username${i}`});
        }
        return {entities: {users: {profiles}}};
    };

    test('renders empty state when there are no warnings', () => {
        renderWithContext(
            <LdapSyncJobDetailsModal
                job={baseJob}
                onExited={jest.fn()}
            />,
        );

        expect(screen.getByText('No warnings were recorded for this sync job.')).toBeInTheDocument();
    });

    test('renders per-category summary and warning rows', () => {
        const job: Job = {...baseJob, data: {warning_count: '4', warnings: makeWarnings(4)}};

        renderWithContext(
            <LdapSyncJobDetailsModal
                job={job}
                onExited={jest.fn()}
            />,
            profilesState(4),
        );

        // Summary title shows the total count.
        expect(screen.getByText('4 warnings')).toBeInTheDocument();

        // Per-category labels are shown (in the summary and in the rows).
        expect(screen.getAllByText('User update').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Group member add').length).toBeGreaterThan(0);

        // The affected user is rendered via the profile popover trigger as @username.
        expect(screen.getByText('@username0')).toBeInTheDocument();
        expect(screen.getByText('reason 0')).toBeInTheDocument();
    });

    test('renders the affected group as a popover trigger, falling back to the id', () => {
        const job: Job = {...baseJob, data: {warning_count: '4', warnings: makeWarnings(4)}};

        const state = {
            entities: {
                ...profilesState(4).entities,
                groups: {
                    groups: {
                        group1: {id: 'group1', name: 'engineering', display_name: 'Engineering'} as unknown as Group,
                    },
                },
            },
        };

        renderWithContext(
            <LdapSyncJobDetailsModal
                job={job}
                onExited={jest.fn()}
            />,
            state,
        );

        // group1 is in the store -> popover trigger shows its @name.
        expect(screen.getByText('@engineering')).toBeInTheDocument();

        // group3 is not loaded -> falls back to the raw id.
        expect(screen.getByText('@group3')).toBeInTheDocument();
    });

    test('renders no subject for warnings without a user or group', () => {
        const job: Job = {
            ...baseJob,
            data: {
                warning_count: '1',
                warnings: JSON.stringify([
                    {type: 'group_membership_sync', reason: 'Failed to create default memberships'},
                ]),
            },
        };

        renderWithContext(
            <LdapSyncJobDetailsModal
                job={job}
                onExited={jest.fn()}
            />,
        );

        expect(screen.getByText('Failed to create default memberships')).toBeInTheDocument();
        expect(screen.queryByText(/^@/)).not.toBeInTheDocument();
    });

    test('shows capped note when the stored warnings are fewer than the total count', () => {
        const job: Job = {...baseJob, data: {warning_count: '750', warnings: makeWarnings(500)}};

        renderWithContext(
            <LdapSyncJobDetailsModal
                job={job}
                onExited={jest.fn()}
            />,
        );

        expect(screen.getByText('Showing first 500 of 750 warnings. Download the support packet for the full log.')).toBeInTheDocument();
    });

    test('filters warnings by username search term', () => {
        const job: Job = {...baseJob, data: {warning_count: '4', warnings: makeWarnings(4)}};

        renderWithContext(
            <LdapSyncJobDetailsModal
                job={job}
                onExited={jest.fn()}
            />,
            profilesState(4),
        );

        fireEvent.change(screen.getByPlaceholderText('Search by username, group, type, or reason'), {target: {value: 'username2'}});

        expect(screen.getByText('@username2')).toBeInTheDocument();
        expect(screen.queryByText('@username0')).not.toBeInTheDocument();
    });

    test('does not crash on malformed warnings JSON', () => {
        const job: Job = {...baseJob, data: {warning_count: '1', warnings: '{not valid json'}};

        renderWithContext(
            <LdapSyncJobDetailsModal
                job={job}
                onExited={jest.fn()}
            />,
        );

        expect(screen.getByText('No warnings were recorded for this sync job.')).toBeInTheDocument();
    });
});
