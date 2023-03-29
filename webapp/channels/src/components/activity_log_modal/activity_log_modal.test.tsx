// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {MouseEvent} from 'react';
import {shallow} from 'enzyme';

import ActivityLogModal from 'components/activity_log_modal/activity_log_modal';

import {General} from 'mattermost-redux/constants';

describe('components/ActivityLogModal', () => {
    const baseProps = {
        sessions: [],
        currentUserId: '',
        onHide: jest.fn(),
        actions: {
            getSessions: jest.fn(),
            revokeSession: jest.fn(),
        },
        locale: General.DEFAULT_LOCALE,
    };

    test('should match snapshot', () => {
        const wrapper = shallow<ActivityLogModal>(
            <ActivityLogModal {...baseProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when submitRevoke is called', () => {
        const revokeSession = jest.fn().mockImplementation(
            () => {
                return new Promise<void>((resolve) => {
                    process.nextTick(() => resolve());
                });
            },
        );
        const actions = {
            getSessions: jest.fn(),
            revokeSession,
        };

        const props = {...baseProps, actions};
        const wrapper = shallow<ActivityLogModal>(
            <ActivityLogModal {...props}/>,
        );

        wrapper.instance().submitRevoke('altId', {preventDefault: jest.fn()} as unknown as MouseEvent);
        expect(wrapper).toMatchSnapshot();
        expect(revokeSession).toHaveBeenCalledTimes(1);
        expect(revokeSession).toHaveBeenCalledWith('', 'altId');
    });

    test('should have called actions.getUserAudits when onShow is called', () => {
        const actions = {
            getSessions: jest.fn(),
            revokeSession: jest.fn(),
        };
        const props = {...baseProps, actions};
        const wrapper = shallow<ActivityLogModal>(
            <ActivityLogModal {...props}/>,
        );

        wrapper.instance().onShow();
        expect(actions.getSessions).toHaveBeenCalledTimes(2);
    });

    test('should match state when onHide is called', () => {
        const wrapper = shallow<ActivityLogModal>(
            <ActivityLogModal {...baseProps}/>,
        );

        wrapper.setState({show: true});
        wrapper.instance().onHide();
        expect(wrapper.state('show')).toEqual(false);
    });
});
