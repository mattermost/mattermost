// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import GroupProfile from 'components/admin_console/group_settings/group_details/group_profile';

import {renderWithContext, screen} from 'tests/react_testing_utils';

describe('components/admin_console/group_settings/group_details/GroupProfile', () => {
    test('should render Compass Input with floating label and mention leading icon', () => {
        const {container} = renderWithContext(
            <GroupProfile
                customID='test'
                isDisabled={false}
                name='Test'
                showAtMention={true}
                title={{id: 'admin.group_settings.group_details.group_profile.name', defaultMessage: 'Name'}}
                onChange={jest.fn()}
            />,
        );

        expect(container).toMatchSnapshot();
        expect(screen.getByLabelText('Name')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Test')).not.toBeDisabled();
        expect(screen.getByDisplayValue('Test')).toHaveAttribute('id', 'testInput');
        expect(container.querySelector('.Input_container')).toBeInTheDocument();
        expect(container.querySelector('svg')).toBeInTheDocument();
    });

    test('should preserve disabled state without mention icon', () => {
        const {container} = renderWithContext(
            <GroupProfile
                customID='groupDisplayName'
                isDisabled={true}
                name='board'
                showAtMention={false}
                title={{id: 'admin.group_settings.group_details.group_profile.name', defaultMessage: 'Name'}}
            />,
        );

        const input = screen.getByLabelText('Name');
        expect(input).toBeDisabled();
        expect(input).toHaveAttribute('id', 'groupDisplayNameInput');
        expect(container.querySelector('svg')).not.toBeInTheDocument();
    });
});
