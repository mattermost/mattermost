// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import SiteNameAndDescription from 'components/common/site_name_and_description';

describe('/components/common/SiteNameAndDescription', () => {
    const baseProps = {
        customDescriptionText: '',
        siteName: 'Mattermost',
    };

    test('should match snapshot, default', () => {
        const wrapper = shallow(<SiteNameAndDescription {...baseProps}/>);
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('h1').text()).toEqual(baseProps.siteName);
        expect(wrapper.find(FormattedMessage).exists()).toBe(true);
    });

    test('should match snapshot, with custom site name and description', () => {
        const props = {...baseProps, customDescriptionText: 'custom_description_text', siteName: 'other_site'};
        const wrapper = shallow(<SiteNameAndDescription {...props}/>);

        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('h1').text()).toEqual(props.siteName);
        expect(wrapper.find('h3').text()).toEqual(props.customDescriptionText);
    });
});
