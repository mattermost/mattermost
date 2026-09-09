// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import AccessControlSyncJobTable from './access_control_sync_job_table';

describe('components/admin_console/access_control/jobs/AccessControlSyncJobTable', () => {
    const baseProps = {
        actions: {
            createJob: jest.fn().mockResolvedValue({data: {}}),
            getJobsByType: jest.fn(),
        },
    };

    const stateWith = (teamAbac: boolean) => ({
        entities: {
            general: {
                config: {
                    EnableAttributeBasedAccessControl: 'true',
                    FeatureFlagTeamMembershipAccessControl: teamAbac ? 'true' : 'false',
                },
            },
            users: {
                currentUserId: 'user_id',
                profiles: {user_id: {id: 'user_id', roles: 'system_admin'}},
            },
            jobs: {jobs: {}, jobsByTypeList: {}},
        },
    });

    test('names the channel scope and shows the team-sync note when team ABAC is enabled', () => {
        renderWithContext(<AccessControlSyncJobTable {...baseProps}/>, stateWith(true));

        expect(screen.getByText('Run Channel Sync')).toBeInTheDocument();
        expect(screen.getByText(/Re-sync channel membership/)).toBeInTheDocument();
        expect(screen.getByText('This syncs channel membership only')).toBeInTheDocument();
        expect(screen.getByText(/To re-sync team membership/)).toBeInTheDocument();
    });

    test('keeps the generic copy and hides the team-sync note when team ABAC is disabled', () => {
        renderWithContext(<AccessControlSyncJobTable {...baseProps}/>, stateWith(false));

        expect(screen.getByText('Run Sync Job')).toBeInTheDocument();
        expect(screen.getByText('Apply membership policies to their assigned resources.')).toBeInTheDocument();
        expect(screen.queryByText(/To re-sync team membership/)).not.toBeInTheDocument();
    });
});
