// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {Locations} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import PostUserProfile from './user_profile';

describe('PostUserProfile guest tag', () => {
    const guestUser = TestHelper.getUserMock({
        id: 'guest_user_id',
        username: 'zendesk',
        roles: 'system_guest',
    });

    const baseState: Partial<GlobalState> = {
        entities: {
            users: {
                profiles: {
                    [guestUser.id]: guestUser,
                },
            },
        },
    } as unknown as Partial<GlobalState>;

    const baseProps = {
        isBot: false,
        isSystemMessage: false,
        isMobileView: false,
        location: Locations.CENTER,
    };

    const webhookPost = TestHelper.getPostMock({user_id: guestUser.id, props: {from_webhook: 'true'}});
    const normalPost = TestHelper.getPostMock({user_id: guestUser.id});

    const renderProfile = (props: Partial<React.ComponentProps<typeof PostUserProfile>>) => renderWithContext(
        <PostUserProfile
            {...baseProps}
            {...props}
            post={props.post ?? normalPost}
        />,
        baseState,
    );

    describe('shows the GUEST tag for non-bot, non-webhook guest authors', () => {
        test('in the default layout', () => {
            renderProfile({post: normalPost});
            expect(screen.getByText('GUEST')).toBeInTheDocument();
        });

        test('in the compact layout', () => {
            renderProfile({post: normalPost, compactDisplay: true});
            expect(screen.getByText('GUEST')).toBeInTheDocument();
        });

        test('in the mobile layout', () => {
            renderProfile({post: normalPost, isMobileView: true});
            expect(screen.getByText('GUEST')).toBeInTheDocument();
        });

        test('for consecutive posts', () => {
            renderProfile({post: normalPost, isConsecutivePost: true});
            expect(screen.getByText('GUEST')).toBeInTheDocument();
        });
    });

    describe('hides the GUEST tag for webhook posts authored by a guest', () => {
        test('in the default layout (and still shows the BOT tag)', () => {
            renderProfile({post: webhookPost});
            expect(screen.queryByText('GUEST')).not.toBeInTheDocument();
            expect(screen.getByText('BOT')).toBeInTheDocument();
        });

        test('in the compact layout', () => {
            renderProfile({post: webhookPost, compactDisplay: true});
            expect(screen.queryByText('GUEST')).not.toBeInTheDocument();
        });

        test('in the mobile layout', () => {
            renderProfile({post: webhookPost, isMobileView: true});
            expect(screen.queryByText('GUEST')).not.toBeInTheDocument();
        });

        test('for consecutive posts', () => {
            renderProfile({post: webhookPost, isConsecutivePost: true});
            expect(screen.queryByText('GUEST')).not.toBeInTheDocument();
        });
    });

    describe('hides the GUEST tag for bot posts authored by a guest', () => {
        const botGuestUser = TestHelper.getUserMock({
            id: 'guest_user_id',
            username: 'zendesk',
            roles: 'system_guest',
            is_bot: true,
        });
        const botState: Partial<GlobalState> = {
            entities: {
                users: {
                    profiles: {
                        [botGuestUser.id]: botGuestUser,
                    },
                },
            },
        } as unknown as Partial<GlobalState>;

        test('hides GUEST while still rendering the BOT tag', () => {
            renderWithContext(
                <PostUserProfile
                    {...baseProps}
                    isBot={true}
                    post={normalPost}
                />,
                botState,
            );
            expect(screen.queryByText('GUEST')).not.toBeInTheDocument();
            expect(screen.getByText('BOT')).toBeInTheDocument();
        });
    });
});
