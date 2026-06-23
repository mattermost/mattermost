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

    test('shows the GUEST tag for a normal post authored by a guest', () => {
        const post = TestHelper.getPostMock({user_id: guestUser.id});

        renderWithContext(
            <PostUserProfile
                {...baseProps}
                post={post}
            />,
            baseState,
        );

        expect(screen.getByText('GUEST')).toBeInTheDocument();
    });

    test('hides the GUEST tag for a webhook post even when the author is a guest', () => {
        const post = TestHelper.getPostMock({
            user_id: guestUser.id,
            props: {from_webhook: 'true'},
        });

        renderWithContext(
            <PostUserProfile
                {...baseProps}
                post={post}
            />,
            baseState,
        );

        expect(screen.queryByText('GUEST')).not.toBeInTheDocument();
        expect(screen.getByText('BOT')).toBeInTheDocument();
    });

    test('hides the GUEST tag for a bot post even when the author is a guest', () => {
        const post = TestHelper.getPostMock({user_id: guestUser.id});

        renderWithContext(
            <PostUserProfile
                {...baseProps}
                post={post}
                isBot={true}
            />,
            baseState,
        );

        expect(screen.queryByText('GUEST')).not.toBeInTheDocument();
    });
});
