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

    test('should render', () => {
        const {container} = renderWithContext(
            <YoutubeVideo {...baseProps}/>,
            initialState,
        );

        // Verify that maxresdefault thumbnail is used by default (useMaxResThumbnail = true)
        expect(container.querySelector('.video-thumbnail')).toHaveAttribute(
            'src',
            'https://img.youtube.com/vi/xqCoNej8Zxo/maxresdefault.jpg',
        );
        expect(screen.getByRole('heading', {level: 4})).toHaveTextContent('YouTube - Youtube title');
    });

    test('should send the origin as referrer to the embedded player so YouTube does not reject it', async () => {
        renderWithContext(
            <YoutubeVideo {...baseProps}/>,
            initialState,
        );

        await userEvent.click(screen.getByRole('button', {name: /Play Youtube title on YouTube/}));

        const iframe = screen.getByTitle('Youtube title');
        expect(iframe).toHaveAttribute('referrerPolicy', 'strict-origin-when-cross-origin');
        expect(iframe).toHaveAttribute('src', 'https://www.youtube.com/embed/xqCoNej8Zxo?autoplay=1&rel=0&fs=1&enablejsapi=1');
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

    it('omits thumbnail box when external images are blocked', () => {
        const {container} = renderWithContext(
            <YoutubeVideo {...baseProps}/>,
            {
                ...initialState,
                entities: {
                    ...initialState.entities,
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

        expect(container.querySelector('.video-div')).toBeNull();
        expect(container.querySelector('.video-thumbnail__container')).not.toBeInTheDocument();
        expect(container.querySelector('img')).not.toBeInTheDocument();
    });
});
