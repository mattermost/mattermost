// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallow} from 'enzyme';

import CtaButtons from 'components/admin_console/workspace-optimization/cta_buttons';

describe('components/admin_console/workspace-optimization/cta_buttons', () => {
    const baseProps = {
        learnMoreLink: '/learn_more',
        learnMoreText: 'Learn More',
        actionLink: '/action_link',
        actionText: 'Action Text',
    };

    test('should match snapshot', () => {
        const wrapper = shallow(<CtaButtons {...baseProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('test ctaButtons list lenght is 3 as defined in baseProps', () => {
        const wrapper = shallow(<CtaButtons {...baseProps}/>);
        const ctaButtons = wrapper.find('button');

        expect(ctaButtons.length).toBe(2);
    });
});
