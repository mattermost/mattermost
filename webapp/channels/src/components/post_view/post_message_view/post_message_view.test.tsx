// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Post, PostType} from '@mattermost/types/posts';
import {shallow} from 'enzyme';
import React from 'react';

import {Posts} from 'mattermost-redux/constants';
import {Theme} from 'mattermost-redux/selectors/entities/preferences';

import PostMessageView from 'components/post_view/post_message_view/post_message_view';

describe('components/post_view/PostAttachment', () => {
    const post = {
        id: 'post_id',
        message: 'post message',
    } as Post;

    const baseProps = {
        post,
        enableFormatting: true,
        options: {},
        compactDisplay: false,
        isRHS: false,
        isRHSOpen: false,
        isRHSExpanded: false,
        theme: {} as Theme,
        pluginPostTypes: {},
        currentRelativeTeamUrl: 'dummy_team_url',
    };

    test('should match snapshot', () => {
        const wrapper = shallow(<PostMessageView {...baseProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, on Show More', () => {
        const wrapper = shallow(<PostMessageView {...baseProps}/>);

        wrapper.setState({hasOverflow: true, collapse: true});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, on Show Less', () => {
        const wrapper = shallow(<PostMessageView {...baseProps}/>);

        wrapper.setState({hasOverflow: true, collapse: false});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, on deleted post', () => {
        const props = {...baseProps, post: {...post, state: Posts.POST_DELETED as 'DELETED'}};
        const wrapper = shallow(<PostMessageView {...props}/>);
        const instance = wrapper.instance() as PostMessageView;

        expect(wrapper).toMatchSnapshot();
        expect(instance.renderDeletedPost()).toMatchSnapshot();
    });

    test('should match snapshot, on edited post', () => {
        const props = {...baseProps, post: {...post, edit_at: 1}};
        const wrapper = shallow(<PostMessageView {...props}/>);

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, on ephemeral post', () => {
        const props = {...baseProps, post: {...post, type: Posts.POST_TYPES.EPHEMERAL as PostType}};
        const wrapper = shallow(<PostMessageView {...props}/>);

        expect(wrapper).toMatchSnapshot();
    });

    test('should match checkOverflow state on handleHeightReceived change', () => {
        const wrapper = shallow(<PostMessageView {...baseProps}/>);
        const instance = wrapper.instance() as PostMessageView;

        wrapper.setState({checkOverflow: 0});
        instance.handleHeightReceived(1);
        expect(wrapper.state('checkOverflow')).toEqual(1);

        instance.handleHeightReceived(0);
        expect(wrapper.state('checkOverflow')).toEqual(1);
    });
});
