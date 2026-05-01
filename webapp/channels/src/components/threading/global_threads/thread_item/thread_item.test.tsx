// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';
import type {UserThread} from '@mattermost/types/threads';

import {markLastPostInThreadAsUnread, updateThreadRead} from 'mattermost-redux/actions/threads';

import {manuallyMarkThreadAsUnread} from 'actions/views/threads';

import {fireEvent, renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {WindowSizes} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';
import * as Utils from 'utils/utils';

import ThreadItem from './thread_item';

jest.mock('mattermost-redux/actions/threads');

jest.mock('actions/views/threads');

jest.mock('utils/constants', () => ({
    ...jest.requireActual('utils/constants'),
    RelativeRanges: {
        TODAY_TITLE_CASE: 'Today',
        TOMORROW_TITLE_CASE: 'Tomorrow',
        YESTERDAY_TITLE_CASE: 'Yesterday',
        LAST_WEEK_TITLE_CASE: 'Last Week',
        LAST_MONTH_TITLE_CASE: 'Last Month',
        LAST_YEAR_TITLE_CASE: 'Last Year',
    },
    Integrations: {
        EXECUTE_CURRENT_COMMAND_ITEM_ID: 'execute_current_command',
        OPEN_COMMAND_IN_MODAL_ITEM_ID: 'open_command_in_modal',
    },
}));

jest.mock('components/markdown', () => {
    return function MockMarkdown({message}: {message: string}) {
        if (message.includes('[link]')) {
            return <a href='https://example.com'>{'link'}</a>;
        }
        return <span>{message}</span>;
    };
});

jest.mock('components/post_markdown', () => ({
    makeGetMentionKeysForPost: () => () => [],
}));

jest.mock('components/timestamp', () => {
    return function MockTimestamp() {
        return <span>{'timestamp'}</span>;
    };
});

jest.mock('components/widgets/users/avatars', () => {
    return function MockAvatars() {
        return <div className='avatars'>{'avatars'}</div>;
    };
});

jest.mock('./attachments', () => {
    return function MockAttachment() {
        return <div className='attachment'>{'attachment'}</div>;
    };
});

let capturedThreadMenuProps: any = {};
jest.mock('../thread_menu', () => {
    return function MockThreadMenu(props: any) {
        capturedThreadMenuProps = props;
        return <div className='thread-menu'>{props.children}</div>;
    };
});

const mockRouting = {
    currentUserId: '7n4ach3i53bbmj84dfmu5b7c1c',
    currentTeamId: 'tid',
    goToInChannel: jest.fn(),
    select: jest.fn(),
};
jest.mock('../../hooks', () => {
    return {
        useThreadRouting: () => mockRouting,
    };
});

const mockDispatch = jest.fn();
let mockThread: UserThread;
let mockPost: Post;
let mockChannel: Channel;
let mockState: any;

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux') as typeof import('react-redux'),
    useSelector: (selector: (state: typeof mockState) => unknown) => selector(mockState),
    useDispatch: () => mockDispatch,
}));

