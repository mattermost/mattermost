// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import CustomPolicyForm from 'components/admin_console/data_retention_settings/custom_policy_form/custom_policy_form';

import {renderWithContext, cleanup, waitFor} from 'tests/vitest_react_testing_utils';

// Mock admin actions to prevent Redux dispatches that cause unhandled rejections
vi.mock('mattermost-redux/actions/admin', async (importOriginal) => {
    const actual = await importOriginal<typeof import('mattermost-redux/actions/admin')>();
    return {
        ...actual,
        getDataRetentionCustomPolicyTeams: vi.fn(() => () => Promise.resolve({data: {teams: []}})),
        getDataRetentionCustomPolicyChannels: vi.fn(() => () => Promise.resolve({data: {channels: []}})),
    };
});

describe('components/admin_console/data_retention_settings/custom_policy_form', () => {
    afterEach(() => {
        cleanup();
    });

    const defaultProps = {
        actions: {
            setNavigationBlocked: vi.fn(),
            fetchPolicy: vi.fn().mockResolvedValue({data: {teams: [], channels: []}}),
            fetchPolicyTeams: vi.fn().mockResolvedValue({data: {teams: []}}),
            createDataRetentionCustomPolicy: vi.fn(),
            updateDataRetentionCustomPolicy: vi.fn(),
            addDataRetentionCustomPolicyTeams: vi.fn(),
            removeDataRetentionCustomPolicyTeams: vi.fn(),
            addDataRetentionCustomPolicyChannels: vi.fn(),
            removeDataRetentionCustomPolicyChannels: vi.fn(),
        },
    };

    test('should match snapshot with creating new policy', async () => {
        const props = {...defaultProps};
        const {container} = renderWithContext(<CustomPolicyForm {...props}/>);
        await waitFor(() => {
            expect(container.querySelector('.CustomPolicy__fields')).toBeInTheDocument();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with editing existing policy', async () => {
        const props = {...defaultProps};

        const {container} = renderWithContext(
            <CustomPolicyForm
                {...props}
                policyId='fsdgdsgdsgh'
                policy={{
                    id: 'fsdgdsgdsgh',
                    display_name: 'Test Policy',
                    post_duration: 22,
                    team_count: 1,
                    channel_count: 2,
                }}
            />,
        );
        await waitFor(() => {
            expect(props.actions.fetchPolicy).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });
});
