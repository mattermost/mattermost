// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallow} from 'enzyme';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';

import RemovedFromChannelModal from 'components/removed_from_channel_modal/removed_from_channel_modal';

describe('components/RemoveFromChannelModal', () => {
    const baseProps = {
        currentUserId: 'current_user_id',
        channelName: 'test-channel',
        remover: 'Administrator',
        onExited: jest.fn(),
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <RemovedFromChannelModal {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should have state "show" equals true on mount', () => {
        const wrapper = shallow(
            <RemovedFromChannelModal {...baseProps}/>,
        );

        expect(wrapper.state('show')).toBe(true);
    });

    test('should display correct props on Modal.Title and Modal.Body', () => {
        const wrapper = mountWithIntl(
            <RemovedFromChannelModal {...baseProps}/>,
        );

        expect(wrapper.find('.modal-title').text()).toBe('Removed from test-channel');
        expect(wrapper.find('.modal-body').text()).toBe('Administrator removed you from test-channel');
    });

    test('should fallback to default text on Modal.Body', () => {
        baseProps.channelName = '';
        baseProps.remover = '';

        const wrapper = mountWithIntl(
            <RemovedFromChannelModal {...baseProps}/>,
        );

        expect(wrapper.find('.modal-title').text()).toBe('Removed from the channel');
        expect(wrapper.find('.modal-body').text()).toBe('Someone removed you from the channel');
    });
});
