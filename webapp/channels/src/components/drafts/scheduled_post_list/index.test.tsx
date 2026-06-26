// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createMemoryHistory} from 'history';
import React from 'react';

import type {ScheduledPost} from '@mattermost/types/schedule_post';

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

function makeScheduledPost(id: string, message: string, channelId: string): ScheduledPost {
    return {
        id,
        message,
        channel_id: channelId,
        root_id: '',
        user_id: 'user1',
        create_at: 1700000000000,
        update_at: 1700000000000,
        scheduled_at: 1800000000000,
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

    test('renders the empty state when there are no scheduled posts', () => {
        renderList([]);

        expect(screen.getByText('No scheduled drafts at the moment')).toBeInTheDocument();
        expect(screen.queryByTestId('scheduled-post-row')).not.toBeInTheDocument();
    });

    test('renders the scheduled posts that are provided', () => {
        renderList([
            makeScheduledPost('sp1', 'First scheduled message', 'channel1'),
            makeScheduledPost('sp2', 'Second scheduled message', 'channel1'),
        ]);

        expect(screen.getByText('First scheduled message')).toBeInTheDocument();
        expect(screen.getByText('Second scheduled message')).toBeInTheDocument();
    });

    test('shows the error banner when a scheduled post has an error', () => {
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

    test('virtualizes a long list, scrolling to the target_id post far down the list', () => {
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
        expect(targetRow).toBeInTheDocument();
        expect(targetRow.closest('[data-testid="scheduled-post-row"]')).toHaveAttribute('data-scroll-into-view', 'true');

        // Virtualization: the rows at the very top of the list are not rendered
        // because the list scrolled down to the target.
        expect(screen.queryByText('Scheduled message 0')).not.toBeInTheDocument();

        // Only a small window of rows is rendered, not all 40.
        expect(screen.getAllByTestId('scheduled-post-row').length).toBeLessThan(40);
    });
});
