// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import {BlockSwitch, ContainerBlock} from './layout_blocks';

jest.mock('components/markdown', () => ({
    __esModule: true,
    default: jest.fn((props: {message: string}) => (
        <div data-testid='markdown-mock'>{props.message}</div>
    )),
}));

describe('BlockSwitch', () => {
    const onAction = jest.fn();

    beforeEach(() => {
        onAction.mockClear();
    });

    it('returns null for unknown block types', () => {
        const {container} = renderWithContext(
            <BlockSwitch
                block={{type: 'future_block'} as never}
                postId='post-1'
                onAction={onAction}
            />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('renders a button block', () => {
        renderWithContext(
            <BlockSwitch
                block={{type: 'button', text: 'Go', action_id: 'go'}}
                postId='post-1'
                onAction={onAction}
            />,
        );
        expect(screen.getByRole('button', {name: 'Go'})).toBeInTheDocument();
    });

    it('renders column_set with column content', () => {
        const {container} = renderWithContext(
            <BlockSwitch
                block={{
                    type: 'column_set',
                    columns: [
                        {
                            type: 'column',
                            width: 'stretch',
                            items: [{type: 'text', text: 'Left col'}],
                        },
                        {
                            type: 'column',
                            width: 'auto',
                            items: [{type: 'text', text: 'Right col'}],
                        },
                    ],
                }}
                postId='post-1'
                onAction={onAction}
            />,
        );

        expect(container.querySelector('.mm-blocks-column-set')).toBeInTheDocument();
        expect(screen.getByText('Left col')).toBeInTheDocument();
        expect(screen.getByText('Right col')).toBeInTheDocument();
    });

    it('applies column_set gap class (defaults to medium)', () => {
        const {container} = renderWithContext(
            <BlockSwitch
                block={{
                    type: 'column_set',
                    columns: [
                        {type: 'column', items: [{type: 'text', text: 'A'}]},
                        {type: 'column', items: [{type: 'text', text: 'B'}]},
                    ],
                }}
                postId='post-1'
                onAction={onAction}
            />,
        );

        expect(container.querySelector('.mm-blocks-column-set--gap-medium')).toBeInTheDocument();
    });

    it('applies column_set gap class from block gap', () => {
        const {container} = renderWithContext(
            <BlockSwitch
                block={{
                    type: 'column_set',
                    gap: 'none',
                    columns: [
                        {type: 'column', items: [{type: 'text', text: 'A'}]},
                        {type: 'column', items: [{type: 'text', text: 'B'}]},
                    ],
                }}
                postId='post-1'
                onAction={onAction}
            />,
        );

        expect(container.querySelector('.mm-blocks-column-set--gap-none')).toBeInTheDocument();
        expect(container.querySelector('.mm-blocks-column-set--gap-medium')).not.toBeInTheDocument();
    });

    it('defaults collapsible to collapsed when collapsed is omitted', () => {
        renderWithContext(
            <BlockSwitch
                block={{
                    type: 'collapsible',
                    header: [{type: 'text', text: 'Header line'}],
                    content: [{type: 'text', text: 'Hidden body'}],
                }}
                postId='post-collapse-default'
                onAction={onAction}
            />,
        );

        expect(screen.getByRole('button', {expanded: false})).toBeInTheDocument();
        expect(document.getElementById('mm-blocks-collapsible-content-post-collapse-default')).toHaveAttribute('aria-hidden', 'true');
    });

    it('toggles collapsible content on header click', async () => {
        const user = userEvent.setup();
        renderWithContext(
            <BlockSwitch
                block={{
                    type: 'collapsible',
                    collapsed: true,
                    header: [{type: 'text', text: 'Header line'}],
                    content: [{type: 'text', text: 'Hidden body'}],
                }}
                postId='post-collapse'
                onAction={onAction}
            />,
        );

        const toggle = screen.getByRole('button', {expanded: false});
        const content = document.getElementById('mm-blocks-collapsible-content-post-collapse');
        expect(content).toHaveAttribute('aria-hidden', 'true');
        expect(toggle.closest('.mm-blocks-collapsible')).not.toHaveClass('mm-blocks-collapsible--expanded');

        await user.click(screen.getByText('Header line'));
        expect(screen.getByRole('button', {expanded: true})).toBeInTheDocument();
        expect(content).toHaveAttribute('aria-hidden', 'false');
        expect(toggle.closest('.mm-blocks-collapsible')).toHaveClass('mm-blocks-collapsible--expanded');
        expect(screen.getByText('Hidden body')).toBeInTheDocument();
    });

    it('does not toggle collapsible when clicking an interactive header element', async () => {
        const user = userEvent.setup();
        renderWithContext(
            <BlockSwitch
                block={{
                    type: 'collapsible',
                    collapsed: true,
                    header: [{type: 'button', text: 'Header action', action_id: 'header_action'}],
                    content: [{type: 'text', text: 'Hidden body'}],
                }}
                postId='post-collapse-action'
                onAction={onAction}
            />,
        );

        await user.click(screen.getByRole('button', {name: 'Header action'}));

        expect(screen.getByRole('button', {expanded: false})).toBeInTheDocument();
        expect(document.getElementById('mm-blocks-collapsible-content-post-collapse-action')).toHaveAttribute('aria-hidden', 'true');
        expect(onAction).toHaveBeenCalledWith('header_action', undefined, undefined, undefined);
    });
});

describe('ContainerBlock', () => {
    const onAction = jest.fn();

    beforeEach(() => {
        onAction.mockClear();
    });

    it('returns null when content is empty', () => {
        const {container} = renderWithContext(
            <ContainerBlock
                block={{type: 'container', content: []}}
                postId='post-1'
                onAction={onAction}
            />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('applies horizontal flow class and row divider orientation', () => {
        const {container} = renderWithContext(
            <ContainerBlock
                block={{
                    type: 'container',
                    flow: 'horizontal',
                    content: [
                        {type: 'text', text: 'A'},
                        {type: 'divider'},
                        {type: 'text', text: 'B'},
                    ],
                }}
                postId='post-1'
                onAction={onAction}
            />,
        );

        expect(container.querySelector('.mm-blocks-container--flow-horizontal')).toBeInTheDocument();
        expect(screen.getByRole('separator')).toHaveAttribute('aria-orientation', 'vertical');
    });

    it('applies accent border and semantic accent on bordered accent containers', () => {
        const {container} = renderWithContext(
            <ContainerBlock
                block={{
                    type: 'container',
                    border: true,
                    accent_color: 'good',
                    content: [{type: 'text', text: 'Inside accent'}],
                }}
                postId='post-1'
                onAction={onAction}
            />,
        );

        const accentContainer = container.querySelector(
            '.mm-blocks-container.mm-blocks-container--accent.mm-blocks-container--accent-border.mm-blocks-container--accent-good',
        );
        expect(accentContainer).toBeInTheDocument();
        expect(screen.getByText('Inside accent')).toBeInTheDocument();
    });

    it('uses custom hex accent as inline border color', () => {
        const {container} = renderWithContext(
            <ContainerBlock
                block={{
                    type: 'container',
                    accent_color: '#ff00aa',
                    content: [{type: 'text', text: 'Custom color'}],
                }}
                postId='post-1'
                onAction={onAction}
            />,
        );

        const inner = container.querySelector('.mm-blocks-container--accent-custom') as HTMLElement;
        expect(inner.style.getPropertyValue('--mm-blocks-accent-color')).toBe('#ff00aa');
    });

    it('uses max-height-none by default without a scroll region', () => {
        const {container} = renderWithContext(
            <ContainerBlock
                block={{
                    type: 'container',
                    content: [{type: 'text', text: 'No cap'}],
                }}
                postId='post-1'
                onAction={onAction}
            />,
        );

        expect(container.querySelector('.mm-blocks-container--max-height-none')).toBeInTheDocument();
        expect(screen.queryByRole('region', {name: 'Scrollable content'})).not.toBeInTheDocument();
    });

    it('adds scroll region when max_height is set', () => {
        renderWithContext(
            <ContainerBlock
                block={{
                    type: 'container',
                    max_height: 'small',
                    content: [{type: 'text', text: 'Scroll me'}],
                }}
                postId='post-1'
                onAction={onAction}
            />,
        );

        expect(screen.getByRole('region', {name: 'Scrollable content'})).toBeInTheDocument();
        expect(screen.getByText('Scroll me')).toBeInTheDocument();
    });
});
