// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Post} from '@mattermost/types/posts';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import PostImage from './post_image';

describe('PostImage', () => {
    const post = {id: 'post-1'} as Post;
    const imageMetadata = {format: 'png', frameCount: 0, height: 100, width: 100};

    test('renders BlockedImageLink instead of img when external images are blocked', () => {
        renderWithContext(
            <PostImage
                imageMetadata={imageMetadata}
                link='https://external.example/pic.png'
                post={post}
                actions={{openModal: jest.fn()}}
            />,
            {
                entities: {
                    general: {
                        config: {
                            SiteURL: 'https://chat.example.com',
                            HasImageProxy: 'true',
                            ImageProxyType: 'block',
                        },
                    },
                },
            },
        );

        const link = screen.getByRole('link', {name: 'https://external.example/pic.png'});
        expect(link).toHaveAttribute('href', 'https://external.example/pic.png');
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
});
