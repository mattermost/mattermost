// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import {Posts} from 'mattermost-redux/constants';

import PostMarkdown from 'components/post_markdown/post_markdown';
import Markdown from 'components/markdown';
import {TestHelper} from 'utils/test_helper';

import {Post, PostType} from '@mattermost/types/posts';

describe('components/PostMarkdown', () => {
    const baseProps = {
        imageProps: {},
        isRHS: false,
        message: 'message',
        post: TestHelper.getPostMock(),
        mentionKeys: [{key: 'a'}, {key: 'b'}, {key: 'c'}],
        channelId: 'channel-id',
        channel: TestHelper.getChannelMock(),
        currentTeam: TestHelper.getTeamMock(),
    };

    test('should not error when rendering without a post', () => {
        const props = {...baseProps};
        Reflect.deleteProperty(props, 'post');

        shallow(<PostMarkdown {...props}/>);
    });

    test('should render properly with an empty post', () => {
        const wrapper = shallow(<PostMarkdown {...baseProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should render properly with a post', () => {
        const props = {
            ...baseProps,
            message: 'See ~test',
            post: TestHelper.getPostMock({
                props: {
                    channel_mentions: {
                        test: {
                            display_name: 'Test',
                        },
                    },
                },
            }),
        };
        const wrapper = shallow(<PostMarkdown {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should render properly without highlight a post', () => {
        const props = {
            ...baseProps,
            message: 'No highlight',
            options: {
                mentionHighlight: false,
            },
            post: TestHelper.getPostMock(),
        };
        const wrapper = shallow(<PostMarkdown {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should render properly without group highlight on a post', () => {
        const props = {
            ...baseProps,
            message: 'No @group highlight',
            options: {},
            post: TestHelper.getPostMock({
                props: {
                    disable_group_highlight: true,
                },
            }),
        };
        const wrapper = shallow(<PostMarkdown {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should correctly pass postId down', () => {
        const props = {
            ...baseProps,
            post: TestHelper.getPostMock({
                id: 'post_id',
            }),
        };
        const wrapper = shallow(<PostMarkdown {...props}/>);
        expect(wrapper.find(Markdown).prop('postId')).toEqual(props.post.id);
        expect(wrapper).toMatchSnapshot();
    });

    test('should render header change properly', () => {
        const props = {
            ...baseProps,
            post: TestHelper.getPostMock({
                id: 'post_id',
                type: Posts.POST_TYPES.HEADER_CHANGE as PostType,
                props: {
                    username: 'user',
                    old_header: 'see ~test',
                    new_header: 'now ~test',
                    channel_mentions: {
                        test: {
                            display_name: 'Test',
                        },
                    },
                },
            }),
        };
        const wrapper = shallow(<PostMarkdown {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('plugin hooks can build upon other hook message updates', () => {
        const props = {
            ...baseProps,
            message: 'world',
            post: TestHelper.getPostMock({
                message: 'world',
                props: {
                    channel_mentions: {
                        test: {
                            display_name: 'Test',
                        },
                    },
                },
            }),
            pluginHooks: [
                {
                    hook: (post: Post, updatedMessage: string) => {
                        return 'hello ' + updatedMessage;
                    },
                },
                {
                    hook: (post: Post, updatedMessage: string) => {
                        return updatedMessage + '!';
                    },
                },
            ],
        };
        const wrapper = shallow(<PostMarkdown {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('plugin hooks can overwrite other hooks messages', () => {
        const props = {
            ...baseProps,
            message: 'world',
            post: TestHelper.getPostMock({
                message: 'world',
                props: {
                    channel_mentions: {
                        test: {
                            display_name: 'Test',
                        },
                    },
                },
            }),
            pluginHooks: [
                {
                    hook: (post: Post) => {
                        return 'hello ' + post.message;
                    },
                },
                {
                    hook: (post: Post) => {
                        return post.message + '!';
                    },
                },
            ],
        };
        const wrapper = shallow(<PostMarkdown {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });
});
