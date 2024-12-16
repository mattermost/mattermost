// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import * as Menu from 'components/menu';

import CloseChannel from './close_channel';

describe('components/ChannelHeaderDropdown/MenuItem.CloseChannel', () => {
    const baseProps = {
        goToLastViewedChannel: jest.fn(),
    };

    it('should match snapshot', () => {
        const wrapper = shallow(<CloseChannel {...baseProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    it('should runs goToLastViewedChannel function on click', () => {
        const mockFunction = jest.fn();
        const props = {
            goToLastViewedChannel: mockFunction,
        };
        const wrapper = shallow(<CloseChannel {...props}/>);

        expect(wrapper.find(Menu.Item)).toBeDefined();
        wrapper.find(Menu.Item).simulate('click');
        expect(mockFunction).toHaveBeenCalled();
    });
});
