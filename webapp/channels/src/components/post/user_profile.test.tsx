// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {Locations} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import PostUserProfile from './user_profile';

jest.mock('@mattermost/client', () => ({
    ...jest.requireActual('@mattermost/client'),
    Client4: class MockClient4 extends jest.requireActual('@mattermost/client').Client4 {
        getUserCustomProfileAttributesValues = jest.fn();
    },
}));

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

describe('PostUserProfile bot attributes in the username popover', () => {
    const bot = TestHelper.getUserMock({
        id: 'bot_user_id',
        username: 'deploybot',
        is_bot: true,
        bot_description: 'bot description',
    });
    const currentUser = TestHelper.getUserMock({id: 'current_user_id'});

    const state: DeepPartial<GlobalState> = {
        entities: {
            users: {
                profiles: {
                    [bot.id]: bot,
                    [currentUser.id]: currentUser,
                },
                currentUserId: currentUser.id,
            },
            general: {
                license: {
                    IsLicensed: 'true',
                    SkuShortName: 'enterprise',
                },
                customProfileAttributes: {
                    clearance: {id: 'clearance', name: 'Clearance', type: 'text'},
                },
            },
        },
    };

    const baseProps = {
        isBot: true,
        isSystemMessage: false,
        isMobileView: false,
        location: Locations.CENTER,
    };

    beforeEach(() => {
        (Client4.getUserCustomProfileAttributesValues as jest.Mock).mockImplementation(async () => ({
            clearance: 'Top Secret',
        }));
    });

    test('should neither fetch nor display attributes for a bot-authored webhook post without overrides', async () => {
        renderWithContext(
            <PostUserProfile
                {...baseProps}
                post={TestHelper.getPostMock({user_id: bot.id, props: {from_webhook: 'true'}})}
            />,
            state,
        );

        await userEvent.click(screen.getByRole('button', {name: 'deploybot'}));

        expect(await screen.findByText('bot description')).toBeInTheDocument();
        expect(screen.queryByText('Clearance')).not.toBeInTheDocument();
        expect(screen.queryByText('Top Secret')).not.toBeInTheDocument();
        expect(Client4.getUserCustomProfileAttributesValues).not.toHaveBeenCalled();
    });

    test('should display attributes for a non-webhook bot post', async () => {
        renderWithContext(
            <PostUserProfile
                {...baseProps}
                post={TestHelper.getPostMock({user_id: bot.id})}
            />,
            state,
        );

        await userEvent.click(screen.getByRole('button', {name: 'deploybot'}));

        expect(await screen.findByText('Top Secret')).toBeInTheDocument();
        expect(screen.getByText('Clearance')).toBeInTheDocument();
        expect(Client4.getUserCustomProfileAttributesValues).toHaveBeenCalledWith(bot.id);
    });
});
