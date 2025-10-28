// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act} from '@testing-library/react';
import React from 'react';

import type {Post} from '@mattermost/types/posts';
import type {DeepPartial} from '@mattermost/types/utilities';

import {Client4} from 'mattermost-redux/client';

import {DataSpillageReport} from 'components/post_view/data_spillage_report/data_spillage_report';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

jest.mock('components/common/hooks/useUser');
jest.mock('components/common/hooks/useChannel');
jest.mock('components/common/hooks/usePost');
jest.mock('mattermost-redux/actions/posts');
jest.mock('components/common/hooks/useContentFlaggingFields');
jest.mock('components/common/hooks/usePropertyCardViewChannelLoader');
jest.mock('components/common/hooks/usePropertyCardViewTeamLoader');
jest.mock('components/common/hooks/usePropertyCardViewPostLoader');

const mockedUseUser = require('components/common/hooks/useUser').useUser as jest.MockedFunction<any>;
const mockUseChannel = require('components/common/hooks/useChannel').useChannel as jest.MockedFunction<any>;
const mockedUsePost = require('components/common/hooks/usePost').usePost as jest.MockedFunction<any>;

const mockGetPost = require('mattermost-redux/actions/posts').getPost as jest.MockedFunction<any>;
const useContentFlaggingFields = require('components/common/hooks/useContentFlaggingFields').useContentFlaggingFields as jest.MockedFunction<any>;
const usePostContentFlaggingValues = require('components/common/hooks/useContentFlaggingFields').usePostContentFlaggingValues as jest.MockedFunction<any>;
const usePropertyCardViewChannelLoader = require('components/common/hooks/usePropertyCardViewChannelLoader').usePropertyCardViewChannelLoader as jest.MockedFunction<any>;
const usePropertyCardViewTeamLoader = require('components/common/hooks/usePropertyCardViewTeamLoader').usePropertyCardViewTeamLoader as jest.MockedFunction<any>;
const usePropertyCardViewPostLoader = require('components/common/hooks/usePropertyCardViewPostLoader').usePropertyCardViewPostLoader as jest.MockedFunction<any>;

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

    const reviewerUser = TestHelper.getUserMock({
        id: 'reviewer_user_id',
        username: 'reviewer_user',
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
                    [reviewerUser.id]: reviewerUser,
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

    const contentFlaggingFields = {
        action_time: {
            id: 'wcdwx96ratrrbq5uuhyz3zq48r',
            group_id: 'ey36rkw3bjybb8gtrdkn3hmeqa',
            name: 'action_time',
            type: 'text',
            attrs: null,
            target_id: '',
            target_type: '',
            create_at: 1756788661623,
            update_at: 1756788661623,
            delete_at: 0,
        },
        actor_comment: {
            id: 'f3s8fsgn978bbne96s6tqpdife',
            group_id: 'ey36rkw3bjybb8gtrdkn3hmeqa',
            name: 'actor_comment',
            type: 'text',
            attrs: null,
            target_id: '',
            target_type: '',
            create_at: 1756788661624,
            update_at: 1756788661624,
            delete_at: 0,
        },
        actor_user_id: {
            id: 'z1bpj14kgfdjzmnuyy6oqcyufh',
            group_id: 'ey36rkw3bjybb8gtrdkn3hmeqa',
            name: 'actor_user_id',
            type: 'user',
            attrs: null,
            target_id: '',
            target_type: '',
            create_at: 1756788661626,
            update_at: 1756788661626,
            delete_at: 0,
        },
        flagged_post_id: {
            id: 'jssh4fbn9jrfxjf4fsr7zdu65y',
            group_id: 'ey36rkw3bjybb8gtrdkn3hmeqa',
            name: 'flagged_post_id',
            type: 'text',
            attrs: null,
            target_id: '',
            target_type: '',
            create_at: 1756788661623,
            update_at: 1756788661623,
            delete_at: 0,
        },
        reporting_comment: {
            id: 'sx7h53tdsbfb985edkmze71j3c',
            group_id: 'ey36rkw3bjybb8gtrdkn3hmeqa',
            name: 'reporting_comment',
            type: 'text',
            attrs: null,
            target_id: '',
            target_type: '',
            create_at: 1756788661625,
            update_at: 1756788661625,
            delete_at: 0,
        },
        reporting_reason: {
            id: '5knyqectdfbi98rab3zz4hsyhh',
            group_id: 'ey36rkw3bjybb8gtrdkn3hmeqa',
            name: 'reporting_reason',
            type: 'select',
            attrs: null,
            target_id: '',
            target_type: '',
            create_at: 1756788661624,
            update_at: 1756788661624,
            delete_at: 0,
        },
        reporting_time: {
            id: '5cib5g3ag3gs3gxyg7awjd6csh',
            group_id: 'ey36rkw3bjybb8gtrdkn3hmeqa',
            name: 'reporting_time',
            type: 'text',
            attrs: {
                subType: 'timestamp',
            },
            target_id: '',
            target_type: '',
            create_at: 1756788661625,
            update_at: 1756788661625,
            delete_at: 0,
        },
        reporting_user_id: {
            id: '1is7ir68bp8nup3rr1pp6d7fsr',
            group_id: 'ey36rkw3bjybb8gtrdkn3hmeqa',
            name: 'reporting_user_id',
            type: 'user',
            attrs: null,
            target_id: '',
            target_type: '',
            create_at: 1756788661625,
            update_at: 1756788661625,
            delete_at: 0,
        },
        reviewer_user_id: {
            id: 'g6hrg3uugbyqzyyb9kx8jgpbwh',
            group_id: 'ey36rkw3bjybb8gtrdkn3hmeqa',
            name: 'reviewer_user_id',
            type: 'user',
            attrs: {editable: true},
            target_id: '',
            target_type: '',
            create_at: 1756788661624,
            update_at: 1756788661624,
            delete_at: 0,
        },
        status: {
            id: 'kd9n7tf9n3ynjczqpkpjkbzgoh',
            group_id: 'ey36rkw3bjybb8gtrdkn3hmeqa',
            name: 'status',
            type: 'select',
            attrs: {
                options: [
                    {
                        color: 'light_grey',
                        name: 'Pending',
                    },
                    {
                        color: 'dark_blue',
                        name: 'Assigned',
                    },
                    {
                        color: 'dark_red',
                        name: 'Removed',
                    },
                    {
                        color: 'light_blue',
                        name: 'Retained',
                    },
                ],
            },
            target_id: '',
            target_type: '',
            create_at: 1756788661623,
            update_at: 1756788661623,
            delete_at: 0,
        },
    };

    const postContentFlaggingValues = [
        {
            id: 'cnth3s1rot88zpz3hwy99uet7y',
            target_id: 'i93oo5gb4tygixs4g8atqyjryy',
            target_type: 'post',
            group_id: 'ey36rkw3bjybb8gtrdkn3hmeqa',
            field_id: contentFlaggingFields.status.id,
            value: 'Pending',
            create_at: 1756790533486,
            update_at: 1756790533486,
            delete_at: 0,
        },
        {
            id: 'gg5aq8iefpn978po54fd9xf1br',
            target_id: 'i93oo5gb4tygixs4g8atqyjryy',
            target_type: 'post',
            group_id: 'ey36rkw3bjybb8gtrdkn3hmeqa',
            field_id: contentFlaggingFields.reporting_reason.id,
            value: 'Sensitive data',
            create_at: 1756790533487,
            update_at: 1756790533487,
            delete_at: 0,
        },
        {
            id: 'nbooe396mf8zjq5pjk931gtf5y',
            target_id: 'i93oo5gb4tygixs4g8atqyjryy',
            target_type: 'post',
            group_id: 'ey36rkw3bjybb8gtrdkn3hmeqa',
            field_id: contentFlaggingFields.reporting_user_id.id,
            value: reportingUser.id,
            create_at: 1756790533487,
            update_at: 1756790533487,
            delete_at: 0,
        },
        {
            id: 'dxzrb4g9xfn5jn5mgxcnmqauzo',
            target_id: 'i93oo5gb4tygixs4g8atqyjryy',
            target_type: 'post',
            group_id: 'ey36rkw3bjybb8gtrdkn3hmeqa',
            field_id: contentFlaggingFields.reporting_time.id,
            value: 1756790533486,
            create_at: 1756790533488,
            update_at: 1756790533488,
            delete_at: 0,
        },
        {
            id: 'mx4ez9di7bgebfa8y8r5uodjkc',
            target_id: 'i93oo5gb4tygixs4g8atqyjryy',
            target_type: 'post',
            group_id: 'ey36rkw3bjybb8gtrdkn3hmeqa',
            field_id: contentFlaggingFields.reporting_comment.id,
            value: 'Please review this post for potential violations',
            create_at: 1756790533488,
            update_at: 1756790533488,
            delete_at: 0,
        },
        {
            id: '7azuir6wcf8n5gbmruyat1g7xh',
            target_id: 'oxjt9atahbrjugqrd8rgorps6h',
            target_type: 'post',
            group_id: 'kykzwf98njrbzp89r9s4ey15kh',
            field_id: contentFlaggingFields.reviewer_user_id.id,
            value: reviewerUser.id,
            create_at: 1759732888594,
            update_at: 1759743763772,
            delete_at: 0,
        },
    ];

    beforeEach(() => {
        jest.resetAllMocks();

        // Mock all hooks before any component rendering
        mockedUseUser.mockImplementation((userId: string) => {
            if (userId === reportingUser.id) {
                return reportingUser;
            } else if (userId === reportedPostAuthor.id) {
                return reportedPostAuthor;
            }
            return null;
        });
        mockedUsePost.mockReturnValue(null);
        mockUseChannel.mockReturnValue(reportedPostChannel);

        // Mock the action to return a resolved promise instead of dispatching
        mockGetPost.mockResolvedValue({type: 'MOCK_ACTION', data: reportedPost});

        useContentFlaggingFields.mockReturnValue(contentFlaggingFields);
        usePostContentFlaggingValues.mockReturnValue(postContentFlaggingValues);
        usePropertyCardViewChannelLoader.mockReturnValue(reportedPostChannel);
        usePropertyCardViewTeamLoader.mockReturnValue(reportedPostTeam);
        usePropertyCardViewPostLoader.mockReturnValue(reportedPost);

        Client4.getFlaggedPost = jest.fn().mockResolvedValue(reportedPost);
    });

    it('should render selected fields when not in RHS', async () => {
        renderWithContext(
            <DataSpillageReport
                post={post}
                isRHS={false}
            />,
            baseState,
        );

        await act(async () => {});

        // validate title
        const title = screen.queryByTestId('property-card-title');
        expect(title).toBeVisible();
        expect(title).toHaveTextContent('@reporting_user flagged a message for review');

        expect(screen.queryAllByTestId('property-card-row')).toHaveLength(4);

        expect(screen.queryAllByTestId('select-property')).toHaveLength(2);

        const statusFieldValue = screen.queryAllByTestId('select-property')[0];
        expect(statusFieldValue).toHaveTextContent('Pending');

        const reasonFieldValue = screen.queryAllByTestId('select-property')[1];
        expect(reasonFieldValue).toHaveTextContent('Sensitive data');

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

        await act(async () => {});

        const flaggedBy = screen.queryAllByTestId('user-property')[0];
        expect(flaggedBy).toBeVisible();
        expect(flaggedBy).toHaveTextContent('reporting_user');

        const postId = screen.queryAllByTestId('text-property')[0];
        expect(postId).toBeVisible();
        expect(postId).toHaveTextContent(reportedPost.id);

        const comment = screen.queryAllByTestId('text-property')[1];
        expect(comment).toBeVisible();
        expect(comment).toHaveTextContent('Please review this post for potential violations');

        const channel = screen.queryByTestId('channel-property');
        expect(channel).toBeVisible();
        expect(channel).toHaveTextContent('reported-post-channel');

        const team = screen.queryByTestId('team-property');
        expect(team).toBeVisible();
        expect(team).toHaveTextContent('Reported Post Team');

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
