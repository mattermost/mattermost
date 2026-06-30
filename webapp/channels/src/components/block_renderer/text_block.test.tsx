// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import {MmBlocksInlineMarkdownActionsContext} from './context';
import {TextBlock} from './text_block';

jest.mock('components/markdown', () => ({
    __esModule: true,
    default: jest.fn((props: {
        message: string;
        postId: string;
        mmBlocksActionCookie?: string;
        integrationFormat?: string;
    }) => (
        <div data-testid='markdown-mock'>
            <span data-testid='markdown-message'>{props.message}</span>
            <span data-testid='markdown-cookie'>{props.mmBlocksActionCookie ?? ''}</span>
            <span data-testid='markdown-format'>{props.integrationFormat ?? ''}</span>
        </div>
    )),
}));

describe('TextBlock', () => {
    it('returns null when text is empty', () => {
        const {container} = renderWithContext(
            <TextBlock
                block={{type: 'text', text: ''}}
                postId='post-1'
            />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('renders markdown with message and subtle/small classes', () => {
        renderWithContext(
            <TextBlock
                block={{type: 'text', text: 'Hello **world**', is_subtle: true, size: 'small'}}
                postId='post-1'
            />,
        );

        expect(screen.getByTestId('markdown-mock')).toBeInTheDocument();
        expect(screen.getByTestId('markdown-message')).toHaveTextContent('Hello **world**');
        expect(screen.getByTestId('markdown-mock').parentElement).toHaveClass('mm-blocks-text--subtle', 'mm-blocks-text--small');
    });

    it('passes inline markdown action cookie and format from context', () => {
        renderWithContext(
            <MmBlocksInlineMarkdownActionsContext.Provider
                value={{
                    mmBlocksActionCookie: 'encrypted-cookie',
                    integrationFormat: 'mm_block',
                }}
            >
                <TextBlock
                    block={{type: 'text', text: 'Action text'}}
                    postId='post-1'
                />
            </MmBlocksInlineMarkdownActionsContext.Provider>,
        );

        expect(screen.getByTestId('markdown-cookie')).toHaveTextContent('encrypted-cookie');
        expect(screen.getByTestId('markdown-format')).toHaveTextContent('mm_block');
    });
});
