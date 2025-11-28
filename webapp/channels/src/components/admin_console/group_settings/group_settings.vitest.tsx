// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import GroupSettings from 'components/admin_console/group_settings/group_settings';

import {renderWithContext, waitFor, screen} from 'tests/vitest_react_testing_utils';

describe('components/admin_console/group_settings/GroupSettings', () => {
    test('should match snapshot', async () => {
        const {container} = renderWithContext(
            <GroupSettings/>,
        );

        // Wait for async state updates from GroupsList componentDidMount
        await waitFor(() => {
            expect(screen.getByText('AD/LDAP')).toBeInTheDocument();
        });

        expect(container).toMatchSnapshot();
    });
});
