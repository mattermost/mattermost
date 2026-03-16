// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import set from 'lodash/set';
import React from 'react';
import type {ComponentProps} from 'react';

import {setThreadFollow, updateThreadRead, markLastPostInThreadAsUnread} from 'mattermost-redux/actions/threads';

import {
    flagPost as savePost,
    unflagPost as unsavePost,
} from 'actions/post_actions';
import {manuallyMarkThreadAsUnread} from 'actions/views/threads';

import {fakeDate} from 'tests/helpers/date';
import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';
import {copyToClipboard} from 'utils/utils';

import type {GlobalState} from 'types/store';

import ThreadMenu from '../thread_menu';

jest.mock('mattermost-redux/actions/threads');
jest.mock('actions/views/threads');
jest.mock('actions/post_actions');
jest.mock('utils/utils');
jest.mock('hooks/useReadout', () => ({
    useReadout: () => jest.fn(),
}));
jest.mock('utils/popouts/popout_windows', () => ({
    canPopout: jest.fn(() => true),
    isThreadPopoutWindow: jest.fn(() => false),
    popoutThread: jest.fn(),
}));

const mockRouting = {
    params: {
        team: 'team-name-1',
    },
    currentUserId: 'uid',
    currentTeamId: 'tid',
    goToInChannel: jest.fn(),
};
jest.mock('../../hooks', () => {
    return {
        useThreadRouting: () => mockRouting,
    };
});

const mockDispatch = jest.fn();
let mockState: GlobalState;

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux') as typeof import('react-redux'),
    useSelector: (selector: (state: typeof mockState) => unknown) => selector(mockState),
    useDispatch: () => mockDispatch,
}));

