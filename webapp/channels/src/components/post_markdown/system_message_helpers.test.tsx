// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';

import {Posts} from 'mattermost-redux/constants';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import type {AddMemberProps} from './system_message_helpers';
import {isAddMemberProps, renderSystemMessage} from './system_message_helpers';

describe('isAddMemberProps', () => {
    it('with empty lists', () => {
        const prop: AddMemberProps = {
            post_id: '',
            not_in_channel_user_ids: [],
            not_in_channel_usernames: [],
            not_in_groups_usernames: [],
        };

        expect(isAddMemberProps(prop)).toBe(true);
    });

    it('with values in lists', () => {
        const prop: AddMemberProps = {
            post_id: '',
            not_in_channel_user_ids: ['hello', 'world'],
            not_in_channel_usernames: ['hello', 'world'],
            not_in_groups_usernames: ['hello', 'world'],
        };

        expect(isAddMemberProps(prop)).toBe(true);
    });

    it('all values are required', () => {
        const baseProp: AddMemberProps = {
            post_id: '',
            not_in_channel_user_ids: [],
            not_in_channel_usernames: [],
            not_in_groups_usernames: [],
        };

        expect(isAddMemberProps(baseProp)).toBe(true);

        for (const key of Object.keys(baseProp)) {
            const wrongProp: Partial<AddMemberProps> = {...baseProp};
            delete wrongProp[key as keyof AddMemberProps];
            expect(isAddMemberProps(wrongProp)).toBe(false);
        }
    });

    it('common false cases', () => {
        expect(isAddMemberProps('')).toBe(false);
        expect(isAddMemberProps(undefined)).toBe(false);
        expect(isAddMemberProps(true)).toBe(false);
        expect(isAddMemberProps(1)).toBe(false);
        expect(isAddMemberProps([])).toBe(false);
    });
});

describe('renderSystemMessage shared channel state (renderSharedChannelStateMessage)', () => {
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

    it('renders shared state with workspace name', () => {
        const post: Partial<Post> = {
            id: 'p1',
            type: Posts.POST_TYPES.SHARED_CHANNEL_STATE,
            message: '',
            props: {
                shared_channel_state: 'shared',
                workspace_name: 'Acme Corp',
            },
        };

        renderSharedChannelStatePost(post as Post);
        expect(screen.getByText('This channel is now shared with Acme Corp.')).toBeInTheDocument();
    });

    it('renders unshared with known workspace', () => {
        const post: Partial<Post> = {
            id: 'p2',
            type: Posts.POST_TYPES.SHARED_CHANNEL_STATE,
            message: '',
            props: {
                shared_channel_state: 'unshared',
                workspace_name: 'Acme Corp',
            },
        };

        renderSharedChannelStatePost(post as Post);
        expect(screen.getByText('This channel is no longer shared with Acme Corp.')).toBeInTheDocument();
    });

    it('renders unshared with unknown workspace', () => {
        const post: Partial<Post> = {
            id: 'p3',
            type: Posts.POST_TYPES.SHARED_CHANNEL_STATE,
            message: '',
            props: {
                shared_channel_state: 'unshared',
            },
        };

        renderSharedChannelStatePost(post as Post);
        expect(screen.getByText('This channel is no longer shared with another workspace.')).toBeInTheDocument();
    });

    it('returns null for invalid state string', () => {
        const post: Partial<Post> = {
            id: 'p4',
            type: Posts.POST_TYPES.SHARED_CHANNEL_STATE,
            message: '',
            props: {
                shared_channel_state: 'not-a-valid-state',
            },
        };

        const {container} = renderSharedChannelStatePost(post as Post);
        expect(container.firstChild).toBeEmptyDOMElement();
    });

    it('returns null when shared_channel_state is null', () => {
        const post: Partial<Post> = {
            id: 'p5',
            type: Posts.POST_TYPES.SHARED_CHANNEL_STATE,
            message: '',
            props: {
                shared_channel_state: null,
            },
        };

        const {container} = renderSharedChannelStatePost(post as Post);
        expect(container.firstChild).toBeEmptyDOMElement();
    });
});
