// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import {NotificationLevels, NotificationSections} from 'utils/constants';

import NotificationSection from 'components/channel_notifications_modal/components/notification_section.jsx';

describe('components/channel_notifications_modal/NotificationSection', () => {
    const baseProps = {
        section: NotificationSections.DESKTOP,
        expand: false,
        memberNotificationLevel: NotificationLevels.ALL,
        memberThreadsNotificationLevel: NotificationLevels.ALL,
        globalNotificationLevel: NotificationLevels.DEFAULT,
        onChange: () => {}, //eslint-disable-line no-empty-function
        onChangeThreads: () => {}, //eslint-disable-line no-empty-function
        onSubmit: () => {}, //eslint-disable-line no-empty-function
        onUpdateSection: () => {}, //eslint-disable-line no-empty-function
        serverError: '',
    };

    test('should match snapshot, DESKTOP on collapsed view', () => {
        const wrapper = shallow(
            <NotificationSection {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, DESKTOP on expanded view', () => {
        const props = {...baseProps, expand: true};
        const wrapper = shallow(
            <NotificationSection {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, PUSH on collapsed view', () => {
        const props = {...baseProps, section: NotificationSections.PUSH};
        const wrapper = shallow(
            <NotificationSection {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, PUSH on expanded view', () => {
        const props = {...baseProps, section: NotificationSections.PUSH, expand: true};
        const wrapper = shallow(
            <NotificationSection {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, MARK_UNREAD on collapsed view', () => {
        const props = {...baseProps, section: NotificationSections.MARK_UNREAD, globalNotificationLevel: null};
        const wrapper = shallow(
            <NotificationSection {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, MARK_UNREAD on expanded view', () => {
        const props = {...baseProps, section: NotificationSections.MARK_UNREAD, expand: true, globalNotificationLevel: null};
        const wrapper = shallow(
            <NotificationSection {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should have called onChange when handleOnChange is called', () => {
        const onChange = jest.fn();
        const props = {...baseProps, expand: true, onChange};
        const wrapper = shallow(
            <NotificationSection {...props}/>,
        );
        wrapper.instance().handleOnChange({target: {value: NotificationLevels.ALL}});
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(NotificationLevels.ALL);
    });

    test('should have called onUpdateSection when handleExpandSection is called', () => {
        const onUpdateSection = jest.fn();
        const props = {...baseProps, expand: true, onUpdateSection};
        const wrapper = shallow(
            <NotificationSection {...props}/>,
        );
        wrapper.instance().handleExpandSection({preventDefault: jest.fn()});
        expect(onUpdateSection).toHaveBeenCalledTimes(1);
        expect(onUpdateSection).toHaveBeenCalledWith(NotificationSections.DESKTOP);
    });

    test('should have called onUpdateSection when handleCollapseSection is called', () => {
        const onUpdateSection = jest.fn();
        const props = {...baseProps, expand: true, onUpdateSection};
        const wrapper = shallow(
            <NotificationSection {...props}/>,
        );
        wrapper.instance().handleCollapseSection({preventDefault: jest.fn()});
        expect(onUpdateSection).toHaveBeenCalledTimes(1);
        expect(onUpdateSection).toHaveBeenCalledWith(NotificationSections.NONE);
    });

    test('should match snapshot on server error', () => {
        const props = {...baseProps, serverError: 'server error occurred'};
        const wrapper = shallow(
            <NotificationSection {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
