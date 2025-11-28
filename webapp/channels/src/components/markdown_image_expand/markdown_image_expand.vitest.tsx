// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render, screen, fireEvent} from 'tests/vitest_react_testing_utils';

import MarkdownImageExpand from './markdown_image_expand';

describe('components/MarkdownImageExpand', () => {
    it('should match snapshot for collapsed embeds', () => {
        const toggleHandler = vi.fn();
        const imageCollapseHandler = vi.fn();
        const {container} = render(
            <MarkdownImageExpand
                alt={'Some alt text'}
                postId={'abc'}
                isExpanded={false}
                imageKey={'1'}
                onToggle={toggleHandler}
                toggleInlineImageVisibility={imageCollapseHandler}
            >{'An image to expand'}</MarkdownImageExpand>,
        );

        expect(container).toMatchSnapshot();
    });

    it('should match snapshot for expanded embeds', () => {
        const toggleHandler = vi.fn();
        const imageCollapseHandler = vi.fn();
        const {container} = render(
            <MarkdownImageExpand
                alt={'Some alt text'}
                postId={'abc'}
                isExpanded={true}
                imageKey={'1'}
                onToggle={toggleHandler}
                toggleInlineImageVisibility={imageCollapseHandler}
            >{'An image to expand'}</MarkdownImageExpand>,
        );

        expect(container).toMatchSnapshot();
    });

    it('should emit toggle action on collapse button click', () => {
        const toggleHandler = vi.fn();
        const imageCollapseHandler = vi.fn();
        render(
            <MarkdownImageExpand
                alt={'Some alt text'}
                postId={'abc'}
                isExpanded={true}
                imageKey={'1'}
                onToggle={toggleHandler}
                toggleInlineImageVisibility={imageCollapseHandler}
            >{'An image to expand'}</MarkdownImageExpand>,
        );

        fireEvent.click(screen.getByRole('button'));

        expect(imageCollapseHandler).toHaveBeenCalled();
    });

    it('should emit toggle action on expand button click', () => {
        const toggleHandler = vi.fn();
        const imageCollapseHandler = vi.fn();
        render(
            <MarkdownImageExpand
                alt={'Some alt text'}
                postId={'abc'}
                isExpanded={false}
                imageKey={'1'}
                onToggle={toggleHandler}
                toggleInlineImageVisibility={imageCollapseHandler}
            >{'An image to expand'}</MarkdownImageExpand>,
        );

        fireEvent.click(screen.getByRole('button'));

        expect(imageCollapseHandler).toHaveBeenCalled();
    });
});
