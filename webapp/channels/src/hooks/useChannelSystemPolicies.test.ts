// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as ReactRedux from 'react-redux';

import {renderHookWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import {useChannelSystemPolicies} from './useChannelSystemPolicies';

describe('hooks/useChannelSystemPolicies', () => {
    const mockParentPolicy1 = {
        id: 'parent-policy-1',
        name: 'Security Clearance Policy',
        type: 'parent',
        active: true,
        created_at: 1234567890,
        revision: 1,
        version: 'v0.1',
        imports: [],
        rules: [
            {
                actions: ['*'],
                expression: 'user.clearance == "Confidential"',
            },
        ],
    };

    const mockParentPolicy2 = {
        id: 'parent-policy-2',
        name: 'Location Access Policy',
        type: 'parent',
        active: true,
        created_at: 1234567890,
        revision: 1,
        version: 'v0.1',
        imports: [],
        rules: [
            {
                actions: ['*'],
                expression: 'user.location == "US"',
            },
        ],
    };

    const mockChannelPolicyWithImports = {
        id: 'channel-policy-1',
        name: 'Channel Policy',
        type: 'channel',
        active: true,
        created_at: 1234567890,
        revision: 1,
        version: 'v0.1',
        imports: ['parent-policy-1', 'parent-policy-2'],
        rules: [],
    };

    const mockChannelPolicyParentType = {
        id: 'channel-policy-2',
        name: 'Direct Parent Policy',
        type: 'parent',
        active: true,
        created_at: 1234567890,
        revision: 1,
        version: 'v0.1',
        imports: [],
        rules: [
            {
                actions: ['*'],
                expression: 'user.department == "Engineering"',
            },
        ],
    };

    const mockChannelWithoutPolicyEnforcement = TestHelper.getChannelMock({
        id: 'channel-1',
        name: 'test-channel',
        display_name: 'Test Channel',
        policy_enforced: false,
    });

    const mockChannelWithPolicyEnforcement = TestHelper.getChannelMock({
        id: 'channel-2',
        name: 'secure-channel',
        display_name: 'Secure Channel',
        policy_enforced: true,
    });

    const dispatchMock = jest.fn();

    beforeAll(() => {
        jest.spyOn(ReactRedux, 'useDispatch').mockImplementation(() => dispatchMock);
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    beforeEach(() => {
        dispatchMock.mockClear();
    });

    test('should return empty state when channel is null', () => {
        const {result} = renderHookWithContext(() => useChannelSystemPolicies(null));

        expect(result.current.loading).toBe(false);
        expect(result.current.policies).toEqual([]);
        expect(result.current.error).toBe(null);
        expect(dispatchMock).not.toHaveBeenCalled();
    });

    test('should return empty state when channel has no policy enforcement', () => {
        const {result} = renderHookWithContext(() => useChannelSystemPolicies(mockChannelWithoutPolicyEnforcement));

        expect(result.current.loading).toBe(false);
        expect(result.current.policies).toEqual([]);
        expect(result.current.error).toBe(null);
        expect(dispatchMock).not.toHaveBeenCalled();
    });

    test('should handle channel policy not found', async () => {
        dispatchMock.mockResolvedValue({
            error: {message: 'Policy not found'},
        });

        const {result, waitForNextUpdate} = renderHookWithContext(() => useChannelSystemPolicies(mockChannelWithPolicyEnforcement));

        expect(result.current.loading).toBe(true);

        await waitForNextUpdate();

        expect(result.current.loading).toBe(false);
        expect(result.current.policies).toEqual([]);
        expect(result.current.error).toBe(null);
        expect(dispatchMock).toHaveBeenCalledTimes(1);
    });

    test('should fetch and return parent policies from channel policy imports', async () => {
        dispatchMock.
            mockResolvedValueOnce({
                data: mockChannelPolicyWithImports,
            }).
            mockResolvedValueOnce({
                data: mockParentPolicy1,
            }).
            mockResolvedValueOnce({
                data: mockParentPolicy2,
            });

        const {result, waitForNextUpdate} = renderHookWithContext(() => useChannelSystemPolicies(mockChannelWithPolicyEnforcement));

        expect(result.current.loading).toBe(true);

        await waitForNextUpdate();

        expect(result.current.loading).toBe(false);
        expect(result.current.policies).toEqual([mockParentPolicy1, mockParentPolicy2]);
        expect(result.current.error).toBe(null);
        expect(dispatchMock).toHaveBeenCalledTimes(3);
    });

    test('should return direct parent policy when channel policy type is parent', async () => {
        dispatchMock.mockResolvedValue({
            data: mockChannelPolicyParentType,
        });

        const {result, waitForNextUpdate} = renderHookWithContext(() => useChannelSystemPolicies(mockChannelWithPolicyEnforcement));

        expect(result.current.loading).toBe(true);

        await waitForNextUpdate();

        expect(result.current.loading).toBe(false);
        expect(result.current.policies).toEqual([mockChannelPolicyParentType]);
        expect(result.current.error).toBe(null);
        expect(dispatchMock).toHaveBeenCalledTimes(1);
    });

    test('should handle network/API errors', async () => {
        dispatchMock.mockRejectedValue(new Error('Network error'));

        const {result, waitForNextUpdate} = renderHookWithContext(() => useChannelSystemPolicies(mockChannelWithPolicyEnforcement));

        expect(result.current.loading).toBe(true);

        await waitForNextUpdate();

        expect(result.current.loading).toBe(false);
        expect(result.current.policies).toEqual([]);
        expect(result.current.error).toBe('Failed to fetch policies');
    });

    test('should handle partial parent policy fetch failures', async () => {
        dispatchMock.
            mockResolvedValueOnce({
                data: mockChannelPolicyWithImports,
            }).
            mockResolvedValueOnce({
                data: mockParentPolicy1,
            }).
            mockResolvedValueOnce({
                error: {message: 'Parent policy not found'},
            });

        const {result, waitForNextUpdate} = renderHookWithContext(() => useChannelSystemPolicies(mockChannelWithPolicyEnforcement));

        await waitForNextUpdate();

        expect(result.current.loading).toBe(false);
        expect(result.current.policies).toEqual([mockParentPolicy1]);
        expect(result.current.error).toBe(null);
    });
});
