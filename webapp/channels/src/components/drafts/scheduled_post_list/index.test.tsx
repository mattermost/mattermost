// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createMemoryHistory} from 'history';
import React from 'react';

import type {ScheduledPost, ScheduledPostErrorCode} from '@mattermost/types/schedule_post';

import {fetchMissingChannels} from 'mattermost-redux/actions/channels';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ScheduledPostList from './index';

jest.mock('mattermost-redux/actions/channels', () => ({
    fetchMissingChannels: jest.fn(() => ({type: 'MOCK_FETCH_MISSING_CHANNELS'})),
}));

jest.mock('components/drafts/draft_row', () => {
    return function MockDraftRow(props: {item: ScheduledPost; scrollIntoView?: boolean}) {
        return (
            <div
                data-testid='scheduled-post-row'
                data-scroll-into-view={props.scrollIntoView ? 'true' : 'false'}
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

        // The target row is rendered (the list scrolled to it) and flagged to scroll into view.
        const targetRow = screen.getByText('Target scheduled message');
        expect(targetRow.closest('[data-testid="scheduled-post-row"]')).toHaveAttribute('data-scroll-into-view', 'true');

        // Virtualization: the rows at the very top of the list are not rendered
        // because the list scrolled down to the target.
        expect(screen.queryByText('Scheduled message 0')).not.toBeInTheDocument();

        // Only the visible window plus overscan (both directions around the
        // target) is rendered, not all rows.
        expect(screen.getAllByTestId('scheduled-post-row').length).toBeLessThan(posts.length);
    });

    test('keeps the target post flagged to scroll into view across re-renders', () => {
        const targetChannelId = 'target_channel';
        const initialPosts = [
            makeScheduledPost('a', 'Post A', 'channel1'),
            makeScheduledPost('target', 'Sticky target post', targetChannelId),
            makeScheduledPost('b', 'Post B', 'channel1'),
        ];

        const {rerender} = renderList(initialPosts, [], `?target_id=${targetChannelId}`);

        const getTargetRow = () => screen.getByText('Sticky target post').closest('[data-testid="scheduled-post-row"]');
        expect(getTargetRow()).toHaveAttribute('data-scroll-into-view', 'true');

        // Re-render with an extra post. The remembered target id now flows
        // through itemData, so the same post stays flagged via the sticky branch.
        rerender(
            <ScheduledPostList
                scheduledPosts={[...initialPosts, makeScheduledPost('c', 'Post C', 'channel1')]}
                currentUser={currentUser}
                userDisplayName='User One'
                userStatus='online'
            />,
        );

        expect(getTargetRow()).toHaveAttribute('data-scroll-into-view', 'true');
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
        expect(targetRow.closest('[data-testid="scheduled-post-row"]')).toHaveAttribute('data-scroll-into-view', 'true');
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

        expect(erroredRow).toHaveAttribute('data-scroll-into-view', 'false');
        expect(validRow).toHaveAttribute('data-scroll-into-view', 'true');
    });

    test('stays at the top and scrolls to nothing when the target_id matches no post', () => {
        const posts: ScheduledPost[] = [];
        for (let i = 0; i < 40; i++) {
            posts.push(makeScheduledPost(`sp${i}`, `Scheduled message ${i}`, 'channel1'));
        }

        renderList(posts, [], '?target_id=does_not_exist');

        // With no matching target the list stays at the top.
        expect(screen.getByText('Scheduled message 0')).toBeInTheDocument();

        // Nothing is flagged to scroll into view.
        const rows = screen.getAllByTestId('scheduled-post-row');
        rows.forEach((row) => expect(row).toHaveAttribute('data-scroll-into-view', 'false'));
    });
});
