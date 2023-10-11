// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import {Modal} from 'react-bootstrap';

import GetLinkModal from 'components/get_link_modal';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';

describe('components/GetLinkModal', () => {
    const onHide = jest.fn();
    const requiredProps = {
        show: true,
        onHide,
        onExited: jest.fn(),
        title: 'title',
        link: 'https://mattermost.com',
    };

    test('should match snapshot when all props is set', () => {
        const helpText = 'help text';
        const props = {...requiredProps, helpText};

        const wrapper = shallow(
            <GetLinkModal {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when helpText is not set', () => {
        const wrapper = shallow(
            <GetLinkModal {...requiredProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should have called onHide', () => {
        const newOnHide = jest.fn();
        const props = {...requiredProps, onHide: newOnHide};

        const wrapper = shallow(
            <GetLinkModal {...props}/>,
        );

        wrapper.find(Modal).first().props().onHide();
        expect(newOnHide).toHaveBeenCalledTimes(1);
        expect(wrapper.state('copiedLink')).toBe(false);

        wrapper.setProps({show: true});
        wrapper.setState({copiedLink: true});
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.state('copiedLink')).toBe(true);

        wrapper.find('#linkModalCloseButton').simulate('click');
        expect(newOnHide).toHaveBeenCalledTimes(2);
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.state('copiedLink')).toBe(false);
    });

    test('should have handle copyLink', () => {
        const wrapper = mountWithIntl(
            <GetLinkModal {...requiredProps}/>,
        );
        wrapper.find('#linkModalTextArea').simulate('click');
        expect(wrapper.state('copiedLink')).toBe(true);
    });
});
