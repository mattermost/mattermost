// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

import {GroupProfileAndSettings} from './group_profile_and_settings';

describe('components/admin_console/group_settings/group_details/GroupProfileAndSettings', () => {
    test('should match snapshot, with toggle off', () => {
        const {container} = renderWithContext(
            <GroupProfileAndSettings
                displayname='GroupProfileAndSettings'
                mentionname='GroupProfileAndSettings'
                allowReference={false}
                onChange={vi.fn()}
                onToggle={vi.fn()}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with toggle on', () => {
        const {container} = renderWithContext(
            <GroupProfileAndSettings
                displayname='GroupProfileAndSettings'
                mentionname='GroupProfileAndSettings'
                allowReference={true}
                onChange={vi.fn()}
                onToggle={vi.fn()}
            />,
        );
        expect(container).toMatchSnapshot();
    });
});
