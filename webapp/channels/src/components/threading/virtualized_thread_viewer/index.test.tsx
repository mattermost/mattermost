// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {START_OF_NEW_MESSAGES, isDateLine} from 'mattermost-redux/utils/post_list';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import ThreadViewerVirtualized from './virtualized_thread_viewer';

import ConnectedThreadViewer from './index';

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
                    config: {CollapsedThreads: 'always_on'},
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
});
