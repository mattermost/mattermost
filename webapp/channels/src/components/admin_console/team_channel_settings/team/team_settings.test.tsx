// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallow} from 'enzyme';

import {TeamsSettings} from './team_settings';

describe('admin_console/team_channel_settings/team/TeamSettings', () => {
    test('should match snapshot', () => {
        const wrapper = shallow(
            <TeamsSettings
                siteName='site'
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
