// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import GetPublicLinkModal from 'components/get_public_link_modal/get_public_link_modal';
import GetLinkModal from 'components/get_link_modal';

describe('components/GetPublicLinkModal', () => {
    const baseProps = {
        link: 'http://mattermost.com/files/n5bnoaz3e7g93nyipzo1bixdwr/public?h=atw9qQHI1nUPnxo1e48tPspo1Qvwd3kHtJZjysmI5zs',
        fileId: 'n5bnoaz3e7g93nyipzo1bixdwr',
        onExited: jest.fn(),
        actions: {
            getFilePublicLink: jest.fn(),
        },
    };

    test('should match snapshot when link is empty', () => {
        const props = {
            ...baseProps,
            link: '',
        };

        const wrapper = shallow<GetPublicLinkModal>(
            <GetPublicLinkModal {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when link is not empty', () => {
        const wrapper = shallow<GetPublicLinkModal>(
            <GetPublicLinkModal {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should call getFilePublicLink on GetPublicLinkModal\'s show', () => {
        const wrapper = shallow<GetPublicLinkModal>(
            <GetPublicLinkModal {...baseProps}/>,
        );

        wrapper.setState({show: true});
        expect(baseProps.actions.getFilePublicLink).toHaveBeenCalledTimes(1);
        expect(baseProps.actions.getFilePublicLink).toHaveBeenCalledWith(baseProps.fileId);
    });

    test('should not call getFilePublicLink on GetLinkModal\'s onHide', () => {
        const wrapper = shallow<GetPublicLinkModal>(
            <GetPublicLinkModal {...baseProps}/>,
        );

        wrapper.setState({show: true});
        baseProps.actions.getFilePublicLink.mockClear();
        wrapper.find(GetLinkModal).first().props().onHide();
        expect(baseProps.actions.getFilePublicLink).not.toHaveBeenCalled();
    });

    test('should call handleToggle on GetLinkModal\'s onHide', () => {
        const wrapper = shallow<GetPublicLinkModal>(
            <GetPublicLinkModal {...baseProps}/>);

        wrapper.find(GetLinkModal).first().props().onHide();
        expect(wrapper.state('show')).toBe(false);
    });
});
