// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {Constants} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import PreviewPostAvatar from './avatar';

describe('components/post_view/post_message_preview/avatar', () => {
    const user = TestHelper.getUserMock({id: 'user1', username: 'user1'});

    const externalWebhookPost = TestHelper.getPostMock({
        user_id: user.id,
        props: {
            from_webhook: 'true',
            override_icon_url: 'https://evil.example/icon.png',
        },
    });

    const internalWebhookPost = TestHelper.getPostMock({
        user_id: user.id,
        props: {
            from_webhook: 'true',
            override_icon_url: 'https://mm.example.com/api/v4/files/abc',
        },
    });

    test('uses default webhook logo when BlockExternalImages is true and override_icon_url is external', () => {
        renderWithContext(
            <PreviewPostAvatar
                post={externalWebhookPost}
                user={user}
                enablePostIconOverride={true}
                hasImageProxy={false}
            />,
            {
                entities: {
                    general: {
                        config: {
                            BlockExternalImages: 'true',
                            SiteURL: 'https://mm.example.com',
                        },
                    },
                },
            },
        );

        expect(screen.getByRole('img')).toHaveAttribute('src', Constants.DEFAULT_WEBHOOK_LOGO);
    });

    test('keeps internal override_icon_url when BlockExternalImages is true', () => {
        renderWithContext(
            <PreviewPostAvatar
                post={internalWebhookPost}
                user={user}
                enablePostIconOverride={true}
                hasImageProxy={false}
            />,
            {
                entities: {
                    general: {
                        config: {
                            BlockExternalImages: 'true',
                            SiteURL: 'https://mm.example.com',
                        },
                    },
                },
            },
        );

        expect(screen.getByRole('img')).toHaveAttribute('src', 'https://mm.example.com/api/v4/files/abc');
    });

    test('keeps external override_icon_url when BlockExternalImages is false', () => {
        renderWithContext(
            <PreviewPostAvatar
                post={externalWebhookPost}
                user={user}
                enablePostIconOverride={true}
                hasImageProxy={false}
            />,
            {
                entities: {
                    general: {
                        config: {
                            BlockExternalImages: 'false',
                            SiteURL: 'https://mm.example.com',
                        },
                    },
                },
            },
        );

        expect(screen.getByRole('img')).toHaveAttribute('src', 'https://evil.example/icon.png');
    });
});
