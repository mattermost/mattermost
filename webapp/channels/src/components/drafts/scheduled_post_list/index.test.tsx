// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createMemoryHistory} from 'history';
import React from 'react';
import {VariableSizeList} from 'react-window';

import type {ScheduledPost, ScheduledPostErrorCode} from '@mattermost/types/schedule_post';

import {fetchMissingChannels} from 'mattermost-redux/actions/channels';

import {act, renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import {isUserInitiatedScroll} from './virtualized_scheduled_post_list';

import ScheduledPostList from './index';

jest.mock('mattermost-redux/actions/channels', () => ({
    fetchMissingChannels: jest.fn(() => ({type: 'MOCK_FETCH_MISSING_CHANNELS'})),
}));

jest.mock('components/drafts/draft_row', () => {
    return function MockDraftRow(props: {item: ScheduledPost; highlight?: boolean}) {
        return (
            <div
                data-testid='scheduled-post-row'
                data-highlight={props.highlight ? 'true' : 'false'}
            >
                {props.item.message}
            </div>
        );
    };
});

const mockedFetchMissingChannels = jest.mocked(fetchMissingChannels);

type ScheduledPostOverrides = {
    rootId?: string;
    errorCode?: ScheduledPostErrorCode;
};

function makeScheduledPost(id: string, message: string, channelId: string, overrides: ScheduledPostOverrides = {}): ScheduledPost {
    return {
        id,
        message,
        channel_id: channelId,
        root_id: overrides.rootId ?? '',
        user_id: 'user1',
        create_at: 1700000000000,
        update_at: 1700000000000,
        scheduled_at: 1800000000000,
        error_code: overrides.errorCode,
        props: {},
    };
}

const teamId = 'team1';

function baseState(errorIds: string[] = []) {
    return {
        entities: {
            teams: {
                currentTeamId: teamId,
            },
            scheduledPosts: {
                errorsByTeamId: {
                    [teamId]: errorIds,
                },
            },
        },
    };
}

describe('components/drafts/scheduled_post_list', () => {
    const currentUser = TestHelper.getUserMock({id: 'user1'});

    // The list renders through real react-window virtualization. The global jest
    // setup mocks AutoSizer to a fixed 100x100 viewport, so with the ~91px
    // estimated row height only a small window of rows renders at a time.
    const renderList = (scheduledPosts: ScheduledPost[], errorIds: string[] = [], search = '') => {
        return renderWithContext(
            <ScheduledPostList
                scheduledPosts={scheduledPosts}
                currentUser={currentUser}
                userDisplayName='User One'
                userStatus='online'
            />,
            baseState(errorIds),
            {history: createMemoryHistory({initialEntries: [`/team1/scheduled_posts${search}`]})},
        );
    };

    beforeEach(() => {
        mockedFetchMissingChannels.mockClear();
    });

    test('renders the empty state and fetches nothing when there are no scheduled posts', () => {
        renderList([]);

        expect(screen.getByText('No scheduled drafts at the moment')).toBeInTheDocument();
        expect(screen.queryByTestId('scheduled-post-row')).not.toBeInTheDocument();
        expect(mockedFetchMissingChannels).not.toHaveBeenCalled();
    });

    test('renders the scheduled posts that are provided and fetches their channels', () => {
        renderList([
            makeScheduledPost('sp1', 'First scheduled message', 'channel1'),
            makeScheduledPost('sp2', 'Second scheduled message', 'channel2'),
        ]);

        expect(screen.getByText('First scheduled message')).toBeInTheDocument();
        expect(screen.getByText('Second scheduled message')).toBeInTheDocument();
        expect(mockedFetchMissingChannels).toHaveBeenCalledWith(['channel1', 'channel2']);
    });

    test('shows the error banner when the team has scheduled-post errors', () => {
        renderList(
            [makeScheduledPost('sp1', 'First scheduled message', 'channel1')],
            ['sp1'],
        );

        expect(screen.getByText('One of your scheduled drafts cannot be sent.')).toBeInTheDocument();
    });

    test('does not show the error banner when there are no errors', () => {
        renderList([makeScheduledPost('sp1', 'First scheduled message', 'channel1')]);

        expect(screen.queryByText('One of your scheduled drafts cannot be sent.')).not.toBeInTheDocument();
    });

    test('virtualizes a long list, scrolling to the target_id channel post far down the list', () => {
        const posts: ScheduledPost[] = [];
        for (let i = 0; i < 40; i++) {
            posts.push(makeScheduledPost(`sp${i}`, `Scheduled message ${i}`, 'channel1'));
        }

        // The target lives in its own channel roughly in the middle of the list.
        const targetChannelId = 'target_channel';
        posts[30] = makeScheduledPost('target', 'Target scheduled message', targetChannelId);

        renderList(posts, [], `?target_id=${targetChannelId}`);

        // The target row is rendered (the list scrolled to it) and highlighted.
        const targetRow = screen.getByText('Target scheduled message');
        expect(targetRow.closest('[data-testid="scheduled-post-row"]')).toHaveAttribute('data-highlight', 'true');

        // Virtualization: the rows at the very top of the list are not rendered
        // because the list scrolled down to the target.
        expect(screen.queryByText('Scheduled message 0')).not.toBeInTheDocument();

        // Only the visible window plus overscan (both directions around the
        // target) is rendered, not all rows.
        expect(screen.getAllByTestId('scheduled-post-row').length).toBeLessThan(posts.length);
    });

    test('keeps the target post highlighted across re-renders', () => {
        const targetChannelId = 'target_channel';
        const initialPosts = [
            makeScheduledPost('a', 'Post A', 'channel1'),
            makeScheduledPost('target', 'Sticky target post', targetChannelId),
            makeScheduledPost('b', 'Post B', 'channel1'),
        ];

        const {rerender} = renderList(initialPosts, [], `?target_id=${targetChannelId}`);

        const getTargetRow = () => screen.getByText('Sticky target post').closest('[data-testid="scheduled-post-row"]');
        expect(getTargetRow()).toHaveAttribute('data-highlight', 'true');

        // Re-render with an extra post. The resolved target id still points at
        // the same post, so it stays highlighted.
        rerender(
            <ScheduledPostList
                scheduledPosts={[...initialPosts, makeScheduledPost('c', 'Post C', 'channel1')]}
                currentUser={currentUser}
                userDisplayName='User One'
                userStatus='online'
            />,
        );

        expect(getTargetRow()).toHaveAttribute('data-highlight', 'true');
    });

    test('scrolls to a target_id that matches a thread root_id', () => {
        const posts: ScheduledPost[] = [];
        for (let i = 0; i < 40; i++) {
            posts.push(makeScheduledPost(`sp${i}`, `Scheduled message ${i}`, 'channel1'));
        }

        const targetRootId = 'target_root';
        posts[30] = makeScheduledPost('target', 'Target thread reply', 'channel1', {rootId: targetRootId});

        renderList(posts, [], `?target_id=${targetRootId}`);

        const targetRow = screen.getByText('Target thread reply');
        expect(targetRow.closest('[data-testid="scheduled-post-row"]')).toHaveAttribute('data-highlight', 'true');
        expect(screen.queryByText('Scheduled message 0')).not.toBeInTheDocument();
    });

    test('skips an errored post and scrolls to the next valid post in the target channel', () => {
        const targetChannelId = 'target_channel';
        const posts: ScheduledPost[] = [
            makeScheduledPost('errored', 'Errored target post', targetChannelId, {errorCode: 'channel_archived'}),
            makeScheduledPost('valid', 'Valid target post', targetChannelId),
            makeScheduledPost('other', 'Other channel post', 'channel1'),
        ];

        renderList(posts, ['errored'], `?target_id=${targetChannelId}`);

        const erroredRow = screen.getByText('Errored target post').closest('[data-testid="scheduled-post-row"]');
        const validRow = screen.getByText('Valid target post').closest('[data-testid="scheduled-post-row"]');

        expect(erroredRow).toHaveAttribute('data-highlight', 'false');
        expect(validRow).toHaveAttribute('data-highlight', 'true');
    });

    test('stays at the top and scrolls to nothing when the target_id matches no post', () => {
        const posts: ScheduledPost[] = [];
        for (let i = 0; i < 40; i++) {
            posts.push(makeScheduledPost(`sp${i}`, `Scheduled message ${i}`, 'channel1'));
        }

        renderList(posts, [], '?target_id=does_not_exist');

        // With no matching target the list stays at the top.
        expect(screen.getByText('Scheduled message 0')).toBeInTheDocument();

        // Nothing is highlighted.
        const rows = screen.getAllByTestId('scheduled-post-row');
        rows.forEach((row) => expect(row).toHaveAttribute('data-highlight', 'false'));
    });

    test('re-centers on the target after rows are measured taller than the estimate', async () => {
        // Real row heights differ from the ~91px estimate used for the first
        // scroll, which previously left the list a row off from the target.
        // Report a taller height so the post-measurement re-center is exercised.
        const rectSpy = jest.spyOn(Element.prototype, 'getBoundingClientRect').
            mockReturnValue({height: 200, width: 100, top: 0, left: 0, bottom: 200, right: 100, x: 0, y: 0, toJSON: () => ({})} as DOMRect);
        const scrollToItemSpy = jest.spyOn(VariableSizeList.prototype, 'scrollToItem');

        try {
            const posts: ScheduledPost[] = [];
            for (let i = 0; i < 40; i++) {
                posts.push(makeScheduledPost(`sp${i}`, `Scheduled message ${i}`, 'channel1'));
            }
            const targetChannelId = 'target_channel';
            posts[30] = makeScheduledPost('target', 'Target scheduled message', targetChannelId);

            renderList(posts, [], `?target_id=${targetChannelId}`);

            const callsAfterMount = scrollToItemSpy.mock.calls.length;
            expect(scrollToItemSpy).toHaveBeenCalledWith(30, 'center');

            // Let the requestAnimationFrame measurement callbacks run.
            await act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 50));
            });

            // The target is re-centered once nearby rows report their real height.
            expect(scrollToItemSpy.mock.calls.length).toBeGreaterThan(callsAfterMount);
            expect(scrollToItemSpy).toHaveBeenLastCalledWith(30, 'center');
        } finally {
            rectSpy.mockRestore();
            scrollToItemSpy.mockRestore();
        }
    });
});

describe('isUserInitiatedScroll', () => {
    test('ignores scrolls that react-window itself requested', () => {
        expect(isUserInitiatedScroll(true, 1000, 200)).toBe(false);
    });

    test('ignores scrolls seen before we have requested anything', () => {
        // Mount fires onScroll for the initial offset (and its echo) before the
        // first programmatic scroll; there is no target to be yanked away from.
        expect(isUserInitiatedScroll(false, 1000, null)).toBe(false);
    });

    test('ignores the sub-pixel echo of a scroll we requested', () => {
        // The browser reports back a fractional scrollTop on HiDPI displays, so
        // the echo offset is within a pixel of what we asked for.
        expect(isUserInitiatedScroll(false, 1000.5, 1000)).toBe(false);
        expect(isUserInitiatedScroll(false, 997, 1000)).toBe(false);
    });

    test('treats a real user scroll away from the requested offset as user-initiated', () => {
        expect(isUserInitiatedScroll(false, 1300, 1000)).toBe(true);
    });
});
