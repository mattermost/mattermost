// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';
import type {UserThread} from '@mattermost/types/threads';

import {fakeDate} from 'tests/helpers/date';
import {TestHelper} from 'utils/test_helper';

import type {FakePost} from 'types/store/rhs';

import ThreadViewer from './thread_viewer';
import type {Props} from './thread_viewer';

describe('components/threading/ThreadViewer', () => {
    const post: Post = TestHelper.getPostMock({
        channel_id: 'channel_id',
        create_at: 1502715365009,
        update_at: 1502715372443,
        is_following: true,
        reply_count: 3,
    });

    const fakePost: FakePost = {
        id: post.id,
        exists: true,
        type: post.type,
        user_id: post.user_id,
        channel_id: post.channel_id,
        message: post.message,
        reply_count: 3,
    };

    const channel: Channel = TestHelper.getChannelMock({
        display_name: '',
        name: '',
        header: '',
        purpose: '',
        creator_id: '',
        scheme_id: '',
        teammate_id: '',
        status: '',
    });

    const actions = {
        removePost: jest.fn(),
        selectPostCard: jest.fn(),
        getNewestPostThread: jest.fn(),
        getPostThread: jest.fn(),
        getThread: jest.fn(),
        updateThreadRead: jest.fn(),
        updateThreadLastOpened: jest.fn(),
        fetchRHSAppsBindings: jest.fn(),
    };

    const baseProps: Props = {
        selected: post,
        channel,
        currentUserId: 'user_id',
        currentTeamId: 'team_id',
        socketConnectionStatus: true,
        actions,
        isCollapsedThreadsEnabled: false,
        postIds: [post.id],
        appsEnabled: true,
        rootPostId: post.id,
        isThreadView: true,
        enableWebSocketEventScope: false,
    };

    test('should match snapshot', async () => {
        const reset = fakeDate(new Date(1502715365000));

        const wrapper = shallow(
            <ThreadViewer {...baseProps}/>,
        );

        await new Promise((resolve) => setTimeout(resolve));
        expect(wrapper).toMatchSnapshot();
        reset();
    });

    test('should make api call to get thread posts on socket reconnect', () => {
        const wrapper = shallow(
            <ThreadViewer {...baseProps}/>,
        );

        wrapper.setProps({socketConnectionStatus: false});
        wrapper.setProps({socketConnectionStatus: true});

        return expect(actions.getPostThread).toHaveBeenCalledWith(post.id, true);
    });

    test('should not break if root post is a fake post', () => {
        const props = {
            ...baseProps,
            selected: fakePost,
        };

        expect(() => {
            shallow(<ThreadViewer {...props}/>);
        }).not.toThrowError("Cannot read property 'reply_count' of undefined");
    });

    test('should not break if root post is ID only', () => {
        const props = {
            ...baseProps,
            rootPostId: post.id,
            selected: undefined,
        };

        expect(() => {
            shallow(<ThreadViewer {...props}/>);
        }).not.toThrowError("Cannot read property 'reply_count' of undefined");
    });

    test('should call fetchThread when no thread on mount', (done) => {
        const {actions} = baseProps;

        shallow(
            <ThreadViewer
                {...baseProps}
                isCollapsedThreadsEnabled={true}
            />,
        );

        expect.assertions(3);

        process.nextTick(() => {
            expect(actions.updateThreadLastOpened).not.toHaveBeenCalled();
            expect(actions.updateThreadRead).not.toHaveBeenCalled();
            expect(actions.getThread).toHaveBeenCalledWith('user_id', 'team_id', 'id', true);
            done();
        });
    });

    test('should call updateThreadLastOpened on mount', () => {
        jest.useFakeTimers().setSystemTime(400);
        const {actions} = baseProps;
        const userThread = {
            id: 'id',
            last_viewed_at: 42,
            last_reply_at: 32,
        } as UserThread;

        shallow(
            <ThreadViewer
                {...baseProps}
                userThread={userThread}
                isCollapsedThreadsEnabled={true}
            />,
        );

        expect.assertions(3);
        expect(actions.updateThreadLastOpened).toHaveBeenCalledWith('id', 42);
        expect(actions.updateThreadRead).not.toHaveBeenCalled();
        expect(actions.getThread).not.toHaveBeenCalled();
    });

    test('should call updateThreadLastOpened and updateThreadRead on mount when unread replies', () => {
        jest.useFakeTimers().setSystemTime(400);
        const {actions} = baseProps;
        const userThread = {
            id: 'id',
            last_viewed_at: 42,
            last_reply_at: 142,
        } as UserThread;

        shallow(
            <ThreadViewer
                {...baseProps}
                userThread={userThread}
                isCollapsedThreadsEnabled={true}
            />,
        );

        expect.assertions(3);
        expect(actions.updateThreadLastOpened).toHaveBeenCalledWith('id', 42);
        expect(actions.updateThreadRead).toHaveBeenCalledWith('user_id', 'team_id', 'id', 400);
        expect(actions.getThread).not.toHaveBeenCalled();
    });

    test('should call updateThreadLastOpened and updateThreadRead upon thread id change', (done) => {
        jest.useRealTimers();
        const dateNowOrig = Date.now;
        Date.now = () => new Date(400).getMilliseconds();
        const {actions} = baseProps;

        const userThread = {
            id: 'id',
            last_viewed_at: 42,
            last_reply_at: 142,
        } as UserThread;

        const wrapper = shallow(
            <ThreadViewer
                {...baseProps}
                isCollapsedThreadsEnabled={true}
            />,
        );

        expect.assertions(6);
        process.nextTick(() => {
            expect(actions.updateThreadLastOpened).not.toHaveBeenCalled();
            expect(actions.updateThreadRead).not.toHaveBeenCalled();
            expect(actions.getThread).toHaveBeenCalled();

            jest.resetAllMocks();
            wrapper.setProps({userThread});

            expect(actions.updateThreadLastOpened).toHaveBeenCalledWith('id', 42);
            expect(actions.updateThreadRead).toHaveBeenCalledWith('user_id', 'team_id', 'id', 400);
            expect(actions.getThread).not.toHaveBeenCalled();
            Date.now = dateNowOrig;
            done();
        });
    });

    test('should call fetchRHSAppsBindings on mount if appsEnabled', () => {
        const {actions} = baseProps;

        shallow(
            <ThreadViewer
                {...baseProps}
            />,
        );

        expect(actions.fetchRHSAppsBindings).toHaveBeenCalledWith('channel_id', 'id');
    });

    test('should not call fetchRHSAppsBindings on mount if not appsEnabled', () => {
        const {actions} = baseProps;

        shallow(
            <ThreadViewer
                {...baseProps}
                appsEnabled={false}
            />,
        );

        expect(actions.fetchRHSAppsBindings).not.toHaveBeenCalledWith('channel_id', 'id');
    });
});
