// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import GenericModal from 'components/generic_modal';
import {isDesktopApp, getDesktopVersion} from 'utils/user_agent';

import ProductNoticesModal from './product_notices_modal';

jest.mock('utils/user_agent');

describe('ProductNoticesModal', () => {
    const noticesData = [{
        id: '124',
        title: 'for sysadmin',
        description: 'your eyes only! [test](https://test.com)',
        image: 'https://raw.githubusercontent.com/reflog/notices-experiment/master/images/2020-08-11_11-42.png',
        actionText: 'Download',
        actionParam: 'http://download.com/path',
        sysAdminOnly: true,
        teamAdminOnly: false,
    },
    {
        id: '123',
        title: 'title',
        description: 'descr',
        actionText: 'Download',
        actionParam: 'http://download.com/path',
        sysAdminOnly: false,
        teamAdminOnly: false,
    }];

    const baseProps = {
        version: '5.28.0',
        currentTeamId: 'currentTeamId',
        socketStatus: {
            connected: true,
            connectionId: '',
            lastConnectAt: 1599760193593,
            lastDisconnectAt: 0,
        },
        actions: {
            getInProductNotices: jest.fn().mockResolvedValue({data: noticesData}),
            updateNoticesAsViewed: jest.fn().mockResolvedValue({}),
        },
    };

    test('Should match snapshot when there are no notices', async () => {
        const wrapper = shallow(<ProductNoticesModal {...baseProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('Should match snapshot for system admin notice', async () => {
        const wrapper = shallow(<ProductNoticesModal {...baseProps}/>);
        await baseProps.actions.getInProductNotices();
        expect(wrapper).toMatchSnapshot();
    });

    test('Match snapshot for user notice', async () => {
        const wrapper = shallow(<ProductNoticesModal {...baseProps}/>);
        await baseProps.actions.getInProductNotices();
        wrapper.setState({presentNoticeIndex: 1});
        expect(wrapper).toMatchSnapshot();
    });

    test('Match snapshot for single notice', async () => {
        const wrapper = shallow(<ProductNoticesModal {...baseProps}/>);
        await baseProps.actions.getInProductNotices();
        wrapper.setState({noticesData: [noticesData[1]]});
        expect(wrapper).toMatchSnapshot();
    });

    test('Should change the state of presentNoticeIndex on click of next, previous button', async () => {
        const wrapper = shallow(<ProductNoticesModal {...baseProps}/>);
        await baseProps.actions.getInProductNotices();
        expect(wrapper.state('presentNoticeIndex')).toBe(0);
        wrapper.find(GenericModal).prop('handleConfirm')?.();
        expect(wrapper.state('presentNoticeIndex')).toBe(1);
        wrapper.find(GenericModal).prop('handleCancel')?.();
        expect(wrapper.state('presentNoticeIndex')).toBe(0);
    });

    test('Should not have previous button if there is only one notice', async () => {
        const wrapper = shallow(<ProductNoticesModal {...baseProps}/>);
        await baseProps.actions.getInProductNotices();
        expect(wrapper.find(GenericModal).props().handleCancel).toEqual(undefined);
    });

    test('Should not have previous button if there is only one notice', async () => {
        const wrapper = shallow(<ProductNoticesModal {...baseProps}/>);
        await baseProps.actions.getInProductNotices(baseProps.currentTeamId, 'web', baseProps.version);
        expect(wrapper.find(GenericModal).props().handleCancel).toEqual(undefined);
    });

    test('Should open url in a new window on click of handleConfirm for single notice', async () => {
        window.open = jest.fn();
        const wrapper = shallow(<ProductNoticesModal {...baseProps}/>);
        await baseProps.actions.getInProductNotices();
        wrapper.setState({noticesData: [noticesData[1]]});
        wrapper.find(GenericModal).prop('handleConfirm')?.();
        expect(window.open).toHaveBeenCalledWith(noticesData[1].actionParam, '_blank');
    });

    test('Should call for getInProductNotices and updateNoticesAsViewed on mount', async () => {
        shallow(<ProductNoticesModal {...baseProps}/>);
        expect(baseProps.actions.getInProductNotices).toHaveBeenCalledWith(baseProps.currentTeamId, 'web', baseProps.version);
        await baseProps.actions.getInProductNotices();
        expect(baseProps.actions.updateNoticesAsViewed).toHaveBeenCalledWith([noticesData[0].id]);
    });

    test('Should call for updateNoticesAsViewed on click of next button', async () => {
        const wrapper = shallow(<ProductNoticesModal {...baseProps}/>);
        await baseProps.actions.getInProductNotices();
        wrapper.find(GenericModal).prop('handleConfirm')?.();
        expect(baseProps.actions.updateNoticesAsViewed).toHaveBeenCalledWith([noticesData[1].id]);
    });

    test('Should clear state on onExited with a timer', async () => {
        jest.useFakeTimers();
        const wrapper = shallow(<ProductNoticesModal {...baseProps}/>);
        await baseProps.actions.getInProductNotices();
        wrapper.find(GenericModal).prop('onExited')?.();
        jest.runOnlyPendingTimers();
        expect(wrapper.state('noticesData')).toEqual([]);
        expect(wrapper.state('presentNoticeIndex')).toEqual(0);
    });

    test('Should call for getInProductNotices if socket reconnects for the first time in a day', () => {
        const wrapper = shallow(<ProductNoticesModal {...baseProps}/>);
        Date.now = jest.fn().mockReturnValue(1599807605628);
        wrapper.setProps({
            socketStatus: {
                ...baseProps.socketStatus,
                connected: false,
            },
        });

        wrapper.setProps({
            socketStatus: {
                ...baseProps.socketStatus,
                connected: true,
            },
        });

        expect(baseProps.actions.getInProductNotices).toHaveBeenCalledWith(baseProps.currentTeamId, 'web', baseProps.version);
        expect(baseProps.actions.getInProductNotices).toHaveBeenCalledTimes(2);
    });

    test('Should call for getInProductNotices with desktop as client if isDesktopApp returns true', () => {
        (getDesktopVersion as any).mockReturnValue('4.5.0');
        (isDesktopApp as any).mockReturnValue(true);
        shallow(<ProductNoticesModal {...baseProps}/>);
        expect(baseProps.actions.getInProductNotices).toHaveBeenCalledWith(baseProps.currentTeamId, 'desktop', '4.5.0');
    });

    test('Should not call for getInProductNotices if socket reconnects on the same day', () => {
        const wrapper = shallow(<ProductNoticesModal {...baseProps}/>);
        Date.now = jest.fn().mockReturnValue(1599760196593);
        wrapper.setProps({
            socketStatus: {
                ...baseProps.socketStatus,
                connected: false,
            },
        });

        wrapper.setProps({
            socketStatus: {
                ...baseProps.socketStatus,
                connected: true,
            },
        });

        expect(baseProps.actions.getInProductNotices).toHaveBeenCalledTimes(1);
    });
});
