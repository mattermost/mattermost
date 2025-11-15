// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import ChannelBookmarksCreateModal from './channel_bookmarks_create_modal';

describe('components/channel_bookmarks/channel_bookmarks_create_modal', () => {
    const baseProps = {
        channelId: 'channel_id',
        onHide: jest.fn(),
        actions: {
            createChannelBookmark: jest.fn().mockResolvedValue({data: {}}),
        },
    };

    test('should match snapshot for link bookmark', () => {
        const wrapper = shallow(<ChannelBookmarksCreateModal {...baseProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot for file bookmark', () => {
        const wrapper = shallow(<ChannelBookmarksCreateModal {...baseProps} type='file'/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot for in-app link bookmark', () => {
        const wrapper = shallow(<ChannelBookmarksCreateModal {...baseProps} type='inapp_link'/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should toggle in-app link checkbox', () => {
        const wrapper = shallow(<ChannelBookmarksCreateModal {...baseProps} type='link'/>);
        
        // Find the checkbox and simulate a change
        const checkbox = wrapper.find('input[type="checkbox"]');
        expect(checkbox.exists()).toBe(true);
        
        // Initially it should be unchecked
        expect(checkbox.prop('checked')).toBe(false);
        
        // Simulate checking the box
        checkbox.simulate('change', {target: {checked: true}});
        
        // Now it should be checked
        expect(wrapper.find('input[type="checkbox"]').prop('checked')).toBe(true);
    });

    test('should update bookmark type when in-app link checkbox is toggled', () => {
        const wrapper = shallow(<ChannelBookmarksCreateModal {...baseProps} type='link'/>);
        
        // Find the checkbox and simulate a change
        const checkbox = wrapper.find('input[type="checkbox"]');
        checkbox.simulate('change', {target: {checked: true}});
        
        // When the form is submitted, it should use the inapp_link type
        wrapper.setState({
            displayName: 'Test Bookmark',
            linkUrl: 'mattermost://channel/team-name/channel-name',
        });
        
        // Mock the event
        const preventDefault = jest.fn();
        wrapper.find('form').simulate('submit', {preventDefault});
        
        // Verify the action was called with the correct type
        expect(baseProps.actions.createChannelBookmark).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'inapp_link',
                link_url: 'mattermost://channel/team-name/channel-name',
            })
        );
    });
});