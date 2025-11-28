// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {describe, test, expect} from 'vitest';

import GroupSettings from 'components/admin_console/group_settings/group_settings';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

describe('components/admin_console/group_settings/GroupSettings', () => {
    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <GroupSettings/>,
        );
        expect(container).toMatchSnapshot();
    });
});
