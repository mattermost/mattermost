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


});