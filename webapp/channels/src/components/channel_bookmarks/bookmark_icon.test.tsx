// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import BookmarkIcon from './bookmark_icon';

describe('components/channel_bookmarks/BookmarkIcon', () => {
    test('falls back to default icon when BlockExternalImages is true and imageUrl is external', () => {
        renderWithContext(
            <BookmarkIcon
                type='link'
                imageUrl='https://evil.example/favicon.ico'
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

        expect(screen.getByTestId('bookmark-icon')).toHaveAttribute('data-icon-kind', 'link-fallback');
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    test('renders internal imageUrl when BlockExternalImages is true', () => {
        renderWithContext(
            <BookmarkIcon
                type='link'
                imageUrl='https://mm.example.com/static/favicon.ico'
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

        expect(screen.getByTestId('bookmark-icon')).toHaveAttribute('data-icon-kind', 'favicon');
        expect(screen.getByRole('img')).toHaveAttribute('src', 'https://mm.example.com/static/favicon.ico');
    });

    test('renders external imageUrl when BlockExternalImages is false', () => {
        renderWithContext(
            <BookmarkIcon
                type='link'
                imageUrl='https://evil.example/favicon.ico'
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

        expect(screen.getByTestId('bookmark-icon')).toHaveAttribute('data-icon-kind', 'favicon');
        expect(screen.getByRole('img')).toHaveAttribute('src', 'https://evil.example/favicon.ico');
    });

    test('renders emoji icon unaffected when BlockExternalImages is true', () => {
        renderWithContext(
            <BookmarkIcon
                type='link'
                emoji=':smile:'
                imageUrl='https://evil.example/favicon.ico'
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

        expect(screen.getByTestId('bookmark-icon')).toHaveAttribute('data-icon-kind', 'emoji');
    });
});
