// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import VersionBar from 'components/announcement_bar/version_bar/version_bar';
import AnnouncementBar from 'components/announcement_bar/default_announcement_bar';

describe('components/VersionBar', () => {
    test('should match snapshot - bar rendered after build hash change', () => {
        const wrapper = shallow(
            <VersionBar buildHash='844f70a08ead47f06232ecb6fcad63d2'/>,
        );
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find(AnnouncementBar).exists()).toBe(false);

        wrapper.setProps({buildHash: '83ea110da12da84442f92b4634a1e0e2'});
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find(AnnouncementBar).exists()).toBe(true);
    });
});
