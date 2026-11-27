// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import BlockedImageLink from './blocked_image_link';

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

    test('unwraps /api/v4/image?url= and uses alt text', () => {
        renderWithContext(
            <BlockedImageLink
                src='/api/v4/image?url=https%3A%2F%2Fext.example%2Fa.png'
                alt='My Image'
                location='markdown_image'
            />,
            state,
        );

        const link = screen.getByRole('link', {name: 'My Image'});
        expect(link).toHaveAttribute('href', 'https://ext.example/a.png');
    });

    test('falls back to unwrapped URL when alt is empty', () => {
        renderWithContext(
            <BlockedImageLink
                src='/api/v4/image?url=https%3A%2F%2Fext.example%2Fa.png'
                location='markdown_image'
            />,
            state,
        );

        const link = screen.getByRole('link', {name: 'https://ext.example/a.png'});
        expect(link).toHaveAttribute('href', 'https://ext.example/a.png');
    });

    test('renders plain span without link when disableLink is true', () => {
        renderWithContext(
            <BlockedImageLink
                src='https://ext.example/a.png'
                alt='Inner alt'
                location='markdown_image'
                disableLink={true}
            />,
            state,
        );

        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        expect(screen.getByText('Inner alt').tagName).toBe('SPAN');
    });

    test('renders plain span when proxy url has unsafe or missing target', () => {
        const {rerender} = renderWithContext(
            <BlockedImageLink
                src='/api/v4/image?url=javascript%3Aalert(1)'
                alt='Unsafe target'
                location='markdown_image'
            />,
            state,
        );

        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        expect(screen.getByText('Unsafe target').tagName).toBe('SPAN');

        rerender(
            <BlockedImageLink
                src='/api/v4/image'
                alt='Missing target'
                location='markdown_image'
            />,
        );

        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        expect(screen.getByText('Missing target').tagName).toBe('SPAN');
    });

    test('wraps naturally for inline markdown_image and truncates in block containers', () => {
        const {rerender} = renderWithContext(
            <BlockedImageLink
                src='https://ext.example/very-long-image-name.png'
                location='markdown_image'
            />,
            state,
        );

        const inlineLink = screen.getByRole('link', {name: 'https://ext.example/very-long-image-name.png'});
        expect(inlineLink.getAttribute('style')).toBeNull();

        rerender(
            <BlockedImageLink
                src='https://ext.example/very-long-image-name.png'
                location='message_attachment'
                inline={false}
            />,
        );

        const truncatedLink = screen.getByRole('link', {name: 'https://ext.example/very-long-image-name.png'});
        expect(truncatedLink).toHaveStyle({
            display: 'inline-block',
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
        });
    });
});
