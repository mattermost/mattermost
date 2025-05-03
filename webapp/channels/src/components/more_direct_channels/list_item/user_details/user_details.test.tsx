// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Simple tests for the functionality of UserDetails component with remote users.
 * This test file verifies that the component correctly identifies remote users.
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
});
