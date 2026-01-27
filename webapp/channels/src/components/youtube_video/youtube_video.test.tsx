// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {fireEvent, renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import YoutubeVideo from './youtube_video';

jest.mock('actions/integration_actions');

describe('YoutubeVideo', () => {
    const baseProps = {
        postId: 'post_id_1',
        googleDeveloperKey: 'googledevkey',
        hasImageProxy: false,
        link: 'https://www.youtube.com/watch?v=xqCoNej8Zxo',
        show: true,
        metadata: {
            title: 'Youtube title',
            images: [{
                secure_url: 'linkForThumbnail',
                url: 'linkForThumbnail',
            }],
        },
        youtubeReferrerPolicy: false,
    };

    const initialState: DeepPartial<GlobalState> = {
        entities: {
            general: {
                config: {},
                license: {
                    Cloud: 'true',
                },
            },
            users: {
                currentUserId: 'currentUserId',
            },
        },
    };

    test('should match init snapshot', () => {
        const {container} = renderWithContext(
            <YoutubeVideo {...baseProps}/>,
            initialState,
        );
        expect(container).toMatchSnapshot();

        // Verify that maxresdefault thumbnail is used by default (useMaxResThumbnail = true)
        expect(container.querySelector('.video-thumbnail')).toHaveAttribute(
            'src',
            'https://img.youtube.com/vi/xqCoNej8Zxo/maxresdefault.jpg',
        );
        expect(screen.getByRole('heading', {level: 4})).toHaveTextContent('YouTube - Youtube title');
    });

    test('should match snapshot for playing state', async () => {
        const {container} = renderWithContext(
            <YoutubeVideo {...baseProps}/>,
            initialState,
        );

        // Click the play button to set playing state
        await userEvent.click(screen.getByRole('button', {name: /Play Youtube title on YouTube/}));

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot for playing state and `youtubeReferrerPolicy = true`', async () => {
        const {container} = renderWithContext(
            <YoutubeVideo
                {...baseProps}
                youtubeReferrerPolicy={true}
            />,
            initialState,
        );

        // Click the play button to set playing state
        await userEvent.click(screen.getByRole('button', {name: /Play Youtube title on YouTube/}));

        expect(container).toMatchSnapshot();

        // Verify that the iframe has a referrerPolicy attribute (set to 'origin') when youtubeReferrerPolicy is true.
        expect(container.querySelector('.video-playing iframe')).toHaveAttribute('referrerPolicy', 'origin');

        // Verify that the iframe src includes the new parameters
        expect(container.querySelector('.video-playing iframe')).toHaveAttribute('src', 'https://www.youtube.com/embed/xqCoNej8Zxo?autoplay=1&rel=0&fs=1&enablejsapi=1');
    });

    test('should use url if secure_url is not present', () => {
        const props = {
            ...baseProps,
            metadata: {
                title: 'Youtube title',
                images: [{
                    url: 'linkUrl',
                }],
            },
        };
        const {container} = renderWithContext(
            <YoutubeVideo {...props}/>,
            initialState,
        );

        // Verify that maxresdefault thumbnail is used by default (useMaxResThumbnail = true)
        expect(container.querySelector('.video-thumbnail')).toHaveAttribute(
            'src',
            'https://img.youtube.com/vi/xqCoNej8Zxo/maxresdefault.jpg',
        );
    });

    describe('thumbnail fallback', () => {
        it('should fallback to hqdefault.jpg on image error', () => {
            const {container} = renderWithContext(
                <YoutubeVideo {...baseProps}/>,
                initialState,
            );

            const thumbnail = container.querySelector('.video-thumbnail');
            expect(thumbnail).toBeInTheDocument();

            // Verify that maxresdefault is used initially
            expect(thumbnail).toHaveAttribute(
                'src',
                'https://img.youtube.com/vi/xqCoNej8Zxo/maxresdefault.jpg',
            );

            // Simulate thumbnail loading failure to test fallback behavior - fireEvent used because userEvent doesn't support image loading events
            fireEvent.error(thumbnail!);

            // Verify that hqdefault is used after error (useMaxResThumbnail is now false)
            expect(container.querySelector('.video-thumbnail')).toHaveAttribute(
                'src',
                'https://img.youtube.com/vi/xqCoNej8Zxo/hqdefault.jpg',
            );
        });
    });

    it('should initialize with useMaxResThumbnail set to true', () => {
        const {container} = renderWithContext(
            <YoutubeVideo {...baseProps}/>,
            initialState,
        );

        // Verify that the component initializes with useMaxResThumbnail = true by checking
        // that maxresdefault.jpg is used for the thumbnail
        expect(container.querySelector('.video-thumbnail')).toHaveAttribute(
            'src',
            'https://img.youtube.com/vi/xqCoNej8Zxo/maxresdefault.jpg',
        );
    });
});
