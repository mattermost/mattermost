// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import GroupProfile from 'components/admin_console/group_settings/group_details/group_profile';

import {renderWithContext, screen} from 'tests/react_testing_utils';

describe('components/admin_console/group_settings/group_details/GroupProfile', () => {
    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <GroupProfile
                customID='test'
                isDisabled={false}
                name='Test'
                showAtMention={true}
                title={{id: 'admin.group_settings.group_details.group_profile.name', defaultMessage: 'Name:'}}
                onChange={jest.fn()}
            />,
        );

        expect(container).toMatchSnapshot();
        expect(screen.getByLabelText('Name:')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Test')).not.toBeDisabled();
        expect(container.querySelector('.icon__mentions')).toBeInTheDocument();
    });
});
