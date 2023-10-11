// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import ExpandView from 'components/channel_notifications_modal/components/expand_view';

import {NotificationLevels, NotificationSections} from 'utils/constants';

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useSelector: jest.fn(() => true),
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

    describe('normal channels', () => {
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

        test('should match snapshot, DESKTOP on expanded view when mentions is selected', () => {
            const props = {...baseProps, memberNotifyLevel: NotificationLevels.MENTION};
            const wrapper = shallow(
                <ExpandView {...props}/>,
            );

            expect(wrapper).toMatchSnapshot();
        });

        test('should match snapshot, PUSH on expanded view when mentions is selected', () => {
            const props = {...baseProps, section: NotificationSections.PUSH, memberNotifyLevel: NotificationLevels.MENTION};
            const wrapper = shallow(
                <ExpandView {...props}/>,
            );

            expect(wrapper).toMatchSnapshot();
        });
    });

    describe('gms', () => {
        test('should match snapshot, DESKTOP on expanded view when mentions is selected', () => {
            const props = {...baseProps, isGM: true, memberNotifyLevel: NotificationLevels.MENTION};
            const wrapper = shallow(
                <ExpandView {...props}/>,
            );

            expect(wrapper).toMatchSnapshot();
        });

        test('should match snapshot, PUSH on expanded view when mentions is selected', () => {
            const props = {...baseProps, section: NotificationSections.PUSH, isGM: true, memberNotifyLevel: NotificationLevels.MENTION};
            const wrapper = shallow(
                <ExpandView {...props}/>,
            );

            expect(wrapper).toMatchSnapshot();
        });
    });
});
