// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {Reaction as ReactionType} from '@mattermost/types/reactions';

import Reaction from 'components/post_view/reaction/reaction';

import {TestHelper} from 'utils/test_helper';

describe('components/post_view/Reaction', () => {
    const post = TestHelper.getPostMock({
        id: 'post_id',
    });
    const reactions: ReactionType[] = [{
        user_id: 'user_id_2',
        post_id: post.id,
        emoji_name: ':smile:',
        create_at: 0,
    }, {
        user_id: 'user_id_3',
        post_id: post.id,
        emoji_name: ':smile:',
        create_at: 0}];
    const emojiName = 'smile';
    const actions = {
        addReaction: jest.fn(),
        getMissingProfilesByIds: jest.fn(),
        removeReaction: jest.fn(),
    };
    const currentUserId = 'user_id_1';

    const baseProps = {
        canAddReactions: true,
        canRemoveReactions: true,
        currentUserId,
        post,
        currentUserReacted: false,
        emojiName,
        reactionCount: 2,
        reactions,
        emojiImageUrl: 'emoji_image_url',
        actions,
    };

    test('should match snapshot', () => {
        const wrapper = shallow<Reaction>(<Reaction {...baseProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when a current user reacted to a post', () => {
        const newReactions = [{
            user_id: 'user_id_1',
            post_id: post.id,
            emoji_name: ':cry:',
            create_at: 0,
        }, {
            user_id: 'user_id_3',
            post_id: post.id,
            emoji_name: ':smile:',
            create_at: 0}];
        const props = {
            ...baseProps,
            currentUserReacted: true,
            reactions: newReactions,
        };
        const wrapper = shallow<Reaction>(<Reaction {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should return null/empty if no emojiImageUrl', () => {
        const props = {...baseProps, emojiImageUrl: ''};
        const wrapper = shallow<Reaction>(<Reaction {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should apply read-only class if user does not have permission to add reaction', () => {
        const props = {...baseProps, canAddReactions: false};
        const wrapper = shallow<Reaction>(<Reaction {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should apply read-only class if user does not have permission to remove reaction', () => {
        const newCurrentUserId = 'user_id_2';
        const props = {
            ...baseProps,
            canRemoveReactions: false,
            currentUserId: newCurrentUserId,
            currentUserReacted: true,
        };
        const wrapper = shallow<Reaction>(<Reaction {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should have called actions.getMissingProfilesByIds when loadMissingProfiles is called', () => {
        const wrapper = shallow<Reaction>(<Reaction {...baseProps}/>);
        wrapper.instance().loadMissingProfiles();

        expect(actions.getMissingProfilesByIds).toHaveBeenCalledTimes(1);
        expect(actions.getMissingProfilesByIds).toHaveBeenCalledWith([reactions[0].user_id, reactions[1].user_id]);
    });
});
