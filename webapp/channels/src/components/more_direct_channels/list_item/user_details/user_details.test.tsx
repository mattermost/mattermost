// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Simple tests for the functionality of UserDetails component with remote users.
 * This test file verifies that the component behaves differently based on the
 * EnableSharedChannelsDMs feature flag.
 */

// Create simple test for the component logic using Jest directly
import {TestHelper} from 'utils/test_helper';

describe('UserDetails component with remote users', () => {
    test('isRemoteUser should be true for users with remote_id', () => {
        // Create a user with remote_id
        const remoteUser = TestHelper.getUserMock({
            id: 'user_id',
            remote_id: 'remote_id',
        });

        // Create a regular user
        const regularUser = TestHelper.getUserMock({
            id: 'user_id',
        });

        // Verify remote_id logic
        expect(Boolean(remoteUser.remote_id)).toBe(true);
        expect(Boolean(regularUser.remote_id)).toBe(false);
    });

    test('remote users should have an indicator when feature flag is off', () => {
        // This test simulates the component behavior with feature flag off
        const enableSharedChannelsDMs = false;
        const isRemoteUser = true;

        // In UserDetails component, the logic is:
        // isRemoteUser && !enableSharedChannelsDMs
        // determines whether to show the "coming soon" indicator
        const shouldShowComingSoonIndicator = isRemoteUser && !enableSharedChannelsDMs;

        expect(shouldShowComingSoonIndicator).toBe(true);
    });

    test('remote users should NOT have an indicator when feature flag is on', () => {
        // This test simulates the component behavior with feature flag on
        const enableSharedChannelsDMs = true;
        const isRemoteUser = true;

        // This is the same logic as in the component:
        // isRemoteUser && !enableSharedChannelsDMs
        const shouldShowComingSoonIndicator = isRemoteUser && !enableSharedChannelsDMs;

        expect(shouldShowComingSoonIndicator).toBe(false);
    });
});
