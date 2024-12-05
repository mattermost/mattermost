// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import {Modal} from 'react-bootstrap';

import {General} from 'mattermost-redux/constants';

import ConvertChannelModal from 'components/convert_channel_modal/convert_channel_modal';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';

describe('component/ConvertChannelModal', () => {
    const updateChannelPrivacy = jest.fn().mockImplementation(() => Promise.resolve({}));
    const baseProps = {
        onExited: jest.fn(),
        channelId: 'owsyt8n43jfxjpzh9np93mx1wa',
        channelDisplayName: 'Channel Display Name',
        actions: {
            updateChannelPrivacy,
        },
    };

    test('should match snapshot for convert_channel_modal', () => {
        const wrapper = shallow(
            <ConvertChannelModal {...baseProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match state when onHide is called', () => {
        const wrapper = shallow<ConvertChannelModal>(
            <ConvertChannelModal {...baseProps}/>,
        );

        wrapper.setState({show: true});
        wrapper.instance().onHide();
        expect(wrapper.state('show')).toEqual(false);
    });

    test('should call updateChannelPrivacy after confirming', (done) => {
        baseProps.onExited.mockImplementation(() => done());

        const wrapper = mountWithIntl(
            <ConvertChannelModal
                {...baseProps}
            />,
        );

        expect(wrapper.find(Modal).prop('show')).toBe(true);
        expect(baseProps.onExited).not.toHaveBeenCalled();

        wrapper.find('[data-testid="convertChannelConfirm"]').simulate('click');

        expect(updateChannelPrivacy).toHaveBeenCalledTimes(1);
        expect(updateChannelPrivacy).toHaveBeenCalledWith(baseProps.channelId, General.PRIVATE_CHANNEL);
        expect(wrapper.find(Modal).prop('show')).toBe(false);
    }, 5000);

    test('should call onExited after cancelling', (done) => {
        baseProps.onExited.mockImplementation(() => done());

        const wrapper = mountWithIntl(
            <ConvertChannelModal
                {...baseProps}
            />,
        );

        expect(wrapper.find(Modal).prop('show')).toBe(true);
        expect(baseProps.onExited).not.toHaveBeenCalled();

        wrapper.find('[data-testid="convertChannelCancel"]').simulate('click');

        expect(wrapper.find(Modal).prop('show')).toBe(false);
    }, 5000);
});
