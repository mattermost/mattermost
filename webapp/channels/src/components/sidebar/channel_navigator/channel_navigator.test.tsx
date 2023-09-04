// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import ChannelNavigator from './channel_navigator';
import type {Props} from './channel_navigator';

import AddChannelDropdown from '../add_channel_dropdown';

let props: Props;

describe('Components/ChannelNavigator', () => {
    beforeEach(() => {
        props = {
            showUnreadsCategory: true,
            isQuickSwitcherOpen: false,
            actions: {
                openModal: jest.fn(),
                closeModal: jest.fn(),
            },
        };
    });

    it('should not show AddChannelDropdown', () => {
        const wrapper = shallow(<ChannelNavigator {...props}/>);
        expect(wrapper.find(AddChannelDropdown).length).toBe(0);
    });
});
