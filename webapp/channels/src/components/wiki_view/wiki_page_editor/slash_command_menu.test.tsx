// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen, fireEvent, waitFor, act} from '@testing-library/react';
import React, {createRef} from 'react';

import type {FormattingAction} from './formatting_actions';
import SlashCommandMenu from './slash_command_menu';
import type {SlashCommandMenuRef} from './slash_command_menu';

// Mock scrollIntoView since JSDOM doesn't support it
Element.prototype.scrollIntoView = jest.fn();

describe('components/wiki_view/wiki_page_editor/SlashCommandMenu', () => {
    const mockItems: FormattingAction[] = [
        {id: 'heading1', title: 'Heading 1', description: 'Large heading', icon: 'icon-heading-1', command: jest.fn(), category: 'block'},
        {id: 'heading2', title: 'Heading 2', description: 'Medium heading', icon: 'icon-heading-2', command: jest.fn(), category: 'block'},
        {id: 'paragraph', title: 'Paragraph', description: 'Plain text', icon: 'icon-paragraph', command: jest.fn(), category: 'text'},
    ];

    const mockCommand = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renders no results message when items array is empty', () => {
        render(
            <SlashCommandMenu
                items={[]}
                command={mockCommand}
            />,
        );

        expect(screen.getByText('No results found')).toBeInTheDocument();
    });

    test('renders menu items when items are provided', () => {
        render(
            <SlashCommandMenu
                items={mockItems}
                command={mockCommand}
            />,
        );

        expect(screen.getByText('Heading 1')).toBeInTheDocument();
        expect(screen.getByText('Heading 2')).toBeInTheDocument();
        expect(screen.getByText('Paragraph')).toBeInTheDocument();
    });

    test('first item is selected by default', () => {
        render(
            <SlashCommandMenu
                items={mockItems}
                command={mockCommand}
            />,
        );

        const buttons = screen.getAllByRole('button');
        expect(buttons[0]).toHaveClass('selected');
        expect(buttons[1]).not.toHaveClass('selected');
    });

    test('calls command with item when item is clicked', () => {
        render(
            <SlashCommandMenu
                items={mockItems}
                command={mockCommand}
            />,
        );

        const secondItem = screen.getByText('Heading 2');
        fireEvent.click(secondItem);

        expect(mockCommand).toHaveBeenCalledWith(mockItems[1]);
    });

    test('keyboard navigation - ArrowDown moves selection down', async () => {
        const ref = createRef<SlashCommandMenuRef>();
        render(
            <SlashCommandMenu
                ref={ref}
                items={mockItems}
                command={mockCommand}
            />,
        );

        await act(async () => {
            ref.current?.onKeyDown(new KeyboardEvent('keydown', {key: 'ArrowDown'}));
        });

        await waitFor(() => {
            const buttons = screen.getAllByRole('button');
            expect(buttons[1]).toHaveClass('selected');
        });
    });

    test('keyboard navigation - ArrowUp moves selection up from second item', async () => {
        const ref = createRef<SlashCommandMenuRef>();
        render(
            <SlashCommandMenu
                ref={ref}
                items={mockItems}
                command={mockCommand}
            />,
        );

        // First move down to second item
        await act(async () => {
            ref.current?.onKeyDown(new KeyboardEvent('keydown', {key: 'ArrowDown'}));
        });

        // Then move up
        await act(async () => {
            ref.current?.onKeyDown(new KeyboardEvent('keydown', {key: 'ArrowUp'}));
        });

        await waitFor(() => {
            const buttons = screen.getAllByRole('button');
            expect(buttons[0]).toHaveClass('selected');
        });
    });

    test('keyboard navigation - ArrowUp wraps to last item from first', async () => {
        const ref = createRef<SlashCommandMenuRef>();
        render(
            <SlashCommandMenu
                ref={ref}
                items={mockItems}
                command={mockCommand}
            />,
        );

        // Press up from first item (should wrap to last)
        await act(async () => {
            ref.current?.onKeyDown(new KeyboardEvent('keydown', {key: 'ArrowUp'}));
        });

        await waitFor(() => {
            const buttons = screen.getAllByRole('button');
            expect(buttons[2]).toHaveClass('selected');
        });
    });

    test('keyboard navigation - ArrowDown wraps to first item from last', async () => {
        const ref = createRef<SlashCommandMenuRef>();
        render(
            <SlashCommandMenu
                ref={ref}
                items={mockItems}
                command={mockCommand}
            />,
        );

        // Press down three times (should wrap to first)
        await act(async () => {
            ref.current?.onKeyDown(new KeyboardEvent('keydown', {key: 'ArrowDown'}));
        });
        await act(async () => {
            ref.current?.onKeyDown(new KeyboardEvent('keydown', {key: 'ArrowDown'}));
        });
        await act(async () => {
            ref.current?.onKeyDown(new KeyboardEvent('keydown', {key: 'ArrowDown'}));
        });

        await waitFor(() => {
            const buttons = screen.getAllByRole('button');
            expect(buttons[0]).toHaveClass('selected');
        });
    });

    test('keyboard navigation - Enter selects current item', async () => {
        const ref = createRef<SlashCommandMenuRef>();
        render(
            <SlashCommandMenu
                ref={ref}
                items={mockItems}
                command={mockCommand}
            />,
        );

        // Move to second item and press enter
        await act(async () => {
            ref.current?.onKeyDown(new KeyboardEvent('keydown', {key: 'ArrowDown'}));
        });

        await act(async () => {
            ref.current?.onKeyDown(new KeyboardEvent('keydown', {key: 'Enter'}));
        });

        expect(mockCommand).toHaveBeenCalledWith(mockItems[1]);
    });

    test('other keys are not handled', () => {
        const ref = createRef<SlashCommandMenuRef>();
        render(
            <SlashCommandMenu
                ref={ref}
                items={mockItems}
                command={mockCommand}
            />,
        );

        const handled = ref.current?.onKeyDown(new KeyboardEvent('keydown', {key: 'a'}));

        expect(handled).toBe(false);
    });

    test('selection resets when items change', () => {
        const {rerender} = render(
            <SlashCommandMenu
                items={mockItems}
                command={mockCommand}
            />,
        );

        // First verify first item is selected
        let buttons = screen.getAllByRole('button');
        expect(buttons[0]).toHaveClass('selected');

        // Rerender with new items
        const newItems: FormattingAction[] = [
            {id: 'newItem1', title: 'New Item 1', description: 'New item 1', icon: 'icon-new', command: jest.fn(), category: 'text'},
            {id: 'newItem2', title: 'New Item 2', description: 'New item 2', icon: 'icon-new', command: jest.fn(), category: 'text'},
        ];

        rerender(
            <SlashCommandMenu
                items={newItems}
                command={mockCommand}
            />,
        );

        // First item of new list should be selected
        buttons = screen.getAllByRole('button');
        expect(buttons[0]).toHaveClass('selected');
        expect(screen.getByText('New Item 1')).toBeInTheDocument();
    });
});
