// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {describe, test, expect} from 'vitest';

import GroupUsersRow from 'components/admin_console/group_settings/group_details/group_users_row';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

describe('components/admin_console/group_settings/group_details/GroupUsersRow', () => {
    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <GroupUsersRow
                username='test'
                displayName='Test display name'
                email='test@test.com'
                userId='xxxxxxxxxxxxxxxxxxxxxxxxxx'
                lastPictureUpdate={0}
            />,
        );
        expect(container).toMatchSnapshot();
    });
});
