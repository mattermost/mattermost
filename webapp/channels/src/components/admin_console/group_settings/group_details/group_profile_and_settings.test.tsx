// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import {GroupProfileAndSettings} from './group_profile_and_settings';

describe('components/admin_console/group_settings/group_details/GroupProfileAndSettings', () => {
    test('should match snapshot, with toggle off', () => {
        const {container} = renderWithContext(
            <GroupProfileAndSettings
                displayname='GroupProfileAndSettings'
                mentionname='GroupProfileAndSettings'
                allowReference={false}
                onChange={jest.fn()}
                onToggle={jest.fn()}
            />,
        );

        expect(container).toMatchSnapshot();
        expect(screen.getByText('Enable Group Mentions')).toBeInTheDocument();

        // Group Mention field should not be visible when toggle is off
        expect(screen.queryByText('Group Mention:')).not.toBeInTheDocument();
    });

    test('should match snapshot, with toggle on', () => {
        const {container} = renderWithContext(
            <GroupProfileAndSettings
                displayname='GroupProfileAndSettings'
                mentionname='GroupProfileAndSettings'
                allowReference={true}
                onChange={jest.fn()}
                onToggle={jest.fn()}
            />,
        );

        expect(container).toMatchSnapshot();

        // Group Mention field should be visible when toggle is on
        expect(screen.getByText('Group Mention:')).toBeInTheDocument();

        // Both inputs should be present (displayname and mentionname)
        const inputs = screen.getAllByDisplayValue('GroupProfileAndSettings');
        expect(inputs).toHaveLength(2);
    });
});
