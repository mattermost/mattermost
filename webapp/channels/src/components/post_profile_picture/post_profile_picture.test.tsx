// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import Constants from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import PostProfilePicture from './post_profile_picture';

import ConnectedPostProfilePicture from './index';

type Props = ComponentProps<typeof PostProfilePicture>;

describe('components/PostProfilePicture', () => {
    const user = TestHelper.getUserMock({
        id: 'defaultuser',
    });
    const post = TestHelper.getPostMock({
        user_id: 'defaultuser',
    });

    const baseProps: Props = {
        availabilityStatusOnPosts: 'true',
        enablePostIconOverride: true,
        compactDisplay: true,
        hasImageProxy: true,
        post,
        user,
        isBot: Boolean(user.is_bot),
    };

    test('no status and post icon override specified, default props', () => {
        const props: Props = baseProps;
        renderWithContext(
            <PostProfilePicture {...props}/>,
        );

        expect(screen.queryByLabelText('Online')).not.toBeInTheDocument();

        // no status is given, 'Offline' should be in the dom as a fallback
        expect(screen.getByLabelText('Offline')).toBeInTheDocument();
    });

    test('status is specified, default props', () => {
        const props: Props = {
            ...baseProps,
            status: 'away',
        };
        renderWithContext(
            <PostProfilePicture {...props}/>,
        );

        // status is given, 'Away' should be in the dom
        expect(screen.getByLabelText('Away')).toBeInTheDocument();

        expect(screen.queryByLabelText('Online')).not.toBeInTheDocument();

        expect(screen.queryByLabelText('Offline')).not.toBeInTheDocument();

        expect(screen.getAllByRole('img')).toHaveLength(2);
    });

    describe('BlockExternalImages override icon', () => {
        const webhookPost = TestHelper.getPostMock({
            user_id: 'defaultuser',
            props: {
                from_webhook: 'true',
                override_icon_url: 'https://evil.example/icon.png',
            },
        });

        const internalWebhookPost = TestHelper.getPostMock({
            user_id: 'defaultuser',
            props: {
                from_webhook: 'true',
                override_icon_url: 'https://mm.example.com/api/v4/files/abc',
            },
        });

        test('falls back to default webhook logo and omits external overwriteIcon from profile popover when BlockExternalImages is true', async () => {
            renderWithContext(
                <ConnectedPostProfilePicture
                    userId={user.id}
                    post={webhookPost}
                />,
                {
                    entities: {
                        general: {
                            config: {
                                EnablePostIconOverride: 'true',
                                BlockExternalImages: 'true',
                                SiteURL: 'https://mm.example.com',
                            },
                        },
                        users: {
                            profiles: {[user.id]: user},
                        },
                    },
                },
            );

            const img = screen.getByRole('img');
            expect(img).toHaveAttribute('src', Constants.DEFAULT_WEBHOOK_LOGO);

            await userEvent.click(screen.getByRole('button'));
            await waitFor(() => {
                expect(screen.getAllByRole('img').every((el) => el.getAttribute('src') !== 'https://evil.example/icon.png')).toBe(true);
            });
        });

        test('keeps internal override_icon_url when BlockExternalImages is true', () => {
            renderWithContext(
                <ConnectedPostProfilePicture
                    userId={user.id}
                    post={internalWebhookPost}
                />,
                {
                    entities: {
                        general: {
                            config: {
                                EnablePostIconOverride: 'true',
                                BlockExternalImages: 'true',
                                SiteURL: 'https://mm.example.com',
                            },
                        },
                        users: {
                            profiles: {[user.id]: user},
                        },
                    },
                },
            );

            const img = screen.getByRole('img');
            expect(img).toHaveAttribute('src', 'https://mm.example.com/api/v4/files/abc');
        });

        test('keeps external override_icon_url when BlockExternalImages is false', () => {
            renderWithContext(
                <ConnectedPostProfilePicture
                    userId={user.id}
                    post={webhookPost}
                />,
                {
                    entities: {
                        general: {
                            config: {
                                EnablePostIconOverride: 'true',
                                BlockExternalImages: 'false',
                                SiteURL: 'https://mm.example.com',
                            },
                        },
                        users: {
                            profiles: {[user.id]: user},
                        },
                    },
                },
            );

            const img = screen.getByRole('img');
            expect(img).toHaveAttribute('src', 'https://evil.example/icon.png');
        });

        test('does not fall back to raw post.props.override_icon_url when overrideIconURL prop is undefined', () => {
            renderWithContext(
                <PostProfilePicture
                    {...baseProps}
                    compactDisplay={false}
                    hasImageProxy={false}
                    post={webhookPost}
                />,
            );

            expect(screen.getByRole('img')).toHaveAttribute('src', Constants.DEFAULT_WEBHOOK_LOGO);
        });

        test('uses overrideIconURL prop when provided on PostProfilePicture', () => {
            renderWithContext(
                <PostProfilePicture
                    {...baseProps}
                    compactDisplay={false}
                    hasImageProxy={false}
                    overrideIconURL='https://mm.example.com/api/v4/files/abc'
                    post={webhookPost}
                />,
            );

            expect(screen.getByRole('img')).toHaveAttribute('src', 'https://mm.example.com/api/v4/files/abc');
        });
    });
});
