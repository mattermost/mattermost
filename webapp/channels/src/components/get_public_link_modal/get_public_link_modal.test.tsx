// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import GetLinkModal from 'components/get_link_modal';
import GetPublicLinkModal from 'components/get_public_link_modal/get_public_link_modal';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import {act} from 'tests/react_testing_utils';

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

        const wrapper = shallow(
            <GetPublicLinkModal {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when link is not empty', () => {
        const wrapper = shallow(
            <GetPublicLinkModal {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should call getFilePublicLink on GetPublicLinkModal\'s show', () => {
        mountWithIntl(<GetPublicLinkModal {...baseProps}/>);

        expect(baseProps.actions.getFilePublicLink).toHaveBeenCalledTimes(1);
        expect(baseProps.actions.getFilePublicLink).toHaveBeenCalledWith(baseProps.fileId);
    });

    test('should not call getFilePublicLink on GetLinkModal\'s onHide', () => {
        const wrapper = shallow(
            <GetPublicLinkModal {...baseProps}/>,
        );

        baseProps.actions.getFilePublicLink.mockClear();
        wrapper.find(GetLinkModal).first().props().onHide();
        expect(baseProps.actions.getFilePublicLink).not.toHaveBeenCalled();
    });

    test('should call handleToggle on GetLinkModal\'s onHide', () => {
        const wrapper = mountWithIntl(<GetPublicLinkModal {...baseProps}/>);

        act(() => {
            wrapper.find(GetLinkModal).first().props().onHide();
        });
        wrapper.update();
        expect(wrapper.find(GetLinkModal).first().props().show).toBe(false);
    });
});
