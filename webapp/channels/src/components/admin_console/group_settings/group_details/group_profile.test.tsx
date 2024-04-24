// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import GroupProfile from 'components/admin_console/group_settings/group_details/group_profile';

describe('components/admin_console/group_settings/group_details/GroupProfile', () => {
    test('should match snapshot', () => {
        const wrapper = shallow(
            <GroupProfile
                isDisabled={false}
                name='Test'
                showAtMention={true}
                title={{id: 'admin.group_settings.group_details.group_profile.name', defaultMessage: 'Name:'}}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
