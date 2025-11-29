// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, waitFor} from 'tests/vitest_react_testing_utils';

import DataRetentionSettings from './data_retention_settings';

describe('components/admin_console/data_retention_settings/data_retention_settings', () => {
    const baseProps = {
        config: {
            DataRetentionSettings: {
                EnableMessageDeletion: true,
                EnableFileDeletion: true,
                MessageRetentionDays: 100,
                MessageRetentionHours: 2400,
                FileRetentionDays: 100,
                FileRetentionHours: 2400,
                DeletionJobStartTime: '00:15',
            },
        },
        customPolicies: {},
        customPoliciesCount: 0,
        globalMessageRetentionHours: '2400',
        globalFileRetentionHours: '2400',
        actions: {
            getDataRetentionCustomPolicies: vi.fn().mockResolvedValue([]),
            createJob: vi.fn(),
            getJobsByType: vi.fn().mockResolvedValue([]),
            deleteDataRetentionCustomPolicy: vi.fn(),
            patchConfig: vi.fn(),
        },
    };

    test('should match snapshot with no custom policies', async () => {
        const {container} = renderWithContext(
            <DataRetentionSettings
                {...baseProps}
            />,
        );
        await waitFor(() => {
            expect(baseProps.actions.getDataRetentionCustomPolicies).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with custom policy', async () => {
        const props = {
            ...baseProps,
            customPolicies: {
                1234567: {
                    id: '1234567',
                    display_name: 'Custom policy 1',
                    post_duration: 60,
                    team_count: 1,
                    channel_count: 2,
                },
            },
            customPoliciesCount: 1,
        };
        const {container} = renderWithContext(
            <DataRetentionSettings
                {...props}
            />,
        );
        await waitFor(() => {
            expect(baseProps.actions.getDataRetentionCustomPolicies).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with custom policy keep forever', async () => {
        const props = {
            ...baseProps,
            customPolicies: {
                1234567: {
                    id: '1234567',
                    display_name: 'Custom policy 1',
                    post_duration: -1,
                    team_count: 1,
                    channel_count: 2,
                },
            },
            customPoliciesCount: 1,
        };
        const {container} = renderWithContext(
            <DataRetentionSettings
                {...props}
            />,
        );
        await waitFor(() => {
            expect(baseProps.actions.getDataRetentionCustomPolicies).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with Global Policies disabled', async () => {
        const props = {
            ...baseProps,
            config: {
                ...baseProps.config,
                DataRetentionSettings: {
                    ...baseProps.config.DataRetentionSettings,
                    EnableMessageDeletion: false,
                    EnableFileDeletion: false,
                },
            },
        };
        const {container} = renderWithContext(
            <DataRetentionSettings
                {...props}
            />,
        );
        await waitFor(() => {
            expect(baseProps.actions.getDataRetentionCustomPolicies).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });
});
