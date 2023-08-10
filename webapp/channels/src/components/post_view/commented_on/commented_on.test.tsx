// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import CommentedOn from 'components/post_view/commented_on/commented_on';
import CommentedOnFilesMessage from 'components/post_view/commented_on_files_message';

import type {Post} from '@mattermost/types/posts';

describe('components/post_view/CommentedOn', () => {
    const baseProps = {
        displayName: 'user_displayName',
        enablePostUsernameOverride: false,
        onCommentClick: jest.fn(),
        post: {
            id: 'post_id',
            message: 'text message',
            props: {
                from_webhook: 'true',
                override_username: 'override_username',
            },
            create_at: 0,
            update_at: 10,
            edit_at: 20,
            delete_at: 30,
            is_pinned: false,
            user_id: 'user_id',
            channel_id: 'channel_id',
            root_id: 'root_id',
            original_id: 'original_id',
            type: 'system_add_remove',
            hashtags: 'hashtags',
            pending_post_id: 'pending_post_id',
            reply_count: 1,
            metadata: {
                embeds: [],
                emojis: [],
                files: [],
                images: {},
                reactions: [],
            },
        } as Post,
    };

    test('should match snapshot', () => {
        const wrapper = shallow(<CommentedOn {...baseProps}/>);
        expect(wrapper).toMatchSnapshot();

        wrapper.setProps({enablePostUsernameOverride: true});
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find(CommentedOnFilesMessage).exists()).toBe(false);

        const newPost = {
            id: 'post_id',
            message: '',
            file_ids: ['file_id_1', 'file_id_2'],
        };
        wrapper.setProps({post: newPost, enablePostUsernameOverride: false});
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find(CommentedOnFilesMessage).exists()).toBe(true);
    });

    test('should match snapshots for post with props.pretext as message', () => {
        const newPost = {
            id: 'post_id',
            message: '',
            props: {
                from_webhook: 'true',
                override_username: 'override_username',
                attachments: [{
                    pretext: 'This is a pretext',
                }],
            },
        };
        const newProps = {
            ...baseProps,
            post: {
                ...baseProps.post,
                ...newPost,
            },
            enablePostUsernameOverride: true,
        };

        const wrapper = shallow(<CommentedOn {...newProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshots for post with props.title as message', () => {
        const newPost = {
            id: 'post_id',
            message: '',
            props: {
                from_webhook: 'true',
                override_username: 'override_username',
                attachments: [{
                    pretext: '',
                    title: 'This is a title',
                }],
            },
        };
        const newProps = {
            ...baseProps,
            post: {
                ...baseProps.post,
                ...newPost,
            },
            enablePostUsernameOverride: true,
        };

        const wrapper = shallow(<CommentedOn {...newProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshots for post with props.text as message', () => {
        const newPost = {
            id: 'post_id',
            message: '',
            props: {
                from_webhook: 'true',
                override_username: 'override_username',
                attachments: [{
                    pretext: '',
                    title: '',
                    text: 'This is a text',
                }],
            },
        };

        const newProps = {
            ...baseProps,
            post: {
                ...baseProps.post,
                ...newPost,
            },
            enablePostUsernameOverride: true,
        };

        const wrapper = shallow(<CommentedOn {...newProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshots for post with props.fallback as message', () => {
        const newPost = {
            id: 'post_id',
            message: '',
            props: {
                from_webhook: 'true',
                override_username: 'override_username',
                attachments: [{
                    pretext: '',
                    title: '',
                    text: '',
                    fallback: 'This is fallback message',
                }],
            },
        };

        const newProps = {
            ...baseProps,
            post: {
                ...baseProps.post,
                ...newPost,
            },
            enablePostUsernameOverride: true,
        };

        const wrapper = shallow(<CommentedOn {...newProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should call onCommentClick on click of text message', () => {
        const wrapper = shallow(<CommentedOn {...baseProps}/>);

        wrapper.find('a').first().simulate('click');
        expect(baseProps.onCommentClick).toHaveBeenCalledTimes(1);
    });

    test('Should trigger search with override_username', () => {
        const wrapper = shallow(<CommentedOn {...baseProps}/>);
        wrapper.setProps({enablePostUsernameOverride: true});
    });
});
