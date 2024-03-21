// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {TestHelper} from 'utils/test_helper';

import PostReaction from './post_reaction';

describe('components/post_view/PostReaction', () => {
    const baseProps = {
        channelId: 'current_channel_id',
        postId: 'post_id_1',
        teamId: 'current_team_id',
        getDotMenuRef: jest.fn(),
        showIcon: false,
        showEmojiPicker: false,
        toggleEmojiPicker: jest.fn(),
        actions: {
            toggleReaction: jest.fn(),
        },
    };

    test('should match snapshot', () => {
        const wrapper = shallow(<PostReaction {...baseProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should call toggleReaction and toggleEmojiPicker on handleToggleEmoji', () => {
        const wrapper = shallow(<PostReaction {...baseProps}/>);
        const instance = wrapper.instance() as PostReaction;

        instance.handleToggleEmoji(TestHelper.getCustomEmojiMock({name: 'smile'}));
        expect(baseProps.actions.toggleReaction).toHaveBeenCalledTimes(1);
        expect(baseProps.actions.toggleReaction).toHaveBeenCalledWith('post_id_1', 'smile');
        expect(baseProps.toggleEmojiPicker).toHaveBeenCalledTimes(1);
    });
});
