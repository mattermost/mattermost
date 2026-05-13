// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, userEvent} from 'tests/react_testing_utils';

import MarkdownImageExpand from './markdown_image_expand';

describe('components/MarkdownImageExpand', () => {
    it('should match snapshot for collapsed embeds', () => {
        const toggleHandler = jest.fn();
        const imageCollapseHandler = jest.fn();
        const {container} = renderWithContext(
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
        const toggleHandler = jest.fn();
        const imageCollapseHandler = jest.fn();
        const {container} = renderWithContext(
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

    it('should emit toggle action on collapse button click', async () => {
        const toggleHandler = jest.fn();
        const imageCollapseHandler = jest.fn();
        const {container} = renderWithContext(
            <MarkdownImageExpand
                alt={'Some alt text'}
                postId={'abc'}
                isExpanded={true}
                imageKey={'1'}
                onToggle={toggleHandler}
                toggleInlineImageVisibility={imageCollapseHandler}
            >{'An image to expand'}</MarkdownImageExpand>,
        );

        const collapseButton = container.querySelector('.markdown-image-expand__collapse-button')!;
        await userEvent.click(collapseButton);

        expect(imageCollapseHandler).toHaveBeenCalled();
    });

    it('should emit toggle action on expand button click', async () => {
        const toggleHandler = jest.fn();
        const imageCollapseHandler = jest.fn();
        const {container} = renderWithContext(
            <MarkdownImageExpand
                alt={'Some alt text'}
                postId={'abc'}
                isExpanded={false}
                imageKey={'1'}
                onToggle={toggleHandler}
                toggleInlineImageVisibility={imageCollapseHandler}
            >{'An image to expand'}</MarkdownImageExpand>,
        );

        const expandButton = container.querySelector('.markdown-image-expand__expand-button')!;
        await userEvent.click(expandButton);

        expect(imageCollapseHandler).toHaveBeenCalled();
    });
});
