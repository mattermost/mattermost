// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import BlockedImageLink from './blocked_image_link';

const UNSAFE_SCRIPT_URL = ['javascript', 'alert(1)'].join(':');

describe('BlockedImageLink', () => {
    const state = {
        entities: {
            general: {
                config: {
                    SiteURL: 'https://chat.example.com',
                },
            },
        },
    };

    test('unwraps image proxy URL and renders ExternalLink', () => {
        renderWithContext(
            <BlockedImageLink
                src='https://chat.example.com/api/v4/image?url=https%3A%2F%2Fevil.example%2Fa.png'
                location='post_image'
            />,
            state,
        );

        const link = screen.getByRole('link', {name: 'https://evil.example/a.png'});
        expect(link).toHaveAttribute('href', 'https://evil.example/a.png');
        expect(link).toHaveAttribute('title', 'https://evil.example/a.png');
    });

    test('renders plain span for unsafe URLs', () => {
        renderWithContext(
            <BlockedImageLink
                src={UNSAFE_SCRIPT_URL}
                alt='Click me'
                location='post_image'
            />,
            state,
        );

        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        expect(screen.getByText('Click me')).toHaveAttribute('title', UNSAFE_SCRIPT_URL);
    });

    test('renders plain text without link when inline and disableLink is true', () => {
        const {container} = renderWithContext(
            <BlockedImageLink
                src='https://evil.example/a.png'
                alt='Alt text'
                location='markdown_image'
                inline={true}
                disableLink={true}
            />,
            state,
        );

        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        expect(container).toHaveTextContent('Alt text');
    });
});
