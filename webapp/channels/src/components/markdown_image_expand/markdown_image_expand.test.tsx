// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {screen, render} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import MarkdownImageExpand from './markdown_image_expand';

describe('components/MarkdownImageExpand', () => {
    const baseProps = {
        alt: 'Some alt text',
        postId: 'abc',
        imageKey: '1',
        onToggle: jest.fn(),
        toggleInlineImageVisibility: jest.fn(),
        children: 'An image to expand',
    };

    test('should render correctly when collapsed', () => {
        render(
            <MarkdownImageExpand
                {...baseProps}
                isExpanded={false}
            />,
        );

        expect(screen.getByText('Some alt text')).toBeInTheDocument();
        expect(screen.getByRole('button')).toHaveClass('markdown-image-expand__expand-button');
        expect(screen.queryByText('An image to expand')).not.toBeInTheDocument();
    });

    test('should render correctly when expanded', () => {
        render(
            <MarkdownImageExpand
                {...baseProps}
                isExpanded={true}
            />,
        );

        expect(screen.getByText('An image to expand')).toBeInTheDocument();
        expect(screen.getByRole('button')).toHaveClass('markdown-image-expand__collapse-button');
    });

    test('should call toggle handler when collapse button is clicked', async () => {
        render(
            <MarkdownImageExpand
                {...baseProps}
                isExpanded={true}
            />,
        );

        await userEvent.click(screen.getByRole('button'));

        expect(baseProps.toggleInlineImageVisibility).toHaveBeenCalledWith('abc', '1');
    });

    test('should call toggle handler when expand button is clicked', async () => {
        render(
            <MarkdownImageExpand
                {...baseProps}
                isExpanded={false}
            />,
        );

        await userEvent.click(screen.getByRole('button'));

        expect(baseProps.toggleInlineImageVisibility).toHaveBeenCalledWith('abc', '1');
    });
});
