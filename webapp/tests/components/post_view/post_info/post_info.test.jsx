// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import Constants from 'utils/constants.jsx';
import PostInfo from 'components/post_view/post_info/post_info.jsx';
import {Posts} from 'mattermost-redux/constants';

const post = {
    channel_id: 'g6139tbospd18cmxroesdk3kkc',
    create_at: 1502715365009,
    delete_at: 0,
    edit_at: 1502715372443,
    hashtags: '',
    id: 'e584uzbwwpny9kengqayx5ayzw',
    is_pinned: false,
    message: 'post message',
    original_id: '',
    parent_id: '',
    pending_post_id: '',
    props: {},
    root_id: '',
    type: '',
    update_at: 1502715372443,
    user_id: 'b4pfxi8sn78y8yq7phzxxfor7h'
};

describe('components/post_view/PostInfo', () => {
    afterEach(() => {
        global.window.mm_config = null;
        global.window.EnableEmojiPicker = null;
    });

    test('should match snapshot', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function

        global.window.mm_config = {};
        global.window.mm_config.EnableEmojiPicker = 'true';

        const wrapper = shallow(
            <PostInfo
                post={post}
                handleCommentClick={emptyFunction}
                handleDropdownOpened={emptyFunction}
                compactDisplay={false}
                lastPostCount={0}
                replyCount={0}
                getPostList={emptyFunction}
                useMilitaryTime={false}
                isFlagged={false}
                actions={{
                    removePost: emptyFunction,
                    addReaction: emptyFunction
                }}
            />
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, compact display', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function

        global.window.mm_config = {};
        global.window.mm_config.EnableEmojiPicker = 'true';

        const wrapper = shallow(
            <PostInfo
                post={post}
                handleCommentClick={emptyFunction}
                handleDropdownOpened={emptyFunction}
                compactDisplay={false}
                lastPostCount={0}
                replyCount={0}
                getPostList={emptyFunction}
                useMilitaryTime={false}
                isFlagged={false}
                actions={{
                    removePost: emptyFunction,
                    addReaction: emptyFunction
                }}
            />
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, military time', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function

        global.window.mm_config = {};
        global.window.mm_config.EnableEmojiPicker = 'false';

        const wrapper = shallow(
            <PostInfo
                post={post}
                handleCommentClick={emptyFunction}
                handleDropdownOpened={emptyFunction}
                compactDisplay={false}
                lastPostCount={0}
                replyCount={0}
                getPostList={emptyFunction}
                useMilitaryTime={true}
                isFlagged={false}
                actions={{
                    removePost: emptyFunction,
                    addReaction: emptyFunction
                }}
            />
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, flagged post', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function

        global.window.mm_config = {};
        global.window.mm_config.EnableEmojiPicker = 'true';

        const wrapper = shallow(
            <PostInfo
                post={post}
                handleCommentClick={emptyFunction}
                handleDropdownOpened={emptyFunction}
                compactDisplay={false}
                lastPostCount={0}
                replyCount={0}
                getPostList={emptyFunction}
                useMilitaryTime={false}
                isFlagged={true}
                actions={{
                    removePost: emptyFunction,
                    addReaction: emptyFunction
                }}
            />
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, pinned post', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function

        global.window.mm_config = {};
        global.window.mm_config.EnableEmojiPicker = 'true';

        post.is_pinned = true;

        const wrapper = shallow(
            <PostInfo
                post={post}
                handleCommentClick={emptyFunction}
                handleDropdownOpened={emptyFunction}
                compactDisplay={false}
                lastPostCount={0}
                replyCount={0}
                getPostList={emptyFunction}
                useMilitaryTime={false}
                isFlagged={true}
                actions={{
                    removePost: emptyFunction,
                    addReaction: emptyFunction
                }}
            />
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, ephemeral post', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function

        global.window.mm_config = {};
        global.window.mm_config.EnableEmojiPicker = 'true';

        post.is_pinned = false;
        post.type = Constants.PostTypes.EPHEMERAL;

        const wrapper = shallow(
            <PostInfo
                post={post}
                handleCommentClick={emptyFunction}
                handleDropdownOpened={emptyFunction}
                compactDisplay={false}
                lastPostCount={0}
                replyCount={0}
                getPostList={emptyFunction}
                useMilitaryTime={false}
                isFlagged={true}
                actions={{
                    removePost: emptyFunction,
                    addReaction: emptyFunction
                }}
            />
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, ephemeral deleted post', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function

        global.window.mm_config = {};
        global.window.mm_config.EnableEmojiPicker = 'true';

        post.type = Constants.PostTypes.EPHEMERAL;
        post.state = Posts.POST_DELETED;

        const wrapper = shallow(
            <PostInfo
                post={post}
                handleCommentClick={emptyFunction}
                handleDropdownOpened={emptyFunction}
                compactDisplay={false}
                lastPostCount={0}
                replyCount={0}
                getPostList={emptyFunction}
                useMilitaryTime={false}
                isFlagged={true}
                actions={{
                    removePost: emptyFunction,
                    addReaction: emptyFunction
                }}
            />
        );
        expect(wrapper).toMatchSnapshot();
    });
});