// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {describe, test, expect} from 'vitest';

import GroupProfile from 'components/admin_console/group_settings/group_details/group_profile';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

describe('components/admin_console/group_settings/group_details/GroupProfile', () => {
    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <GroupProfile
                customID='test'
                isDisabled={false}
                name='Test'
                showAtMention={true}
                title={{id: 'admin.group_settings.group_details.group_profile.name', defaultMessage: 'Name:'}}
            />,
        );
        expect(container).toMatchSnapshot();
    });
});
