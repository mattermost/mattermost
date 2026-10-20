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
        expect(screen.queryByLabelText('Group Mention')).not.toBeInTheDocument();
        expect(screen.getByLabelText('Name')).toHaveAttribute('readonly');
        expect(screen.getByLabelText('Name')).not.toBeDisabled();
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
        expect(screen.getByLabelText('Group Mention')).toBeInTheDocument();
        expect(screen.getByLabelText('Name')).toHaveAttribute('readonly');
        expect(screen.getByLabelText('Name')).not.toBeDisabled();

        // Mention stays editable when not permission-locked
        expect(screen.getByLabelText('Group Mention')).not.toBeDisabled();
        expect(screen.getByLabelText('Group Mention')).not.toHaveAttribute('readonly');

        // Both inputs should be present (displayname and mentionname)
        const inputs = screen.getAllByDisplayValue('GroupProfileAndSettings');
        expect(inputs).toHaveLength(2);
        expect(screen.getByLabelText('Name')).toHaveAttribute('id', 'groupDisplayNameInput');
        expect(screen.getByLabelText('Group Mention')).toHaveAttribute('id', 'groupMentionInput');
    });

    test('should disable Group Mention when readOnly (permission-locked)', () => {
        renderWithContext(
            <GroupProfileAndSettings
                displayname='GroupProfileAndSettings'
                mentionname='GroupProfileAndSettings'
                allowReference={true}
                onChange={jest.fn()}
                onToggle={jest.fn()}
                readOnly={true}
            />,
        );

        expect(screen.getByLabelText('Name')).toHaveAttribute('readonly');
        expect(screen.getByLabelText('Name')).not.toBeDisabled();
        expect(screen.getByLabelText('Group Mention')).toBeDisabled();
    });
});
