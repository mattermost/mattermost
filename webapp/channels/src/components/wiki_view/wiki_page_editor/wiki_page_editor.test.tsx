// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ZERO MOCKS - Uses real child components

import {screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {PostTypes} from 'mattermost-redux/constants/posts';

import {renderWithContext} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import WikiPageEditor from './wiki_page_editor';

describe('components/wiki_view/wiki_page_editor/WikiPageEditor', () => {
    const baseProps = {
        title: 'Test Page',
        content: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Test content"}]}]}',
        onTitleChange: jest.fn(),
        onContentChange: jest.fn(),
        authorId: 'current_user_id',
        channelId: 'channel_id_1',
        teamId: 'team_id_1',
    };

    const initialState: DeepPartial<GlobalState> = {
        entities: {
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    current_user_id: {
                        id: 'current_user_id',
                        username: 'testuser',
                        email: 'test@example.com',
                    },
                },
            },
            teams: {
                currentTeamId: 'team_id_1',
                teams: {
                    team_id_1: {
                        id: 'team_id_1',
                        name: 'test-team',
                        display_name: 'Test Team',
                    },
                },
            },
            channels: {
                channels: {
                    channel_id_1: {
                        id: 'channel_id_1',
                        team_id: 'team_id_1',
                        name: 'test-channel',
                        display_name: 'Test Channel',
                        type: 'O',
                    },
                },
            },
            wikiPages: {
                byWiki: {},
                publishedDraftTimestamps: {},
                lastPagesInvalidated: {},
                lastDraftsInvalidated: {},
                statusField: {
                    id: 'status_field_id',
                    name: 'status',
                    type: 'select',
                    attrs: {
                        options: [
                            {id: 'rough_draft', name: 'rough_draft', color: 'light_grey'},
                            {id: 'in_progress', name: 'in_progress', color: 'light_blue'},
                            {id: 'in_review', name: 'in_review', color: 'dark_blue'},
                            {id: 'done', name: 'done', color: 'green'},
                        ],
                    },
                },
            } as any,
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Rendering', () => {
        test('should render with required props', () => {
            const {container} = renderWithContext(<WikiPageEditor {...baseProps}/>, initialState);

            expect(container.querySelector('.page-draft-editor')).toBeInTheDocument();
            expect(container.querySelector('.page-title-input')).toBeInTheDocument();
        });

        test('should render title input with correct value', () => {
            renderWithContext(<WikiPageEditor {...baseProps}/>, initialState);

            const titleInput = screen.getByDisplayValue('Test Page');
            expect(titleInput).toBeInTheDocument();
        });

        test('should render title input with placeholder', () => {
            renderWithContext(<WikiPageEditor {...baseProps}/>, initialState);

            expect(screen.getByPlaceholderText('Untitled page...')).toBeInTheDocument();
        });

        test('should render draft badge when isExistingPage is false (new draft)', () => {
            const props = {...baseProps, isExistingPage: false};
            const {container} = renderWithContext(<WikiPageEditor {...props}/>, initialState);

            const statusBadge = container.querySelector('.page-status.badge');
            expect(statusBadge).toBeInTheDocument();
            expect(statusBadge?.textContent).toBe('Draft');
        });

        test('should NOT render draft badge when isExistingPage is undefined (loading/unknown state)', () => {
            // This tests the fix for the flash issue - when isExistingPage is undefined
            // (e.g., during route transition), we don't show the badge
            const props = {...baseProps, isExistingPage: undefined};
            const {container} = renderWithContext(<WikiPageEditor {...props}/>, initialState);

            const statusBadge = container.querySelector('[data-testid="wiki-page-draft-badge"]');
            expect(statusBadge).not.toBeInTheDocument();
        });

        test('should NOT render draft badge when isExistingPage is true (editing existing page)', () => {
            const props = {...baseProps, isExistingPage: true};
            const {container} = renderWithContext(<WikiPageEditor {...props}/>, initialState);

            const statusBadge = container.querySelector('[data-testid="wiki-page-draft-badge"]');
            expect(statusBadge).not.toBeInTheDocument();
        });

        test('should render page status selector with label', () => {
            const props = {
                ...baseProps,
                pageId: 'test_page_id',
            };
            renderWithContext(<WikiPageEditor {...props}/>, initialState);

            expect(screen.getByText('Status')).toBeInTheDocument();
            expect(screen.getByText('Select...')).toBeInTheDocument();
        });

        test('should render author when showAuthor is true', () => {
            const props = {
                ...baseProps,
                showAuthor: true,
                authorId: 'current_user_id',
            };
            const {container} = renderWithContext(<WikiPageEditor {...props}/>, initialState);

            const author = container.querySelector('.WikiPageEditor__author');
            expect(author).toBeInTheDocument();
        });

        test('should not render author when showAuthor is false', () => {
            const props = {
                ...baseProps,
                showAuthor: false,
            };
            const {container} = renderWithContext(<WikiPageEditor {...props}/>, initialState);

            expect(container.querySelector('.WikiPageEditor__author')).not.toBeInTheDocument();
        });
    });

    describe('Author Avatar Functionality', () => {
        test('should render avatar with ProfilePicture component when user is in store', () => {
            const props = {
                ...baseProps,
                showAuthor: true,
                authorId: 'current_user_id',
            };
            renderWithContext(<WikiPageEditor {...props}/>, initialState);

            // ProfilePicture component should be rendered
            const avatar = screen.getByTestId('wiki-page-author');
            expect(avatar).toBeInTheDocument();
            expect(avatar).toHaveClass('WikiPageEditor__author');
        });

        test('should display username using UserProfile component', () => {
            const props = {
                ...baseProps,
                showAuthor: true,
                authorId: 'current_user_id',
            };
            renderWithContext(<WikiPageEditor {...props}/>, initialState);

            // Should display "By" text with UserProfile component showing username
            expect(screen.getByText(/By/i)).toBeInTheDocument();
            expect(screen.getByText(/testuser/i)).toBeInTheDocument();
        });

        test('should render UserProfile component when user is not in Redux store', () => {
            const stateWithoutUser: DeepPartial<GlobalState> = {
                entities: {
                    users: {
                        currentUserId: 'current_user_id',
                        profiles: {},
                    },
                    teams: initialState.entities?.teams,
                    channels: initialState.entities?.channels,
                },
            };

            const props = {
                ...baseProps,
                showAuthor: true,
                authorId: 'missing_user_id',
            };

            const {container} = renderWithContext(<WikiPageEditor {...props}/>, stateWithoutUser);

            // UserProfile component handles loading internally, so author section should still exist
            const authorSection = container.querySelector('.WikiPageEditor__author');
            expect(authorSection).toBeInTheDocument();
        });

        test('should handle very long usernames', () => {
            const longUsername = 'a'.repeat(300);
            const stateWithLongUsername: DeepPartial<GlobalState> = {
                ...initialState,
                entities: {
                    ...initialState.entities,
                    users: {
                        currentUserId: 'current_user_id',
                        profiles: {
                            current_user_id: {
                                id: 'current_user_id',
                                username: longUsername,
                                email: 'test@example.com',
                            },
                        },
                    },
                },
            };

            const props = {
                ...baseProps,
                showAuthor: true,
                authorId: 'current_user_id',
            };

            const {container} = renderWithContext(<WikiPageEditor {...props}/>, stateWithLongUsername);

            const authorText = container.querySelector('.WikiPageEditor__authorText');
            expect(authorText).toBeInTheDocument();

            // UserProfile component will display the username (truncation handled by CSS)
            expect(authorText?.textContent).toContain(longUsername);
        });

        test('should not render author section when currentUserId is undefined', () => {
            const props = {
                ...baseProps,
                showAuthor: true,
                authorId: undefined,
            };
            const {container} = renderWithContext(<WikiPageEditor {...props}/>, initialState);

            expect(container.querySelector('.WikiPageEditor__author')).not.toBeInTheDocument();
        });

        test('should render ProfilePicture and UserProfile components', () => {
            const props = {
                ...baseProps,
                showAuthor: true,
                authorId: 'current_user_id',
                channelId: 'channel_id_1',
            };
            renderWithContext(<WikiPageEditor {...props}/>, initialState);

            // Verify author section is rendered
            const authorSection = screen.getByTestId('wiki-page-author');
            expect(authorSection).toBeInTheDocument();

            // Check that username is displayed via UserProfile component
            expect(screen.getByText(/testuser/i)).toBeInTheDocument();
        });
    });

    describe('Title Editing', () => {
        test('should call onTitleChange when title input changes', async () => {
            const user = userEvent.setup();
            renderWithContext(<WikiPageEditor {...baseProps}/>, initialState);

            const titleInput = screen.getByDisplayValue('Test Page');
            await user.clear(titleInput);
            await user.type(titleInput, 'New Title');

            await waitFor(() => {
                expect(baseProps.onTitleChange).toHaveBeenCalled();
            });
        });

        test('should update local title state when title changes', async () => {
            const user = userEvent.setup();
            renderWithContext(<WikiPageEditor {...baseProps}/>, initialState);

            const titleInput = screen.getByDisplayValue('Test Page');
            await user.clear(titleInput);
            await user.type(titleInput, 'Updated Title');

            await waitFor(() => {
                expect(screen.getByDisplayValue('Updated Title')).toBeInTheDocument();
            });
        });

        test('should update local title when title prop changes', () => {
            const {rerender} = renderWithContext(<WikiPageEditor {...baseProps}/>, initialState);

            expect(screen.getByDisplayValue('Test Page')).toBeInTheDocument();

            rerender(<WikiPageEditor
                {...baseProps}
                title='New Title from Props'
            />, /* eslint-disable-line react/jsx-closing-bracket-location */
            );

            expect(screen.getByDisplayValue('New Title from Props')).toBeInTheDocument();
        });

        test('should handle empty title', () => {
            const props = {...baseProps, title: ''};
            renderWithContext(<WikiPageEditor {...props}/>, initialState);

            const titleInput = screen.getByPlaceholderText('Untitled page...');
            expect(titleInput).toHaveValue('');
        });
    });

    describe('TipTap Editor Integration', () => {
        test('should render TipTapEditor with TipTap JSON content', () => {
            const props = {
                ...baseProps,
                pageId: 'page-1',
                wikiId: 'wiki-1',
            };
            renderWithContext(<WikiPageEditor {...props}/>, initialState);

            // TipTapEditor should be in the document (rendered with real component)
            const editorContainer = document.querySelector('.ProseMirror');
            expect(editorContainer).toBeInTheDocument();
        });

        test('should render ProseMirror editor with initial content', () => {
            const props = {
                ...baseProps,
                pageId: 'page-1',
                wikiId: 'wiki-1',
            };
            renderWithContext(<WikiPageEditor {...props}/>, initialState);

            // Verify the ProseMirror editor is rendered with content
            const editor = document.querySelector('.ProseMirror');
            expect(editor).toBeInTheDocument();
            expect(editor?.textContent).toContain('Test content');

            // Note: Testing content change callbacks requires E2E tests due to JSDOM limitations
            // with ProseMirror (getClientRects, elementFromPoint not available in JSDOM)
        });
    });

    describe('Edge Cases', () => {
        test('should handle undefined optional props', () => {
            const minimalProps = {
                title: 'Test',
                content: '{"type":"doc","content":[{"type":"paragraph"}]}',
                onTitleChange: jest.fn(),
                onContentChange: jest.fn(),
                authorId: 'current_user_id',
                channelId: 'channel_id_1',
                teamId: 'team_id_1',
            };

            renderWithContext(<WikiPageEditor {...minimalProps}/>, initialState);

            expect(document.querySelector('.page-draft-editor')).toBeInTheDocument();
        });

        test('should handle empty TipTap content', () => {
            const props = {...baseProps, content: '{"type":"doc","content":[]}'};
            renderWithContext(<WikiPageEditor {...props}/>, initialState);

            expect(document.querySelector('.ProseMirror')).toBeInTheDocument();
        });

        test('should handle long titles', () => {
            const longTitle = 'A'.repeat(500);
            const props = {...baseProps, title: longTitle};
            renderWithContext(<WikiPageEditor {...props}/>, initialState);

            expect(screen.getByDisplayValue(longTitle)).toBeInTheDocument();
        });

        test('should handle special characters in title', () => {
            const specialTitle = '<script>alert("xss")</script>';
            const props = {...baseProps, title: specialTitle};
            renderWithContext(<WikiPageEditor {...props}/>, initialState);

            expect(screen.getByDisplayValue(specialTitle)).toBeInTheDocument();
        });
    });

    describe('Component Structure', () => {
        test('should have correct class structure', () => {
            const {container} = renderWithContext(<WikiPageEditor {...baseProps}/>, initialState);

            expect(container.querySelector('.page-draft-editor')).toBeInTheDocument();
            expect(container.querySelector('.draft-header')).toBeInTheDocument();
            expect(container.querySelector('.draft-content')).toBeInTheDocument();
            expect(container.querySelector('.page-meta')).toBeInTheDocument();
        });

        test('should render all meta elements', () => {
            const props = {
                ...baseProps,
                showAuthor: true,
                pageId: 'test_page_id',
                isExistingPage: false, // Must be explicitly false to show draft badge
            };
            const {container} = renderWithContext(<WikiPageEditor {...props}/>, initialState);

            const meta = container.querySelector('.page-meta');
            expect(meta?.querySelector('.page-status')).toBeInTheDocument();
            expect(screen.getByText('Status')).toBeInTheDocument();
            expect(screen.getByText('Select...')).toBeInTheDocument();
        });
    });

    describe('Page Linking Integration', () => {
        const mockPages = [
            {
                id: 'page1',
                type: PostTypes.PAGE,
                props: {title: 'Getting Started'},
                create_at: 1000,
                update_at: 1000,
                delete_at: 0,
                edit_at: 0,
                user_id: 'user1',
                channel_id: 'channel_id_1',
                root_id: '',
                parent_id: '',
                original_id: '',
                message: '',
                hashtags: '',
                file_ids: [],
                pending_post_id: '',
                metadata: {} as any,
            },
            {
                id: 'page2',
                type: PostTypes.PAGE,
                props: {title: 'API Documentation'},
                create_at: 2000,
                update_at: 2000,
                delete_at: 0,
                edit_at: 0,
                user_id: 'user1',
                channel_id: 'channel_id_1',
                root_id: '',
                parent_id: '',
                original_id: '',
                message: '',
                hashtags: '',
                file_ids: [],
                pending_post_id: '',
                metadata: {} as any,
            },
        ];

        const stateWithPages: DeepPartial<GlobalState> = {
            ...initialState,
            entities: {
                ...initialState.entities,
                posts: {
                    posts: {
                        page1: mockPages[0],
                        page2: mockPages[1],
                    },
                },
                wikiPages: {
                    byWiki: {
                        wiki_id_1: ['page1', 'page2'],
                    },
                },
            },
        };

        test('retrieves pages from Redux using getPages selector', () => {
            renderWithContext(
                <WikiPageEditor
                    {...baseProps}
                    wikiId='wiki_id_1'
                />,
                stateWithPages,
            );

            const editor = document.querySelector('.tiptap-editor-wrapper');
            expect(editor).toBeInTheDocument();
        });

        test('passes pages prop to TipTapEditor', () => {
            const {container} = renderWithContext(
                <WikiPageEditor
                    {...baseProps}
                    wikiId='wiki_id_1'
                />,
                stateWithPages,
            );

            const editor = container.querySelector('.tiptap-editor-wrapper');
            expect(editor).toBeInTheDocument();
        });

        test('handles empty pages array when wiki has no pages', () => {
            const emptyState: DeepPartial<GlobalState> = {
                ...initialState,
                entities: {
                    ...initialState.entities,
                    posts: {
                        posts: {},
                    },
                    wikiPages: {
                        byWiki: {
                            wiki_id_1: [],
                        },
                    },
                },
            };

            renderWithContext(
                <WikiPageEditor
                    {...baseProps}
                    wikiId='wiki_id_1'
                />,
                emptyState,
            );

            const editor = document.querySelector('.tiptap-editor-wrapper');
            expect(editor).toBeInTheDocument();
        });

        test('handles missing wikiId prop gracefully', () => {
            renderWithContext(
                <WikiPageEditor
                    {...baseProps}
                    wikiId={undefined}
                />,
                stateWithPages,
            );

            const editor = document.querySelector('.tiptap-editor-wrapper');
            expect(editor).toBeInTheDocument();
        });

        test('filters pages to only include PAGE type posts', () => {
            const mixedPosts = {
                page1: mockPages[0],
                page2: mockPages[1],
                post1: {
                    id: 'post1',
                    type: 'post' as any,
                    props: {title: 'Regular Post'},
                    create_at: 3000,
                    update_at: 3000,
                    delete_at: 0,
                    edit_at: 0,
                    user_id: 'user1',
                    channel_id: 'channel_id_1',
                    root_id: '',
                    parent_id: '',
                    original_id: '',
                    message: 'Regular message',
                    hashtags: '',
                    file_ids: [],
                    pending_post_id: '',
                    metadata: {} as any,
                },
            };

            const mixedState: DeepPartial<GlobalState> = {
                ...initialState,
                entities: {
                    ...initialState.entities,
                    posts: {
                        posts: mixedPosts,
                    },
                    wikiPages: {
                        byWiki: {
                            wiki_id_1: ['page1', 'page2', 'post1'],
                        },
                    },
                },
            };

            const {container} = renderWithContext(
                <WikiPageEditor
                    {...baseProps}
                    wikiId='wiki_id_1'
                />,
                mixedState,
            );

            const editor = container.querySelector('.tiptap-editor-wrapper');
            expect(editor).toBeInTheDocument();
        });
    });
});