describe('components/threading/common/thread_menu', () => {
    let props: ComponentProps<typeof ThreadMenu>;
    const threadId = '1y8hpek81byspd4enyk9mp1ncw';
    const channelId = 'channel-id-123';

    beforeEach(() => {
        props = {
            threadId,
            unreadTimestamp: 1610486901110,
            hasUnreads: false,
            isFollowing: false,
            children: (
                <button>{'test'}</button>
            ),
        };

        const post = TestHelper.getPostMock({
            id: threadId,
            channel_id: channelId,
        });
        const channel = TestHelper.getChannelMock({
            id: channelId,
        });

        mockState = {
            entities: {
                preferences: {
                    myPreferences: {},
                },
                posts: {
                    posts: {
                        [threadId]: post,
                    },
                },
                channels: {
                    channels: {
                        [channelId]: channel,
                    },
                },
            },
            views: {
                browser: {
                    windowSize: '',
                },
            },
        } as unknown as GlobalState;

        mockDispatch.mockClear();
        mockRouting.goToInChannel.mockClear();
    });

    test('should match snapshot', () => {
        const {baseElement} = renderWithContext(
            <ThreadMenu
                {...props}
            />,
        );
        expect(baseElement).toMatchSnapshot();
    });

    test('should match snapshot after opening', async () => {
        const {baseElement} = renderWithContext(
            <ThreadMenu
                {...props}
            />,
        );
        await userEvent.click(screen.getByText('test'));
        expect(baseElement).toMatchSnapshot();
    });

    test('should allow following', async () => {
        renderWithContext(
            <ThreadMenu
                {...props}
                isFollowing={false}
            />,
        );
        await userEvent.click(screen.getByText('test'));
        await userEvent.click(screen.getByText('Follow thread'));
        expect(setThreadFollow).toHaveBeenCalledWith('uid', 'tid', '1y8hpek81byspd4enyk9mp1ncw', true);
        expect(mockDispatch).toHaveBeenCalledTimes(1);
    });

    test('should allow unfollowing', async () => {
        renderWithContext(
            <ThreadMenu
                {...props}
                isFollowing={true}
            />,
        );
        await userEvent.click(screen.getByText('test'));
        await userEvent.click(screen.getByText('Unfollow thread'));
        expect(setThreadFollow).toHaveBeenCalledWith('uid', 'tid', '1y8hpek81byspd4enyk9mp1ncw', false);
        expect(mockDispatch).toHaveBeenCalledTimes(1);
    });

    test('should allow opening in channel', async () => {
        renderWithContext(
            <ThreadMenu
                {...props}
            />,
        );
        await userEvent.click(screen.getByText('test'));
        await userEvent.click(screen.getByText('Open in channel'));
        expect(mockRouting.goToInChannel).toHaveBeenCalledWith('1y8hpek81byspd4enyk9mp1ncw');
        expect(mockDispatch).not.toHaveBeenCalled();
    });

    test('should allow marking as read', async () => {
        const resetFakeDate = fakeDate(new Date(1612582579566));
        renderWithContext(
            <ThreadMenu
                {...props}
                hasUnreads={true}
            />,
        );
        await userEvent.click(screen.getByText('test'));
        await userEvent.click(screen.getByText('Mark as read'));
        expect(markLastPostInThreadAsUnread).not.toHaveBeenCalled();
        expect(updateThreadRead).toHaveBeenCalledWith('uid', 'tid', '1y8hpek81byspd4enyk9mp1ncw', 1612582579566);
        expect(manuallyMarkThreadAsUnread).toHaveBeenCalledWith('1y8hpek81byspd4enyk9mp1ncw', 1612582579566);
        expect(mockDispatch).toHaveBeenCalledTimes(2);
        resetFakeDate();
    });

    test('should allow marking as unread', async () => {
        renderWithContext(
            <ThreadMenu
                {...props}
                hasUnreads={false}
            />,
        );
        await userEvent.click(screen.getByText('test'));
        await userEvent.click(screen.getByText('Mark as unread'));
        expect(updateThreadRead).not.toHaveBeenCalled();
        expect(markLastPostInThreadAsUnread).toHaveBeenCalledWith('uid', 'tid', '1y8hpek81byspd4enyk9mp1ncw');
        expect(manuallyMarkThreadAsUnread).toHaveBeenCalledWith('1y8hpek81byspd4enyk9mp1ncw', 1610486901110);
        expect(mockDispatch).toHaveBeenCalledTimes(2);
    });

    test('should allow saving', async () => {
        renderWithContext(
            <ThreadMenu
                {...props}
            />,
        );
        await userEvent.click(screen.getByText('test'));
        await userEvent.click(screen.getByText('Save'));
        expect(savePost).toHaveBeenCalledWith('1y8hpek81byspd4enyk9mp1ncw');
        expect(mockDispatch).toHaveBeenCalledTimes(1);
    });

    test('should allow unsaving', async () => {
        set(mockState, 'entities.preferences.myPreferences', {
            'flagged_post--1y8hpek81byspd4enyk9mp1ncw': {
                user_id: 'uid',
                category: 'flagged_post',
                name: '1y8hpek81byspd4enyk9mp1ncw',
                value: 'true',
            },
        });

        renderWithContext(
            <ThreadMenu
                {...props}
            />,
        );
        await userEvent.click(screen.getByText('test'));
        await userEvent.click(screen.getByText('Unsave'));
        expect(unsavePost).toHaveBeenCalledWith('1y8hpek81byspd4enyk9mp1ncw');
        expect(mockDispatch).toHaveBeenCalledTimes(1);
    });

    test('should allow link copying', async () => {
        renderWithContext(
            <ThreadMenu
                {...props}
            />,
        );
        await userEvent.click(screen.getByText('test'));
        await userEvent.click(screen.getByText('Copy link'));
        expect(copyToClipboard).toHaveBeenCalledWith('http://localhost:8065/team-name-1/pl/1y8hpek81byspd4enyk9mp1ncw');
        expect(mockDispatch).not.toHaveBeenCalled();
    });
});
