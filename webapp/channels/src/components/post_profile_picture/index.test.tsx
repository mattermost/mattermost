// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import PostProfilePictureContainer from './index';

jest.mock('./post_profile_picture', () => ({
    __esModule: true,
    default: (props: {overwriteIcon?: string}) => (
        <span
            data-testid='post-profile-picture'
            data-overwrite-icon={props.overwriteIcon ?? ''}
        />
    ),
}));

describe('components/post_profile_picture/index', () => {
    const iconURL = 'https://external.example/icon.png';
    const post = TestHelper.getPostMock({
        user_id: 'user1',
        props: {from_webhook: 'true', override_icon_url: iconURL},
    });

    const renderWithProxy = (hasImageProxy: 'true' | 'false') => renderWithContext(
        <PostProfilePictureContainer
            userId='user1'
            post={post}
        />,
        {
            entities: {
                general: {
                    config: {
                        EnablePostIconOverride: 'true',
                        HasImageProxy: hasImageProxy,
                    },
                },
            },
        },
    );

    test('passes the override icon through the image proxy when the proxy is enabled', () => {
        renderWithProxy('true');

        expect(screen.getByTestId('post-profile-picture')).toHaveAttribute(
            'data-overwrite-icon',
            `${Client4.getBaseRoute()}/image?url=${encodeURIComponent(iconURL)}`,
        );
    });

    test('passes the override icon unchanged when the proxy is disabled', () => {
        renderWithProxy('false');

        expect(screen.getByTestId('post-profile-picture')).toHaveAttribute('data-overwrite-icon', iconURL);
    });
});
