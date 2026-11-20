// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {CollapsedThreads} from '@mattermost/types/config';
import type {DeepPartial} from '@mattermost/types/utilities';

import {Posts} from 'mattermost-redux/constants';
import {COMBINED_USER_ACTIVITY, DATE_LINE, START_OF_NEW_MESSAGES, isDateLine} from 'mattermost-redux/utils/post_list';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import ThreadViewerVirtualized from './virtualized_thread_viewer';

import ConnectedThreadViewer, {withoutRoot} from './index';

jest.mock('./virtualized_thread_viewer', () => ({
    __esModule: true,
    default: jest.fn(() => null),
}));

const Viewer = ThreadViewerVirtualized as unknown as jest.Mock;

describe('virtualized thread viewer connector', () => {
    const currentUser = TestHelper.getUserMock({id: 'current-user'});
    const otherUser = TestHelper.getUserMock({id: 'other-user'});
    const channel = TestHelper.getChannelMock({id: 'channel-id'});

    beforeEach(() => {
        Viewer.mockClear();
    });

    function renderViewer(hideRoot: boolean, useRelativeTimestamp: boolean, rootAt: number, replyAt: number) {
        const root = TestHelper.getPostMock({
            id: 'root-id',
            channel_id: channel.id,
            user_id: currentUser.id,
            create_at: rootAt,
            type: '',
        });
        const reply = TestHelper.getPostMock({
            id: 'reply-id',
            channel_id: channel.id,
            user_id: otherUser.id,
            root_id: root.id,
            create_at: replyAt,
            type: '',
        });

        const state: DeepPartial<GlobalState> = {
            entities: {
                general: {
                    config: {CollapsedThreads: CollapsedThreads.ALWAYS_ON},
                },
                users: {
                    currentUserId: currentUser.id,
                    profiles: {
                        [currentUser.id]: currentUser,
                        [otherUser.id]: otherUser,
                    },
                },
                channels: {
                    channels: {[channel.id]: channel},
                },
                posts: {
                    posts: {
                        [root.id]: root,
                        [reply.id]: reply,
                    },
                },
            },
            views: {
                threads: {
                    lastViewedAt: {[root.id]: rootAt + 1},
                },
            },
        };

        renderWithContext(
            <ConnectedThreadViewer
                channelId={channel.id}
                postIds={[reply.id, root.id]}
                selected={root}
                useRelativeTimestamp={useRelativeTimestamp}
                onCardClick={() => {}}
                hideRoot={hideRoot}
                isThreadView={false}
            />,
            state,
        );

        return Viewer.mock.calls[0][0].replyListIds as string[];
    }

    it('keeps the new-messages line on the first unread reply when the root is hidden', () => {
        const ids = renderViewer(true, true, 1_000, 3_000);

        expect(ids).toEqual(['reply-id', START_OF_NEW_MESSAGES]);
    });

    it('drops the date line that belonged only to the hidden root', () => {
        const rootAt = Date.UTC(2024, 0, 1);
        const replyAt = Date.UTC(2024, 1, 15);
        const ids = renderViewer(true, false, rootAt, replyAt);

        expect(ids).not.toContain('root-id');
        expect(ids).toContain(START_OF_NEW_MESSAGES);
        expect(ids.filter(isDateLine)).toHaveLength(1);
    });

    it('hides a join/leave root instead of leaving it inside a combined post', () => {
        const rootAt = 1_000;
        const replyAt = 2_000;
        const root = TestHelper.getPostMock({
            id: 'root-id',
            channel_id: channel.id,
            user_id: otherUser.id,
            create_at: rootAt,
            type: Posts.POST_TYPES.JOIN_CHANNEL,
        });
        const reply = TestHelper.getPostMock({
            id: 'reply-id',
            channel_id: channel.id,
            user_id: otherUser.id,
            root_id: root.id,
            create_at: replyAt,
            type: Posts.POST_TYPES.JOIN_CHANNEL,
        });

        const state: DeepPartial<GlobalState> = {
            entities: {
                general: {
                    config: {CollapsedThreads: CollapsedThreads.ALWAYS_ON},
                },
                users: {
                    currentUserId: currentUser.id,
                    profiles: {
                        [currentUser.id]: currentUser,
                        [otherUser.id]: otherUser,
                    },
                },
                channels: {
                    channels: {[channel.id]: channel},
                },
                posts: {
                    posts: {
                        [root.id]: root,
                        [reply.id]: reply,
                    },
                },
            },
            views: {
                threads: {
                    lastViewedAt: {[root.id]: replyAt + 1},
                },
            },
        };

        renderWithContext(
            <ConnectedThreadViewer
                channelId={channel.id}
                postIds={[reply.id, root.id]}
                selected={root}
                useRelativeTimestamp={true}
                onCardClick={() => {}}
                hideRoot={true}
                isThreadView={false}
            />,
            state,
        );

        const ids = Viewer.mock.calls[0][0].replyListIds as string[];
        expect(ids).toEqual([COMBINED_USER_ACTIVITY + reply.id]);
    });
});

describe('withoutRoot', () => {
    const monday = DATE_LINE + Date.UTC(2024, 0, 1);
    const tuesday = DATE_LINE + Date.UTC(2024, 1, 15);

    it('removes the root and keeps a date line that a reply still uses', () => {
        expect(withoutRoot(
            ['reply-2', 'reply-1', START_OF_NEW_MESSAGES, 'root-id', monday],
            'root-id',
        )).toEqual(['reply-2', 'reply-1', START_OF_NEW_MESSAGES, monday]);
    });

    it('drops the trailing date line that belonged only to the root', () => {
        expect(withoutRoot(
            ['reply-id', START_OF_NEW_MESSAGES, tuesday, 'root-id', monday],
            'root-id',
        )).toEqual(['reply-id', START_OF_NEW_MESSAGES, tuesday]);
    });

    it('returns an empty list when the thread is only the root', () => {
        expect(withoutRoot(['root-id', monday], 'root-id')).toEqual([]);
    });

    it('removes the root when timestamps are relative and there is no date line', () => {
        expect(withoutRoot(
            ['reply-id', START_OF_NEW_MESSAGES, 'root-id'],
            'root-id',
        )).toEqual(['reply-id', START_OF_NEW_MESSAGES]);
    });
});
