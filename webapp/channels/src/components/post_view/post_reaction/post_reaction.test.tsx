// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Emoji} from '@mattermost/types/emojis';
import {shallow} from 'enzyme';
import React from 'react';

import PostReaction from 'components/post_view/post_reaction/post_reaction';

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
            addReaction: jest.fn(),
        },
    };

    test('should match snapshot', () => {
        const wrapper = shallow(<PostReaction {...baseProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should call addReaction and toggleEmojiPicker on handleAddEmoji', () => {
        const wrapper = shallow(<PostReaction {...baseProps}/>);
        const instance = wrapper.instance() as PostReaction;

        instance.handleAddEmoji({name: 'smile'} as Emoji);
        expect(baseProps.actions.addReaction).toHaveBeenCalledTimes(1);
        expect(baseProps.actions.addReaction).toHaveBeenCalledWith('post_id_1', 'smile');
        expect(baseProps.toggleEmojiPicker).toHaveBeenCalledTimes(1);
    });
});
