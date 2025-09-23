// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Post} from '@mattermost/types/posts';
import type {DeepPartial} from '@mattermost/types/utilities';

import DataSpillageReport from 'components/post_view/data_spillage_report/data_spillage_report';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

describe('components/post_view/data_spillage_report/DataSpillageReport', () => {
    const reportingUser = TestHelper.getUserMock({
        id: 'ewgposajm3fwpjbqu1t6scncia',
        username: 'reporting_user',
    });

    const reportedPostTeam = TestHelper.getTeamMock({
        id: 'reported_post_team_id',
        display_name: 'Reported Post Team',
    });

    const reportedPostChannel = TestHelper.getChannelMock({
        id: 'reported_post_channel_id',
        display_name: 'reported-post-channel',
        team_id: reportedPostTeam.id,
    });

    const reportedPostAuthor = TestHelper.getUserMock({
        id: 'reported_post_author_id',
        username: 'reported_post_author',
    });

    const reportedPost = TestHelper.getPostMock({
        id: 'reported_post_id',
        message: 'Hello, world!',
        channel_id: reportedPostChannel.id,
        user_id: reportedPostAuthor.id,
        create_at: new Date(2025, 0, 1, 0, 1, 0, 0).getMilliseconds(),
    });

    const post: Post = TestHelper.getPostMock({
        props: {
            reported_post_id: reportedPost.id,
        },
    });

    const baseState: DeepPartial<GlobalState> = {
        entities: {
            users: {
                profiles: {
                    [reportingUser.id]: reportingUser,
                    [reportedPostAuthor.id]: reportedPostAuthor,
                },
            },
            posts: {
                posts: {
                    [reportedPost.id]: reportedPost,
                },
            },
            channels: {
                channels: {
                    [reportedPostChannel.id]: reportedPostChannel,
                },
            },
            teams: {
                teams: {
                    [reportedPostTeam.id]: reportedPostTeam,
                },
            },
        },
    };

    it('should render selected fields when not in RHS', async () => {
        renderWithContext(
            <DataSpillageReport
                post={post}
                isRHS={false}
            />,
            baseState,
        );

        // validate title
        const title = screen.queryByTestId('property-card-title');
        expect(title).toBeVisible();
        expect(title).toHaveTextContent('@reporting_user flagged a message for review');

        expect(screen.queryAllByTestId('property-card-row')).toHaveLength(4);

        expect(screen.queryAllByTestId('select-property')).toHaveLength(2);

        const statusFieldValue = screen.queryAllByTestId('select-property')[0];
        expect(statusFieldValue).toHaveTextContent('Flag dismissed');

        const reasonFieldValue = screen.queryAllByTestId('select-property')[1];
        expect(reasonFieldValue).toHaveTextContent('Inappropriate content');

        const postPreview = screen.queryByTestId('post-preview-property');
        expect(postPreview).toBeVisible();
        expect(postPreview).toHaveTextContent('Hello, world!');

        const assignee = screen.queryByTestId('selectable-user-property');
        expect(assignee).toBeVisible();

        // actions are not visible when not in RHS
        expect(screen.queryByTestId('data-spillage-action')).not.toBeInTheDocument();
    });

    it('should render all fields when in RHS', async () => {
        renderWithContext(
            <DataSpillageReport
                post={post}
                isRHS={true}
            />,
            baseState,
        );

        const flaggedBy = screen.queryAllByTestId('user-property')[0];
        expect(flaggedBy).toBeVisible();
        expect(flaggedBy).toHaveTextContent('reporting_user');

        const comment = screen.queryByTestId('text-property');
        expect(comment).toBeVisible();
        expect(comment).toHaveTextContent('Please review this post for potential violations');

        const channel = screen.queryByTestId('channel-property');
        expect(channel).toBeVisible();
        expect(channel).toHaveTextContent('reported-post-channel');

        const team = screen.queryByTestId('team-property');
        expect(team).toBeVisible();
        expect(team).toHaveTextContent('Reported Post Team');

        const postedBy = screen.queryAllByTestId('user-property')[1];
        expect(postedBy).toBeVisible();
        expect(postedBy).toHaveTextContent('reported_post_author');

        const reportedAt = screen.queryAllByTestId('timestamp-property')[0];
        expect(reportedAt).toBeVisible();

        const postedAt = screen.queryAllByTestId('timestamp-property')[1];
        expect(postedAt).toBeVisible();

        // actions are visible when in RHS
        expect(screen.queryByTestId('data-spillage-action')).toBeVisible();
        expect(screen.queryByTestId('data-spillage-action-remove-message')).toBeVisible();
        expect(screen.queryByTestId('data-spillage-action-keep-message')).toBeVisible();
    });
});
