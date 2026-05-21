// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import {TextBlock} from './text_block';

jest.mock('components/markdown', () => ({
    __esModule: true,
    default: jest.fn((props: {message: string; postId: string; onMmBlocksMarkdownAction?: (id: string, q: Record<string, string>) => void}) => (
        <div data-testid='markdown-mock'>
            <span data-testid='markdown-message'>{props.message}</span>
            <button
                type='button'
                data-testid='markdown-action'
                onClick={() => props.onMmBlocksMarkdownAction?.('md_action', {k: 'v'})}
            >
                {'md_action'}
            </button>
        </div>
    )),
}));

describe('TextBlock', () => {
    const onAction = jest.fn();

    beforeEach(() => {
        onAction.mockClear();
    });

    it('returns null when text is empty', () => {
        const {container} = renderWithContext(
            <TextBlock
                block={{type: 'text', text: ''}}
                postId='post-1'
                onAction={onAction}
            />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('renders markdown with message and subtle/small classes', () => {
        renderWithContext(
            <TextBlock
                block={{type: 'text', text: 'Hello **world**', is_subtle: true, size: 'small'}}
                postId='post-1'
                onAction={onAction}
            />,
        );

        expect(screen.getByTestId('markdown-mock')).toBeInTheDocument();
        expect(screen.getByTestId('markdown-message')).toHaveTextContent('Hello **world**');
        expect(screen.getByTestId('markdown-mock').parentElement).toHaveClass('mm-blocks-text--subtle', 'mm-blocks-text--small');
    });

    it('forwards markdown action clicks to onAction', () => {
        renderWithContext(
            <TextBlock
                block={{type: 'text', text: 'Action text'}}
                postId='post-1'
                onAction={onAction}
            />,
        );

        screen.getByTestId('markdown-action').click();
        expect(onAction).toHaveBeenCalledWith('md_action', undefined, {k: 'v'}, undefined);
    });
});
