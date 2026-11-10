// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import RhsThread from './rhs_thread';

jest.mock('components/rhs_header_post', () => (props: any) => (
    <div
        data-testid='rhs-header-post'
        data-root-post-id={props.rootPostId}
    />
));
jest.mock('components/threading/thread_viewer', () => (props: any) => (
    <div
        data-testid='thread-viewer'
        data-root-post-id={props.rootPostId}
    />
));
jest.mock('actions/views/rhs', () => ({
    closeRightHandSide: jest.fn(() => ({type: 'CLOSE_RHS'})),
}));

describe('components/RhsThread', () => {
    const post: Post = TestHelper.getPostMock({
        channel_id: 'channel_id',
        create_at: 1502715365009,
        update_at: 1502715372443,
    });

    const channel: Channel = TestHelper.getChannelMock({
        display_name: '',
        name: '',
        header: '',
        purpose: '',
        creator_id: '',
        scheme_id: '',
        teammate_id: '',
        status: '',
    });

    const currentTeam = TestHelper.getTeamMock();

    const baseProps = {
        selected: post,
        channel,
        currentTeam,
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <RhsThread {...baseProps}/>,
        );
        expect(container).toMatchSnapshot();
    });
});
