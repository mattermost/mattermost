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

describe('renderSystemMessage', () => {
    const baseChannel: Channel = {
        id: 'channel-id',
        team_id: 'team-id',
        name: 'test-channel',
        display_name: 'Test Channel',
        type: 'O',
        header: '',
        purpose: '',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        creator_id: '',
        scheme_id: '',
        group_constrained: false,
        last_post_at: 0,
        last_root_post_at: 0,
    };

    const emptyMetadata = {
        embeds: [],
        emojis: [],
        files: [],
        images: {},
    };

    describe('page mention message', () => {
        it('renders page mention with username and page link', () => {
            const post: Post = {
                id: 'post-id',
                create_at: 0,
                update_at: 0,
                edit_at: 0,
                delete_at: 0,
                is_pinned: false,
                user_id: 'user-id',
                channel_id: 'channel-id',
                root_id: '',
                original_id: '',
                message: '',
                type: Posts.POST_TYPES.PAGE_MENTION,
                props: {
                    page_id: 'page-123',
                    wiki_id: 'wiki-456',
                    page_title: 'Test Page',
                    username: 'john.doe',
                },
                hashtags: '',
                pending_post_id: '',
                reply_count: 0,
                metadata: emptyMetadata,
            };

            const result = renderSystemMessage(post, 'test-team', baseChannel, false);
            renderWithContext(<>{result}</>);

            expect(screen.getByText('@john.doe')).toBeInTheDocument();
            expect(screen.getByText('Test Page')).toBeInTheDocument();
        });

        it('renders page mention with context when provided', () => {
            const post: Post = {
                id: 'post-id',
                create_at: 0,
                update_at: 0,
                edit_at: 0,
                delete_at: 0,
                is_pinned: false,
                user_id: 'user-id',
                channel_id: 'channel-id',
                root_id: '',
                original_id: '',
                message: '',
                type: Posts.POST_TYPES.PAGE_MENTION,
                props: {
                    page_id: 'page-123',
                    wiki_id: 'wiki-456',
                    page_title: 'Overview',
                    username: 'aiko.tan',
                    mention_context: '@aiko.tan is working on a plan to develop a new architecture',
                },
                hashtags: '',
                pending_post_id: '',
                reply_count: 0,
                metadata: emptyMetadata,
            };

            const result = renderSystemMessage(post, 'test-team', baseChannel, false);
            renderWithContext(<>{result}</>);

            expect(screen.getByText('@aiko.tan')).toBeInTheDocument();
            expect(screen.getByText('Overview')).toBeInTheDocument();
            expect(screen.getByText('@aiko.tan is working on a plan to develop a new architecture')).toBeInTheDocument();
        });

        it('does not render context div when mention_context is empty', () => {
            const post: Post = {
                id: 'post-id',
                create_at: 0,
                update_at: 0,
                edit_at: 0,
                delete_at: 0,
                is_pinned: false,
                user_id: 'user-id',
                channel_id: 'channel-id',
                root_id: '',
                original_id: '',
                message: '',
                type: Posts.POST_TYPES.PAGE_MENTION,
                props: {
                    page_id: 'page-123',
                    wiki_id: 'wiki-456',
                    page_title: 'Test Page',
                    username: 'john.doe',
                    mention_context: '',
                },
                hashtags: '',
                pending_post_id: '',
                reply_count: 0,
                metadata: emptyMetadata,
            };

            const result = renderSystemMessage(post, 'test-team', baseChannel, false);
            const {container} = renderWithContext(<>{result}</>);

            expect(screen.getByText('@john.doe')).toBeInTheDocument();
            expect(container.querySelector('.page-mention-context')).not.toBeInTheDocument();
        });
    });
});
