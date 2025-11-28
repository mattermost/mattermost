// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, cleanup, act} from 'tests/vitest_react_testing_utils';

import PolicyDetails from './policy_details';

vi.mock('utils/browser_history', () => ({
    getHistory: () => ({
        push: vi.fn(),
    }),
}));

// Mock the useChannelAccessControlActions hook
vi.mock('hooks/useChannelAccessControlActions', () => ({
    useChannelAccessControlActions: vi.fn().mockReturnValue({
        getAccessControlFields: vi.fn().mockResolvedValue({data: []}),
        getVisualAST: vi.fn().mockResolvedValue({data: null}),
        searchUsers: vi.fn().mockResolvedValue({data: []}),
        getChannelPolicy: vi.fn().mockResolvedValue({data: null}),
        saveChannelPolicy: vi.fn().mockResolvedValue({data: null}),
        deleteChannelPolicy: vi.fn().mockResolvedValue({data: null}),
        getChannelMembers: vi.fn().mockResolvedValue({data: []}),
        createJob: vi.fn().mockResolvedValue({data: null}),
        createAccessControlSyncJob: vi.fn().mockResolvedValue({data: null}),
        validateExpressionAgainstRequester: vi.fn().mockResolvedValue({data: null}),
        updateAccessControlPoliciesActive: vi.fn().mockResolvedValue({data: null}),
    }),
}));

describe('components/admin_console/access_control/policy_details/PolicyDetails', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(async () => {
        // Run all pending timers and microtasks
        await act(async () => {
            vi.runAllTimers();
            await Promise.resolve();
        });
        vi.useRealTimers();
        cleanup();
    });

    const defaultProps = {
        policyId: '',
        accessControlSettings: {
            EnableAttributeBasedAccessControl: true,
            EnableChannelScopeAccessControl: true,
            EnableUserManagedAttributes: false,
        },
        actions: {
            createPolicy: vi.fn().mockResolvedValue({data: null}),
            updatePolicy: vi.fn().mockResolvedValue({data: null}),
            deletePolicy: vi.fn().mockResolvedValue({data: null}),
            searchChannels: vi.fn().mockResolvedValue({data: {channels: [], total_count: 0}}),
            setChannelListSearch: vi.fn(),
            setChannelListFilters: vi.fn(),
            fetchPolicy: vi.fn().mockResolvedValue({data: null}),
            setNavigationBlocked: vi.fn(),
            assignChannelsToAccessControlPolicy: vi.fn().mockResolvedValue({data: null}),
            unassignChannelsFromAccessControlPolicy: vi.fn().mockResolvedValue({data: null}),
            createJob: vi.fn().mockResolvedValue({data: null}),
            updateAccessControlPoliciesActive: vi.fn().mockResolvedValue({data: null}),
        },
    };

    test('should match snapshot with new policy', async () => {
        const {container} = renderWithContext(<PolicyDetails {...defaultProps}/>);

        // Wait for async effects to complete
        await act(async () => {
            vi.advanceTimersByTime(100);
            await Promise.resolve();
        });

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with existing policy', async () => {
        const props = {
            ...defaultProps,
            policyId: 'policy1',
        };
        const {container} = renderWithContext(<PolicyDetails {...props}/>);

        // Wait for async effects to complete
        await act(async () => {
            vi.advanceTimersByTime(100);
            await Promise.resolve();
        });

        expect(container).toMatchSnapshot();
    });
});
