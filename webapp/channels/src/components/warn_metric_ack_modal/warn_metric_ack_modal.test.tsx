// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UserProfile} from '@mattermost/types/users';
import {shallow} from 'enzyme';
import React from 'react';
import {Modal} from 'react-bootstrap';

import WarnMetricAckModal from 'components/warn_metric_ack_modal/warn_metric_ack_modal';

describe('components/WarnMetricAckModal', () => {
    const serverError = 'some error';

    const baseProps = {
        stats: {
            registered_users: 200,
        },
        user: {
            id: 'someUserId',
            first_name: 'Fake',
            last_name: 'Person',
            email: 'a@test.com',
        } as UserProfile,
        show: false,
        telemetryId: 'diag_0',
        closeParentComponent: jest.fn(),
        warnMetricStatus: {
            id: 'metric1',
            limit: 500,
            acked: false,
            store_status: 'status1',
        },
        actions: {
            closeModal: jest.fn(),
            getFilteredUsersStats: jest.fn(),
            sendWarnMetricAck: jest.fn().mockResolvedValue({}),
        },
    };

    test('should match snapshot, init', () => {
        const wrapper = shallow<WarnMetricAckModal>(
            <WarnMetricAckModal {...baseProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('error display', () => {
        const wrapper = shallow<WarnMetricAckModal>(
            <WarnMetricAckModal {...baseProps}/>,
        );

        wrapper.setState({serverError});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match state when onHide is called', () => {
        const wrapper = shallow<WarnMetricAckModal>(
            <WarnMetricAckModal {...baseProps}/>,
        );

        wrapper.setState({saving: true});
        wrapper.instance().onHide();
        expect(wrapper.state('saving')).toEqual(false);
    });

    test('should match state when onHideWithParent is called', () => {
        const wrapper = shallow<WarnMetricAckModal>(
            <WarnMetricAckModal {...baseProps}/>,
        );

        wrapper.setState({saving: true});
        wrapper.instance().onHide();

        expect(baseProps.closeParentComponent).toHaveBeenCalledTimes(1);
        expect(wrapper.state('saving')).toEqual(false);
    });

    test('send ack on acknowledge button click', () => {
        const props = {...baseProps};

        const wrapper = shallow<WarnMetricAckModal>(
            <WarnMetricAckModal {...props}/>,
        );

        wrapper.setState({saving: false});
        wrapper.find('.save-button').simulate('click');
        expect(props.actions.sendWarnMetricAck).toHaveBeenCalledTimes(1);
    });

    test('should have called props.onHide when Modal.onExited is called', () => {
        const props = {...baseProps};
        const wrapper = shallow(
            <WarnMetricAckModal {...props}/>,
        );

        wrapper.find(Modal).props().onExited!(document.createElement('div'));
        expect(baseProps.actions.closeModal).toHaveBeenCalledTimes(1);
    });
});
