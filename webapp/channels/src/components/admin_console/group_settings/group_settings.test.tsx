// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import GroupSettings from 'components/admin_console/group_settings/group_settings';

describe('components/admin_console/group_settings/GroupSettings', () => {
    test('should match snapshot', () => {
        const wrapper = shallow(
            <GroupSettings/>,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
