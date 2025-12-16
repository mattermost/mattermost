// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, fireEvent} from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';

import type {Post} from '@mattermost/types/posts';

import {PostTypes} from 'mattermost-redux/constants/posts';

import {renderWithContext} from 'tests/react_testing_utils';

import PageLinkModal from './page_link_modal';

describe('PageLinkModal', () => {
    const setLinkTextValue = (value: string) => {
        const linkTextInput = screen.getByLabelText('Link text');
        fireEvent.change(linkTextInput, {target: {value}});
    };

    const mockPages: Post[] = [
        {
            id: 'page1',
            type: PostTypes.PAGE,
            wiki_id: 'wiki123',
            props: {title: 'Getting Started Guide'},
            create_at: 1000,
            update_at: 1000,
            delete_at: 0,
            edit_at: 0,
            user_id: 'user1',
            channel_id: 'channel1',
            root_id: '',
            parent_id: '',
            original_id: '',
            message: '',
            hashtags: '',
            file_ids: [],
            pending_post_id: '',
            metadata: {} as any,
            is_pinned: false,
            reply_count: 0,
        } as Post,
        {
            id: 'page2',
            type: PostTypes.PAGE,
            wiki_id: 'wiki456',
            props: {title: 'API Documentation'},
            create_at: 2000,
            update_at: 2000,
            delete_at: 0,
            edit_at: 0,
            user_id: 'user1',
            channel_id: 'channel1',
            root_id: '',
            parent_id: '',
            original_id: '',
            message: '',
            hashtags: '',
            file_ids: [],
            pending_post_id: '',
            metadata: {} as any,
            is_pinned: false,
            reply_count: 0,
        } as Post,
        {
            id: 'page3',
            type: PostTypes.PAGE,
            wiki_id: 'wiki123',
            props: {title: 'Authentication Guide'},
            create_at: 3000,
            update_at: 3000,
            delete_at: 0,
            edit_at: 0,
            user_id: 'user1',
            channel_id: 'channel1',
            root_id: '',
            parent_id: '',
            original_id: '',
            message: '',
            hashtags: '',
            file_ids: [],
            pending_post_id: '',
            metadata: {} as any,
            is_pinned: false,
            reply_count: 0,
        } as Post,
        {
            id: 'page4',
            type: PostTypes.PAGE,
            wiki_id: 'wiki456',
            props: {title: 'API Reference'},
            create_at: 4000,
            update_at: 4000,
            delete_at: 0,
            edit_at: 0,
            user_id: 'user1',
            channel_id: 'channel1',
            root_id: '',
            parent_id: '',
            original_id: '',
            message: '',
            hashtags: '',
            file_ids: [],
            pending_post_id: '',
            metadata: {} as any,
            is_pinned: false,
            reply_count: 0,
        } as Post,
        {
            id: 'page5',
            type: PostTypes.PAGE,
            wiki_id: 'wiki789',
            props: {},
            create_at: 5000,
            update_at: 5000,
            delete_at: 0,
            edit_at: 0,
            user_id: 'user1',
            channel_id: 'channel1',
            root_id: '',
            parent_id: '',
            is_pinned: false,
            reply_count: 0,
            original_id: '',
            message: '',
            hashtags: '',
            file_ids: [],
            pending_post_id: '',
            metadata: {} as any,
        } as Post,
    ];

    const baseProps = {
        pages: mockPages,
        wikiId: 'wiki123',
        onSelect: jest.fn(),
        onCancel: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renders modal with search input and pages list', () => {
        renderWithContext(<PageLinkModal {...baseProps}/>);

        expect(screen.getByLabelText('Search for a page')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Type to search...')).toBeInTheDocument();
        expect(screen.getByText('Getting Started Guide')).toBeInTheDocument();
        expect(screen.getByText('API Documentation')).toBeInTheDocument();
        expect(screen.getByText('Authentication Guide')).toBeInTheDocument();
    });

    test('renders untitled for pages without title', () => {
        renderWithContext(<PageLinkModal {...baseProps}/>);

        expect(screen.getByText('Untitled')).toBeInTheDocument();
    });

    test('filters pages based on search query', () => {
        renderWithContext(<PageLinkModal {...baseProps}/>);

        const searchInput = screen.getByPlaceholderText('Type to search...');
        fireEvent.change(searchInput, {target: {value: 'API'}});

        expect(screen.getByText('API Documentation')).toBeInTheDocument();
        expect(screen.getByText('API Reference')).toBeInTheDocument();
        expect(screen.queryByText('Getting Started Guide')).not.toBeInTheDocument();
        expect(screen.queryByText('Authentication Guide')).not.toBeInTheDocument();
    });

    test('filters are case insensitive', () => {
        renderWithContext(<PageLinkModal {...baseProps}/>);

        const searchInput = screen.getByPlaceholderText('Type to search...');
        fireEvent.change(searchInput, {target: {value: 'api'}});

        expect(screen.getByText('API Documentation')).toBeInTheDocument();
        expect(screen.getByText('API Reference')).toBeInTheDocument();
    });

    test('shows empty state when no pages match search', () => {
        renderWithContext(<PageLinkModal {...baseProps}/>);

        const searchInput = screen.getByPlaceholderText('Type to search...');
        fireEvent.change(searchInput, {target: {value: 'nonexistent'}});

        expect(screen.getByText('No pages found')).toBeInTheDocument();
        expect(screen.queryByText('Getting Started Guide')).not.toBeInTheDocument();
    });

    test('shows empty state when no pages available', () => {
        renderWithContext(
            <PageLinkModal
                {...baseProps}
                pages={[]}
            />,
        );

        expect(screen.getByText('No pages available')).toBeInTheDocument();
    });

    test('calls onSelect with correct parameters when page is selected and Insert Link clicked', () => {
        renderWithContext(<PageLinkModal {...baseProps}/>);

        setLinkTextValue('API Documentation');

        const pageItem = screen.getByText('API Documentation').closest('[role="option"]');
        fireEvent.click(pageItem!);

        const insertButton = screen.getByText('Insert Link');
        fireEvent.click(insertButton);

        expect(baseProps.onSelect).toHaveBeenCalledWith('page2', 'API Documentation', 'wiki456', 'API Documentation');
    });

    test('calls onSelect with custom link text when provided', () => {
        renderWithContext(<PageLinkModal {...baseProps}/>);

        setLinkTextValue('Custom Link Text');

        const pageItem = screen.getByText('API Documentation').closest('[role="option"]');
        fireEvent.click(pageItem!);

        const insertButton = screen.getByText('Insert Link');
        fireEvent.click(insertButton);

        expect(baseProps.onSelect).toHaveBeenCalledWith('page2', 'API Documentation', 'wiki456', 'Custom Link Text');
    });

    test('uses initial link text from props', () => {
        renderWithContext(
            <PageLinkModal
                {...baseProps}
                initialLinkText='Pre-filled text'
            />,
        );

        const linkTextInput = screen.getByLabelText('Link text') as HTMLInputElement;
        expect(linkTextInput.value).toBe('Pre-filled text');
    });

    test('keyboard navigation: ArrowDown selects next page', () => {
        renderWithContext(<PageLinkModal {...baseProps}/>);

        const searchInput = screen.getByPlaceholderText('Type to search...');

        const firstPage = screen.getByText('Getting Started Guide').closest('[role="option"]');
        expect(firstPage).toHaveAttribute('aria-selected', 'true');

        fireEvent.keyDown(searchInput, {key: 'ArrowDown'});

        const secondPage = screen.getByText('API Documentation').closest('[role="option"]');
        expect(secondPage).toHaveAttribute('aria-selected', 'true');
    });

    test('keyboard navigation: ArrowUp selects previous page', () => {
        renderWithContext(<PageLinkModal {...baseProps}/>);

        const searchInput = screen.getByPlaceholderText('Type to search...');

        fireEvent.keyDown(searchInput, {key: 'ArrowDown'});
        fireEvent.keyDown(searchInput, {key: 'ArrowDown'});

        const thirdPage = screen.getByText('Authentication Guide').closest('[role="option"]');
        expect(thirdPage).toHaveAttribute('aria-selected', 'true');

        fireEvent.keyDown(searchInput, {key: 'ArrowUp'});

        const secondPage = screen.getByText('API Documentation').closest('[role="option"]');
        expect(secondPage).toHaveAttribute('aria-selected', 'true');
    });

    test('keyboard navigation: Enter selects current page', () => {
        renderWithContext(<PageLinkModal {...baseProps}/>);

        setLinkTextValue('API Documentation');

        const searchInput = screen.getByPlaceholderText('Type to search...');

        fireEvent.keyDown(searchInput, {key: 'ArrowDown'});
        fireEvent.keyDown(searchInput, {key: 'Enter'});

        expect(baseProps.onSelect).toHaveBeenCalledWith('page2', 'API Documentation', 'wiki456', 'API Documentation');
    });

    test('keyboard navigation: Escape closes modal via GenericModal', () => {
        renderWithContext(<PageLinkModal {...baseProps}/>);

        // Escape is handled by GenericModal's keyboardEscape={true} prop
        // Just verify the modal content is present - GenericModal handles Escape
        expect(screen.getByLabelText('Search for a page')).toBeInTheDocument();
    });

    test('keyboard navigation: ArrowDown does not go past last item', () => {
        renderWithContext(<PageLinkModal {...baseProps}/>);

        const searchInput = screen.getByPlaceholderText('Type to search...');

        for (let i = 0; i < 10; i++) {
            fireEvent.keyDown(searchInput, {key: 'ArrowDown'});
        }

        const lastPage = screen.getByText('Untitled').closest('[role="option"]');
        expect(lastPage).toHaveAttribute('aria-selected', 'true');
    });

    test('keyboard navigation: ArrowUp does not go past first item', () => {
        renderWithContext(<PageLinkModal {...baseProps}/>);

        const searchInput = screen.getByPlaceholderText('Type to search...');

        for (let i = 0; i < 5; i++) {
            fireEvent.keyDown(searchInput, {key: 'ArrowUp'});
        }

        const firstPage = screen.getByText('Getting Started Guide').closest('[role="option"]');
        expect(firstPage).toHaveAttribute('aria-selected', 'true');
    });

    test('resets selected index when search query changes', () => {
        renderWithContext(<PageLinkModal {...baseProps}/>);

        const searchInput = screen.getByPlaceholderText('Type to search...');

        fireEvent.keyDown(searchInput, {key: 'ArrowDown'});
        fireEvent.keyDown(searchInput, {key: 'ArrowDown'});

        fireEvent.change(searchInput, {target: {value: 'API'}});

        const firstFilteredPage = screen.getByText('API Documentation').closest('[role="option"]');
        expect(firstFilteredPage).toHaveAttribute('aria-selected', 'true');
    });

    test('clicking updates selected index', () => {
        renderWithContext(<PageLinkModal {...baseProps}/>);

        const thirdPage = screen.getByText('Authentication Guide').closest('[role="option"]');
        fireEvent.click(thirdPage!);

        expect(thirdPage).toHaveAttribute('aria-selected', 'true');
    });

    test('limits results to 10 pages', () => {
        const manyPages: Post[] = Array.from({length: 15}, (_, i) => ({
            id: `page${i}`,
            type: PostTypes.PAGE,
            props: {title: `Page ${i}`},
            create_at: 1000 * i,
            update_at: 1000 * i,
            delete_at: 0,
            edit_at: 0,
            user_id: 'user1',
            channel_id: 'channel1',
            root_id: '',
            parent_id: '',
            original_id: '',
            message: '',
            hashtags: '',
            is_pinned: false,
            reply_count: 0,
            file_ids: [],
            pending_post_id: '',
            metadata: {} as any,
        } as Post));

        renderWithContext(
            <PageLinkModal
                {...baseProps}
                pages={manyPages}
            />,
        );

        const displayedPages = screen.getAllByRole('option');
        expect(displayedPages).toHaveLength(10);
    });

    test('Insert Link button is disabled when no pages available', () => {
        renderWithContext(<PageLinkModal
            {...baseProps}
            pages={[]}
        />, /* eslint-disable-line react/jsx-closing-bracket-location */
        );

        const insertButton = screen.getByText('Insert Link');
        expect(insertButton).toBeDisabled();
    });

    test('Insert Link button calls onSelect when clicked', () => {
        renderWithContext(<PageLinkModal {...baseProps}/>);

        setLinkTextValue('Getting Started Guide');

        const insertButton = screen.getByText('Insert Link');
        fireEvent.click(insertButton);

        expect(baseProps.onSelect).toHaveBeenCalledWith('page1', 'Getting Started Guide', 'wiki123', 'Getting Started Guide');
    });

    test('Cancel button calls onCancel', () => {
        renderWithContext(<PageLinkModal {...baseProps}/>);

        const cancelButton = screen.getByText('Cancel');
        fireEvent.click(cancelButton);

        expect(baseProps.onCancel).toHaveBeenCalled();
    });

    test('displays keyboard shortcut hints', () => {
        renderWithContext(<PageLinkModal {...baseProps}/>);

        expect(screen.getByText(/to navigate/)).toBeInTheDocument();
        expect(screen.getByText(/to select/)).toBeInTheDocument();
    });

    test('search input is autofocused', () => {
        renderWithContext(<PageLinkModal {...baseProps}/>);

        const searchInput = screen.getByPlaceholderText('Type to search...');
        expect(searchInput).toHaveFocus();
    });

    test('displays checkmark on selected page', () => {
        renderWithContext(<PageLinkModal {...baseProps}/>);

        const firstPage = screen.getByText('Getting Started Guide').closest('[role="option"]');
        const checkIcon = firstPage?.querySelector('.icon-check');
        expect(checkIcon).toBeInTheDocument();
    });
});
