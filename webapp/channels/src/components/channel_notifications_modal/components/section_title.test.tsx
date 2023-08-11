// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallow} from 'enzyme';

import SectionTitle from 'components/channel_notifications_modal/components/section_title';

import {NotificationSections} from 'utils/constants';

describe('components/channel_notifications_modal/ExtraInfo', () => {
    const baseProps = {
        section: NotificationSections.DESKTOP,
    };

    test('should match snapshot, on DESKTOP', () => {
        const wrapper = shallow(
            <SectionTitle {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, on PUSH', () => {
        const props = {...baseProps, section: NotificationSections.PUSH};
        const wrapper = shallow(
            <SectionTitle {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, on MARK_UNREAD', () => {
        const props = {...baseProps, section: NotificationSections.MARK_UNREAD};
        const wrapper = shallow(
            <SectionTitle {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
