// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';

import {Posts} from 'mattermost-redux/constants';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import {renderSystemMessage} from './system_message_helpers';

const minimalChannel = {
    id: 'channel_id',
    team_id: 'team_id',
    type: 'O',
} as Channel;

function renderSharedChannelStatePost(post: Post) {
    return renderWithContext(
        <div>{renderSystemMessage(post, 'team', minimalChannel, false)}</div>,
    );
}

describe('renderSystemMessage shared channel state (renderSharedChannelStateMessage)', () => {
    it('renders shared state with workspace name', () => {
        const post = {
            id: 'p1',
            type: Posts.POST_TYPES.SHARED_CHANNEL_STATE,
            message: '',
            props: {
                shared_channel_state: 'shared',
                workspace_name: 'Acme Corp',
            },
        } as Post;

        renderSharedChannelStatePost(post);
        expect(screen.getByText('This channel is now shared with Acme Corp.')).toBeInTheDocument();
    });

    it('renders unshared with known workspace', () => {
        const post = {
            id: 'p2',
            type: Posts.POST_TYPES.SHARED_CHANNEL_STATE,
            message: '',
            props: {
                shared_channel_state: 'unshared',
                workspace_name: 'Acme Corp',
            },
        } as Post;

        renderSharedChannelStatePost(post);
        expect(screen.getByText('This channel is no longer shared with Acme Corp.')).toBeInTheDocument();
    });

    it('renders unshared with unknown workspace', () => {
        const post = {
            id: 'p3',
            type: Posts.POST_TYPES.SHARED_CHANNEL_STATE,
            message: '',
            props: {
                shared_channel_state: 'unshared',
                workspace_unknown: 'true',
            },
        } as Post;

        renderSharedChannelStatePost(post);
        expect(screen.getByText('This channel is no longer shared with another workspace.')).toBeInTheDocument();
    });

    it('returns null for invalid state string', () => {
        const post = {
            id: 'p4',
            type: Posts.POST_TYPES.SHARED_CHANNEL_STATE,
            message: '',
            props: {
                shared_channel_state: 'not-a-valid-state',
            },
        } as Post;

        const {container} = renderSharedChannelStatePost(post);
        expect(container.firstChild).toBeEmptyDOMElement();
    });

    it('returns null when shared_channel_state is null', () => {
        const post = {
            id: 'p5',
            type: Posts.POST_TYPES.SHARED_CHANNEL_STATE,
            message: '',
            props: {
                shared_channel_state: null,
            },
        } as unknown as Post;

        const {container} = renderSharedChannelStatePost(post);
        expect(container.firstChild).toBeEmptyDOMElement();
    });
});