describe('components/threading/global_threads/thread_item', () => {
    let props: ComponentProps<typeof ThreadItem>;

    beforeEach(() => {
        mockThread = {
            id: '1y8hpek81byspd4enyk9mp1ncw',
            reply_count: 0,
            unread_replies: 0,
            unread_mentions: 0,
            is_following: true,
            participants: [
                {
                    id: '7n4ach3i53bbmj84dfmu5b7c1c',
                    username: 'frodo.baggins',
                    first_name: 'Frodo',
                    last_name: 'Baggins',
                },
                {
                    id: 'ij61jet1bbdk8fhhxitywdj4ih',
                    username: 'samwise.gamgee',
                    first_name: 'Samwise',
                    last_name: 'Gamgee',
                },
            ],
            post: {
                user_id: 'mt5td9mdriyapmwuh5pc84dmhr',
                channel_id: 'pnzsh7kwt7rmzgj8yb479sc9yw',
            },
        } as UserThread;

        mockPost = {
            id: '1y8hpek81byspd4enyk9mp1ncw',
            user_id: 'mt5td9mdriyapmwuh5pc84dmhr',
            channel_id: 'pnzsh7kwt7rmzgj8yb479sc9yw',
            message: 'test msg',
            create_at: 1610486901110,
            edit_at: 1611786714912,
        } as Post;
        const user = TestHelper.getUserMock();

        mockChannel = {
            id: 'pnzsh7kwt7rmzgj8yb479sc9yw',
            name: 'test-team',
            display_name: 'Team name',
        } as Channel;
        mockState = {
            entities: {
                users: {
                    currentUserId: user.id,
                    profiles: {
                        [user.id]: user,
                    },
                },
                groups: {
                    groups: {},
                    myGroups: [],
                },
                teams: {
                    teams: {
                        currentTeamId: 'tid',
                    },
                    groupsAssociatedToTeam: {
                        tid: {},
                    },
                },
                channels: {
                    channels: [mockChannel],
                    groupsAssociatedToChannel: {
                        [mockChannel.id]: {},
                    },
                },
                preferences: {
                    myPreferences: {},
                },
            },
            views: {
                browser: {
                    windowSize: WindowSizes.DESKTOP_VIEW,
                },
            },
        };

        props = {
            isFirstThreadInList: false,
            channel: mockChannel,
            currentRelativeTeamUrl: '/tname',
            displayName: 'Someone',
            isSelected: false,
            post: mockPost,
            postsInThread: [],
            thread: mockThread,
            threadId: mockThread.id,
            isPostPriorityEnabled: false,
        };

        capturedThreadMenuProps = {};
        mockDispatch.mockClear();
        mockRouting.select.mockClear();
        mockRouting.goToInChannel.mockClear();
    });

    test('should report total number of replies', () => {
        mockThread.reply_count = 9;
        const {baseElement} = renderWithContext(<ThreadItem {...props}/>);
        expect(baseElement).toMatchSnapshot();
        expect(screen.getByText('9 replies')).toBeInTheDocument();
    });

    test('should report unread messages', () => {
        mockThread.reply_count = 11;
        mockThread.unread_replies = 2;

        const {baseElement, container} = renderWithContext(<ThreadItem {...props}/>);
        expect(baseElement).toMatchSnapshot();
        expect(container.querySelector('.dot-unreads')).toBeInTheDocument();
        expect(screen.getByText('2 new replies')).toBeInTheDocument();
    });

    test('should report unread mentions', () => {
        mockThread.reply_count = 16;
        mockThread.unread_replies = 5;
        mockThread.unread_mentions = 2;

        const {baseElement, container} = renderWithContext(<ThreadItem {...props}/>);
        expect(baseElement).toMatchSnapshot();
        expect(container.querySelector('.dot-mentions')?.textContent).toBe('2');
        expect(screen.getByText('5 new replies')).toBeInTheDocument();
    });

    test('should show channel name', () => {
        renderWithContext(<ThreadItem {...props}/>);
        expect(screen.getByText('Team name')).toBeInTheDocument();
    });

    test('should pass required props to ThreadMenu', () => {
        renderWithContext(<ThreadItem {...props}/>);

        expect(capturedThreadMenuProps).toHaveProperty('hasUnreads', Boolean(mockThread.unread_replies));
        expect(capturedThreadMenuProps).toHaveProperty('threadId', mockThread.id);
        expect(capturedThreadMenuProps).toHaveProperty('isFollowing', mockThread.is_following);
        expect(capturedThreadMenuProps).toHaveProperty('unreadTimestamp', 1611786714912);
    });

    test('should call Utils.handleFormattedTextClick on click', async () => {
        const {container} = renderWithContext(<ThreadItem {...props}/>);
        const spy = jest.spyOn(Utils, 'handleFormattedTextClick').mockImplementationOnce(jest.fn());
        await userEvent.click(container.querySelector('.preview')!);

        expect(spy).toHaveBeenCalledWith(expect.anything(), '/tname');
    });

    test('should allow marking as unread on alt + click', () => {
        const {container} = renderWithContext(<ThreadItem {...props}/>);
        fireEvent.click(container.querySelector('div.ThreadItem')!, {altKey: true});
        expect(updateThreadRead).not.toHaveBeenCalled();
        expect(markLastPostInThreadAsUnread).toHaveBeenCalledWith('user_id', 'tid', '1y8hpek81byspd4enyk9mp1ncw');
        expect(manuallyMarkThreadAsUnread).toHaveBeenCalledWith('1y8hpek81byspd4enyk9mp1ncw', 1611786714912);
        expect(mockDispatch).toHaveBeenCalledTimes(2);
    });

    test('should set article tabIndex to -1 when thread is selected', () => {
        const {container} = renderWithContext(
            <ThreadItem
                {...props}
                isSelected={true}
            />,
        );
        expect(container.querySelector('div.ThreadItem')?.getAttribute('tabindex')).toBe('-1');
    });

    test('should set article tabIndex to 0 when thread is not selected', () => {
        const {container} = renderWithContext(
            <ThreadItem
                {...props}
                isSelected={false}
            />,
        );
        expect(container.querySelector('div.ThreadItem')?.getAttribute('tabindex')).toBe('0');
    });
});
