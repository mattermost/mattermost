// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent} from '@testing-library/react';
import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import BookmarkIcon from './bookmark_icon';

describe('components/channel_bookmarks/BookmarkIcon', () => {
    test('renders the favicon and falls back to the default icon when it fails to load', () => {
        renderWithContext(
            <BookmarkIcon
                type='link'
                imageUrl='https://external.example/favicon.ico'
            />,
        );

        const img = screen.getByRole('img');
        expect(img).toHaveAttribute('src', 'https://external.example/favicon.ico');
        expect(screen.getByTestId('bookmark-icon')).toHaveAttribute('data-icon-kind', 'favicon');

        fireEvent.error(img);

        expect(screen.queryByRole('img')).not.toBeInTheDocument();
        expect(screen.getByTestId('bookmark-icon')).toHaveAttribute('data-icon-kind', 'link-fallback');
    });
});
