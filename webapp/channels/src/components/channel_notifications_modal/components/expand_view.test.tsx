// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import {NotificationLevels, NotificationSections} from 'utils/constants';

import ExpandView from 'components/channel_notifications_modal/components/expand_view';

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useSelector: jest.fn(),
}));

describe('components/channel_notifications_modal/ExpandView', () => {
    const baseProps = {
        section: NotificationSections.DESKTOP,
        memberNotifyLevel: NotificationLevels.ALL,
        memberThreadsNotifyLevel: NotificationLevels.ALL,
        globalNotifyLevel: NotificationLevels.DEFAULT,
        serverError: '',
        onChange: jest.fn(),
        onChangeThreads: jest.fn(),
        onCollapseSection: jest.fn(),
        onSubmit: jest.fn(),
        onReset: jest.fn(),
        isGM: false,
    };

    test('should match snapshot, DESKTOP on expanded view', () => {
        const wrapper = shallow(
            <ExpandView {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, PUSH on expanded view', () => {
        const props = {...baseProps, section: NotificationSections.PUSH};
        const wrapper = shallow(
            <ExpandView {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, MARK_UNREAD on expanded view', () => {
        const props = {...baseProps, section: NotificationSections.MARK_UNREAD};
        const wrapper = shallow(
            <ExpandView {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
