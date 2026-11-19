// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import PostImage from './post_image';

describe('components/post_view/PostImage', () => {
    const baseProps = {
        imageMetadata: {
            format: 'png',
            frameCount: 0,
            height: 200,
            width: 300,
        },
        link: 'https://external.example.com/image.png',
        post: TestHelper.getPostMock({id: 'post_id'}),
        actions: {
            openModal: jest.fn(),
        },
    };

    test('should render an image when BlockExternalImages is off', () => {
        renderWithContext(
            <PostImage {...baseProps}/>,
            {
                entities: {
                    general: {
                        config: {
                            BlockExternalImages: 'false',
                            SiteURL: 'https://chat.example.com',
                        },
                    },
                },
            },
        );

        expect(screen.getByRole('img', {hidden: true})).toBeInTheDocument();
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    test('should render an ExternalLink with unwrapped URL when external image is blocked', () => {
        renderWithContext(
            <PostImage
                {...baseProps}
                link='https://chat.example.com/api/v4/image?url=https%3A%2F%2Fexternal.example.com%2Fimage.png'
            />,
            {
                entities: {
                    general: {
                        config: {
                            BlockExternalImages: 'true',
                            SiteURL: 'https://chat.example.com',
                        },
                    },
                },
            },
        );

        const link = screen.getByRole('link', {name: 'https://external.example.com/image.png'});
        expect(link).toHaveAttribute('href', 'https://external.example.com/image.png');
        expect(link).toHaveAttribute('title', 'https://external.example.com/image.png');
        expect(screen.queryByRole('img', {hidden: true})).not.toBeInTheDocument();
    });

    test('should render SizeAwareImage with empty src for proxied SVG when BlockExternalImages is false and EnableSVGs is false', () => {
        const origError = console.error;
        console.error = (...args: Parameters<typeof console.error>) => {
            if (typeof args[0] === 'string' && args[0].startsWith('An empty string ("") was passed to the ')) {
                return;
            }
            origError(...args);
        };

        let container: HTMLElement;
        try {
            ({container} = renderWithContext(
                <PostImage
                    {...baseProps}
                    imageMetadata={{
                        format: 'svg',
                        frameCount: 0,
                        height: 0,
                        width: 0,
                    }}
                    link='https://chat.example.com/api/v4/image?url=https%3A%2F%2Fexternal.example.com%2Flogo.svg'
                />,
                {
                    entities: {
                        general: {
                            config: {
                                BlockExternalImages: 'false',
                                EnableSVGs: 'false',
                                SiteURL: 'https://chat.example.com',
                            },
                        },
                    },
                },
            ));
        } finally {
            console.error = origError;
        }

        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        const img = container.querySelector('img.attachment__image');
        expect(img).toBeInTheDocument();
        expect(img).not.toHaveAttribute('src');
    });
});
