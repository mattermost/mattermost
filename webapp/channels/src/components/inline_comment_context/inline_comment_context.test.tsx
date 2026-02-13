// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen, fireEvent} from '@testing-library/react';
import React from 'react';
import {Provider} from 'react-redux';

import mockStore from 'tests/test_store';

import InlineCommentContext from './inline_comment_context';

const mockPush = jest.fn();
jest.mock('utils/browser_history', () => ({
    getHistory: () => ({push: mockPush}),
}));

jest.mock('actions/views/rhs', () => ({
    selectPostById: jest.fn((id) => ({type: 'SELECT_POST_BY_ID', id})),
}));

describe('InlineCommentContext', () => {
    const store = mockStore({});

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('rendering', () => {
        it('should render anchor text in compact variant', () => {
            render(
                <Provider store={store}>
                    <InlineCommentContext anchorText='Sample anchor text'/>
                </Provider>,
            );

            expect(screen.getByText('Sample anchor text')).toBeInTheDocument();
        });

        it('should render anchor text in banner variant', () => {
            render(
                <Provider store={store}>
                    <InlineCommentContext
                        anchorText='Banner text'
                        variant='banner'
                    />
                </Provider>,
            );

            expect(screen.getByText('"Banner text"')).toBeInTheDocument();
            expect(screen.getByText('Comments on:')).toBeInTheDocument();
        });

        it('should include data-anchor-id attribute when anchorId provided', () => {
            render(
                <Provider store={store}>
                    <InlineCommentContext
                        anchorText='Test'
                        anchorId='abc123'
                    />
                </Provider>,
            );

            const box = screen.getByText('Test').closest('.inline-comment-anchor-box');
            expect(box).toHaveAttribute('data-anchor-id', 'abc123');
        });
    });

    describe('clickability', () => {
        it('should NOT be clickable when no pageUrl or onClick provided', () => {
            render(
                <Provider store={store}>
                    <InlineCommentContext anchorText='Non-clickable'/>
                </Provider>,
            );

            const box = screen.getByText('Non-clickable').closest('.inline-comment-anchor-box');
            expect(box).not.toHaveClass('clickable');
            expect(box).not.toHaveAttribute('role', 'button');
            expect(box).not.toHaveAttribute('tabIndex');
        });

        it('should be clickable when pageUrl provided', () => {
            render(
                <Provider store={store}>
                    <InlineCommentContext
                        anchorText='Clickable'
                        pageUrl='/team/wiki/page'
                    />
                </Provider>,
            );

            const box = screen.getByText('Clickable').closest('.inline-comment-anchor-box');
            expect(box).toHaveClass('clickable');
            expect(box).toHaveAttribute('role', 'button');
            expect(box).toHaveAttribute('tabIndex', '0');
        });

        it('should be clickable when onClick provided', () => {
            const onClick = jest.fn();
            render(
                <Provider store={store}>
                    <InlineCommentContext
                        anchorText='Clickable'
                        onClick={onClick}
                    />
                </Provider>,
            );

            const box = screen.getByText('Clickable').closest('.inline-comment-anchor-box');
            expect(box).toHaveClass('clickable');
        });

        it('should show arrow icon when clickable', () => {
            render(
                <Provider store={store}>
                    <InlineCommentContext
                        anchorText='With arrow'
                        pageUrl='/test'
                    />
                </Provider>,
            );

            const arrow = document.querySelector('.icon-arrow-right');
            expect(arrow).toBeInTheDocument();
        });

        it('should NOT show arrow icon when not clickable', () => {
            render(
                <Provider store={store}>
                    <InlineCommentContext anchorText='No arrow'/>
                </Provider>,
            );

            const arrow = document.querySelector('.icon-arrow-right');
            expect(arrow).not.toBeInTheDocument();
        });
    });

    describe('click handling', () => {
        it('should call onClick handler when provided', () => {
            const onClick = jest.fn();
            render(
                <Provider store={store}>
                    <InlineCommentContext
                        anchorText='Test'
                        onClick={onClick}
                    />
                </Provider>,
            );

            const box = screen.getByText('Test').closest('.inline-comment-anchor-box')!;
            fireEvent.click(box);

            expect(onClick).toHaveBeenCalledTimes(1);
        });

        it('should navigate to pageUrl when clicked', () => {
            render(
                <Provider store={store}>
                    <InlineCommentContext
                        anchorText='Test'
                        pageUrl='/team/wiki/page#ic-abc123'
                    />
                </Provider>,
            );

            const box = screen.getByText('Test').closest('.inline-comment-anchor-box')!;
            fireEvent.click(box);

            expect(mockPush).toHaveBeenCalledWith('/team/wiki/page#ic-abc123');
        });

        it('should prefer onClick over pageUrl navigation', () => {
            const onClick = jest.fn();
            render(
                <Provider store={store}>
                    <InlineCommentContext
                        anchorText='Test'
                        pageUrl='/should/not/navigate'
                        onClick={onClick}
                    />
                </Provider>,
            );

            const box = screen.getByText('Test').closest('.inline-comment-anchor-box')!;
            fireEvent.click(box);

            expect(onClick).toHaveBeenCalled();
            expect(mockPush).not.toHaveBeenCalled();
        });
    });

    describe('keyboard navigation', () => {
        it('should trigger click on Enter key', () => {
            const onClick = jest.fn();
            render(
                <Provider store={store}>
                    <InlineCommentContext
                        anchorText='Test'
                        onClick={onClick}
                    />
                </Provider>,
            );

            const box = screen.getByText('Test').closest('.inline-comment-anchor-box')!;
            fireEvent.keyDown(box, {key: 'Enter'});

            expect(onClick).toHaveBeenCalled();
        });

        it('should trigger click on Space key', () => {
            const onClick = jest.fn();
            render(
                <Provider store={store}>
                    <InlineCommentContext
                        anchorText='Test'
                        onClick={onClick}
                    />
                </Provider>,
            );

            const box = screen.getByText('Test').closest('.inline-comment-anchor-box')!;
            fireEvent.keyDown(box, {key: ' '});

            expect(onClick).toHaveBeenCalled();
        });

        it('should NOT trigger click on other keys', () => {
            const onClick = jest.fn();
            render(
                <Provider store={store}>
                    <InlineCommentContext
                        anchorText='Test'
                        onClick={onClick}
                    />
                </Provider>,
            );

            const box = screen.getByText('Test').closest('.inline-comment-anchor-box')!;
            fireEvent.keyDown(box, {key: 'Tab'});
            fireEvent.keyDown(box, {key: 'Escape'});
            fireEvent.keyDown(box, {key: 'a'});

            expect(onClick).not.toHaveBeenCalled();
        });
    });

    describe('accessibility', () => {
        it('should have aria-label when clickable', () => {
            render(
                <Provider store={store}>
                    <InlineCommentContext
                        anchorText='Important text'
                        pageUrl='/test'
                    />
                </Provider>,
            );

            const box = screen.getByText('Important text').closest('.inline-comment-anchor-box');
            expect(box).toHaveAttribute('aria-label', 'Go to commented text: Important text');
        });

        it('should NOT have aria-label when not clickable', () => {
            render(
                <Provider store={store}>
                    <InlineCommentContext anchorText='Static text'/>
                </Provider>,
            );

            const box = screen.getByText('Static text').closest('.inline-comment-anchor-box');
            expect(box).not.toHaveAttribute('aria-label');
        });

        it('should hide arrow icon from screen readers', () => {
            render(
                <Provider store={store}>
                    <InlineCommentContext
                        anchorText='Test'
                        pageUrl='/test'
                    />
                </Provider>,
            );

            const arrow = document.querySelector('.icon-arrow-right');
            expect(arrow).toHaveAttribute('aria-hidden', 'true');
        });
    });

    describe('banner variant', () => {
        it('should render with banner class', () => {
            render(
                <Provider store={store}>
                    <InlineCommentContext
                        anchorText='Banner text'
                        variant='banner'
                    />
                </Provider>,
            );

            const banner = document.querySelector('.inline-comment-anchor-banner');
            expect(banner).toBeInTheDocument();
        });

        it('should be clickable in banner variant', () => {
            render(
                <Provider store={store}>
                    <InlineCommentContext
                        anchorText='Banner text'
                        variant='banner'
                        pageUrl='/test'
                    />
                </Provider>,
            );

            const banner = document.querySelector('.inline-comment-anchor-banner');
            expect(banner).toHaveClass('clickable');
        });
    });
});
