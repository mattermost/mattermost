// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import PageActionsMenu from './page_actions_menu';

describe('components/pages_hierarchy_panel/PageActionsMenu', () => {
    const initialState = {
        entities: {
            general: {
                config: {
                    SiteURL: 'http://localhost:8065',
                },
            },
            users: {
                currentUserId: 'current_user_id',
                profiles: {},
            },
        },
        views: {
            pagesHierarchy: {
                outlineExpandedNodes: {},
            },
        },
    };

    const baseProps = {
        pageId: 'page-1',
        wikiId: 'wiki-1',
        pageLink: '/wiki/wiki-1/page-1',
    };

    test('renders menu button', () => {
        renderWithContext(
            <PageActionsMenu {...baseProps}/>,
            initialState,
        );

        expect(screen.getByTestId('page-actions-menu-button')).toBeInTheDocument();
    });

    test('opens menu when button is clicked', async () => {
        renderWithContext(
            <PageActionsMenu {...baseProps}/>,
            initialState,
        );

        const button = screen.getByTestId('page-actions-menu-button');
        await userEvent.click(button);

        expect(screen.getByText('New subpage')).toBeInTheDocument();
    });

    test('calls onCreateChild when New subpage is clicked', async () => {
        const onCreateChild = jest.fn();
        renderWithContext(
            <PageActionsMenu
                {...baseProps}
                onCreateChild={onCreateChild}
            />,
            initialState,
        );

        await userEvent.click(screen.getByTestId('page-actions-menu-button'));
        await userEvent.click(screen.getByText('New subpage'));

        await waitFor(() => {
            expect(onCreateChild).toHaveBeenCalledTimes(1);
        });
    });

    test('calls onRename when Rename is clicked', async () => {
        const onRename = jest.fn();
        renderWithContext(
            <PageActionsMenu
                {...baseProps}
                onRename={onRename}
            />,
            initialState,
        );

        await userEvent.click(screen.getByTestId('page-actions-menu-button'));
        await userEvent.click(screen.getByText('Rename'));

        await waitFor(() => {
            expect(onRename).toHaveBeenCalledTimes(1);
        });
    });

    test('calls onMove when Move to is clicked', async () => {
        const onMove = jest.fn();
        renderWithContext(
            <PageActionsMenu
                {...baseProps}
                onMove={onMove}
            />,
            initialState,
        );

        await userEvent.click(screen.getByTestId('page-actions-menu-button'));
        await userEvent.click(screen.getByText('Move to...'));

        await waitFor(() => {
            expect(onMove).toHaveBeenCalledTimes(1);
        });
    });

    test('calls onDelete when Delete is clicked', async () => {
        const onDelete = jest.fn();
        renderWithContext(
            <PageActionsMenu
                {...baseProps}
                onDelete={onDelete}
            />,
            initialState,
        );

        await userEvent.click(screen.getByTestId('page-actions-menu-button'));
        await userEvent.click(screen.getByText('Delete page'));

        await waitFor(() => {
            expect(onDelete).toHaveBeenCalledTimes(1);
        });
    });

    test('shows Delete draft when isDraft is true', async () => {
        renderWithContext(
            <PageActionsMenu
                {...baseProps}
                isDraft={true}
            />,
            initialState,
        );

        await userEvent.click(screen.getByTestId('page-actions-menu-button'));
        expect(screen.getByText('Delete draft')).toBeInTheDocument();
    });

    test('hides Bookmark in channel when isDraft is true', async () => {
        renderWithContext(
            <PageActionsMenu
                {...baseProps}
                isDraft={true}
            />,
            initialState,
        );

        await userEvent.click(screen.getByTestId('page-actions-menu-button'));

        expect(screen.queryByText('Bookmark in channel...')).not.toBeInTheDocument();
    });

    test('shows Bookmark in channel for non-draft', async () => {
        const onBookmarkInChannel = jest.fn();
        renderWithContext(
            <PageActionsMenu
                {...baseProps}
                onBookmarkInChannel={onBookmarkInChannel}
            />,
            initialState,
        );

        await userEvent.click(screen.getByTestId('page-actions-menu-button'));
        expect(screen.getByText('Bookmark in channel...')).toBeInTheDocument();
    });

    test('hides Duplicate when canDuplicate is false', async () => {
        renderWithContext(
            <PageActionsMenu
                {...baseProps}
                canDuplicate={false}
            />,
            initialState,
        );

        await userEvent.click(screen.getByTestId('page-actions-menu-button'));

        expect(screen.queryByText('Duplicate page')).not.toBeInTheDocument();
    });

    test('calls onDuplicate when Duplicate is clicked', async () => {
        const onDuplicate = jest.fn();
        renderWithContext(
            <PageActionsMenu
                {...baseProps}
                onDuplicate={onDuplicate}
                canDuplicate={true}
            />,
            initialState,
        );

        await userEvent.click(screen.getByTestId('page-actions-menu-button'));
        await userEvent.click(screen.getByText('Duplicate page'));

        await waitFor(() => {
            expect(onDuplicate).toHaveBeenCalledTimes(1);
        });
    });

    test('calls onVersionHistory when Version history is clicked', async () => {
        const onVersionHistory = jest.fn();
        renderWithContext(
            <PageActionsMenu
                {...baseProps}
                onVersionHistory={onVersionHistory}
            />,
            initialState,
        );

        await userEvent.click(screen.getByTestId('page-actions-menu-button'));
        await userEvent.click(screen.getByText('Version history'));

        await waitFor(() => {
            expect(onVersionHistory).toHaveBeenCalledTimes(1);
        });
    });

    test('hides Version history for drafts', async () => {
        renderWithContext(
            <PageActionsMenu
                {...baseProps}
                isDraft={true}
            />,
            initialState,
        );

        await userEvent.click(screen.getByTestId('page-actions-menu-button'));

        expect(screen.queryByText('Version history')).not.toBeInTheDocument();
    });

    test('uses custom button test ID when provided', () => {
        renderWithContext(
            <PageActionsMenu
                {...baseProps}
                buttonTestId='custom-test-id'
            />,
            initialState,
        );

        expect(screen.getByTestId('custom-test-id')).toBeInTheDocument();
    });

    test('shows AI tools submenu when AI handlers provided', async () => {
        // The component uses a Fragment wrapper for AI tools which triggers a MUI warning
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const onProofread = jest.fn();
        renderWithContext(
            <PageActionsMenu
                {...baseProps}
                onProofread={onProofread}
            />,
            initialState,
        );

        await userEvent.click(screen.getByTestId('page-actions-menu-button'));
        expect(screen.getByText('AI')).toBeInTheDocument();

        consoleSpy.mockRestore();
    });

    test('hides AI tools submenu when no AI handlers provided', async () => {
        renderWithContext(
            <PageActionsMenu {...baseProps}/>,
            initialState,
        );

        await userEvent.click(screen.getByTestId('page-actions-menu-button'));

        expect(screen.queryByText('AI')).not.toBeInTheDocument();
    });
});
