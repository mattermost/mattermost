// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {acknowledgePost} from 'mattermost-redux/actions/posts';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import PostAcknowledgements from '.';

jest.mock('mattermost-redux/actions/posts', () => ({
    ...jest.requireActual('mattermost-redux/actions/posts'),
    acknowledgePost: jest.fn(() => ({type: 'MOCK_ACKNOWLEDGE_POST'})),
}));

describe('components/post_view/acknowledgements', () => {
    const dm = TestHelper.getChannelMock({id: 'dm_id', type: 'D', team_id: ''});
    const channel = TestHelper.getChannelMock({id: 'channel_id', type: 'O', team_id: 'team_id'});
    const dmPost = TestHelper.getPostMock({id: 'dm_post', channel_id: dm.id, user_id: 'author_id'});
    const channelPost = TestHelper.getPostMock({id: 'channel_post', channel_id: channel.id, user_id: 'author_id'});

    const writeDeniedState: DeepPartial<GlobalState> = {
        entities: {
            general: {config: {FeatureFlagPermissionPolicies: 'true'}},
            users: {currentUserId: 'current_user_id'},
            channels: {channels: {[dm.id]: dm, [channel.id]: channel}},
            posts: {posts: {[dmPost.id]: dmPost, [channelPost.id]: channelPost}, acknowledgements: {}},
            renderPermissions: {byResource: {permission: {'': {dm_gm_write_access: {allowed: false, evaluated: true, generation: 1}}}}},
        },
    };

    beforeEach(() => {
        jest.mocked(acknowledgePost).mockClear();
    });

    it('should not acknowledge a conversation post while dm_gm_write_access denies', async () => {
        renderWithContext(
            <PostAcknowledgements
                postId={dmPost.id}
                authorId={dmPost.user_id}
                isDeleted={false}
            />,
            writeDeniedState,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Acknowledge'}));

        expect(acknowledgePost).not.toHaveBeenCalled();
    });

    it('should still acknowledge a channel post while only dm_gm_write_access denies', async () => {
        renderWithContext(
            <PostAcknowledgements
                postId={channelPost.id}
                authorId={channelPost.user_id}
                isDeleted={false}
            />,
            writeDeniedState,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Acknowledge'}));

        expect(acknowledgePost).toHaveBeenCalledWith(channelPost.id);
    });
});
