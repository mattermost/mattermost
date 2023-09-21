// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

<<<<<<< HEAD:webapp/channels/src/components/channel_notifications_modal/components/notification_section.test.tsx
import React, {ChangeEvent} from 'react';
=======
>>>>>>> b7b08dbc0f9b13feee12e7289eae1e3fca0aa682:webapp/channels/src/components/channel_notifications_modal/components/notification_section.test.jsx
import {shallow} from 'enzyme';
import React from 'react';

import NotificationSection, {Props} from 'components/channel_notifications_modal/components/notification_section';

import {NotificationLevels, NotificationSections} from 'utils/constants';

describe('components/channel_notifications_modal/NotificationSection', () => {
    const baseProps: Props = {
        section: NotificationSections.DESKTOP,
        expand: false,
        memberNotificationLevel: NotificationLevels.ALL,
        memberThreadsNotificationLevel: NotificationLevels.ALL,
        globalNotificationLevel: NotificationLevels.DEFAULT,
        onChange: () => {}, //eslint-disable-line no-empty-function
        onChangeThreads: () => {}, //eslint-disable-line no-empty-function
        onReset: () => {},
        onSubmit: () => {}, //eslint-disable-line no-empty-function
        onUpdateSection: () => {}, //eslint-disable-line no-empty-function
        serverError: '',
        isGM: false,
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
        const props = {...baseProps, section: NotificationSections.MARK_UNREAD, globalNotificationLevel: undefined};
        const wrapper = shallow(
            <NotificationSection {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, MARK_UNREAD on expanded view', () => {
        const props = {...baseProps, section: NotificationSections.MARK_UNREAD, expand: true, globalNotificationLevel: undefined};
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
        (wrapper.instance() as NotificationSection).handleOnChange({currentTarget: {value: NotificationLevels.ALL}} as ChangeEvent<HTMLInputElement>);
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(NotificationLevels.ALL);
    });

    test('should have called onUpdateSection when handleExpandSection is called', () => {
        const onUpdateSection = jest.fn();
        const props = {...baseProps, expand: true, onUpdateSection};
        const wrapper = shallow(
            <NotificationSection {...props}/>,
        );
        (wrapper.instance() as NotificationSection).handleExpandSection();
        expect(onUpdateSection).toHaveBeenCalledTimes(1);
        expect(onUpdateSection).toHaveBeenCalledWith(NotificationSections.DESKTOP);
    });

    test('should have called onUpdateSection when handleCollapseSection is called', () => {
        const onUpdateSection = jest.fn();
        const props = {...baseProps, expand: true, onUpdateSection};
        const wrapper = shallow(
            <NotificationSection {...props}/>,
        );
        (wrapper.instance() as NotificationSection).handleCollapseSection();
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
