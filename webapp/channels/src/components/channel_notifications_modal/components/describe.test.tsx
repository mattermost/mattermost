// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import Describe from 'components/channel_notifications_modal/components/describe';

import {NotificationLevels, NotificationSections} from 'utils/constants';

describe('components/channel_notifications_modal/NotificationSection', () => {
    const baseProps = {
        section: NotificationSections.DESKTOP,
        memberNotifyLevel: NotificationLevels.DEFAULT,
        globalNotifyLevel: NotificationLevels.DEFAULT,
    };

    test('should match snapshot, on global DEFAULT', () => {
        const wrapper = shallow(
            <Describe {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, on MENTION', () => {
        const props = {...baseProps, memberNotifyLevel: NotificationLevels.MENTION};
        const wrapper = shallow(
            <Describe {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, on DESKTOP/PUSH & ALL', () => {
        const props = {...baseProps, memberNotifyLevel: NotificationLevels.ALL};
        const wrapper = shallow(
            <Describe {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, on MARK_UNREAD & ALL', () => {
        const props = {...baseProps, section: NotificationSections.MARK_UNREAD, memberNotifyLevel: NotificationLevels.ALL};
        const wrapper = shallow(
            <Describe {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, on NONE', () => {
        const props = {...baseProps, memberNotifyLevel: NotificationLevels.NONE};
        const wrapper = shallow(
            <Describe {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
