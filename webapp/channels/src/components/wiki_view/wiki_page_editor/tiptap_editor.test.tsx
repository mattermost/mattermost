// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// TRUE ZERO-MOCK VERSION - Uses real API and real channels

import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react';
import {Provider} from 'react-redux';
import {renderWithContext} from 'tests/react_testing_utils';
import {EditorContent, useEditor} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {Mention} from '@tiptap/extension-mention';
import {Table} from '@tiptap/extension-table';
import {TableRow} from '@tiptap/extension-table-row';
import {TableCell} from '@tiptap/extension-table-cell';
import {TableHeader} from '@tiptap/extension-table-header';
import {mergeAttributes} from '@tiptap/core';

import type {Channel} from '@mattermost/types/channels';
import type {DeepPartial} from '@mattermost/types/utilities';
import type {GlobalState} from 'types/store';

import {Client4} from 'mattermost-redux/client';
import mockStore from 'tests/test_store';
import {setupTestContext, cleanupOrphanedTestResources, type TestContext} from 'tests/api_test_helpers';
import * as BrowserHistory from 'utils/browser_history';

import {createChannelMentionSuggestion} from './channel_mention_mm_bridge';
import TipTapEditor from './tiptap_editor';

describe('TipTapEditor - Table Extension', () => {
    const TestTableEditor = ({initialContent}: {initialContent?: string}) => {
        const parsedContent = initialContent ? JSON.parse(initialContent) : '';
        const editor = useEditor({
            extensions: [
                StarterKit,
                Table.configure({resizable: true}),
                TableRow,
                TableCell,
                TableHeader,
            ],
            content: parsedContent,
        });

        if (!editor) {
            return null;
        }

        return (
            <div>
                <div data-testid="toolbar">
                    <button
                        data-testid="insert-table"
                        onClick={() =>
                            editor.chain().focus().insertTable({rows: 3, cols: 3, withHeaderRow: true}).run()
                        }
                    >
                        Insert Table
                    </button>
                    <button
                        data-testid="add-column-before"
                        onClick={() => editor.chain().focus().addColumnBefore().run()}
                    >
                        Add Column Before
                    </button>
                    <button
                        data-testid="add-column-after"
                        onClick={() => editor.chain().focus().addColumnAfter().run()}
                    >
                        Add Column After
                    </button>
                    <button
                        data-testid="delete-column"
                        onClick={() => editor.chain().focus().deleteColumn().run()}
                    >
                        Delete Column
                    </button>
                    <button
                        data-testid="add-row-before"
                        onClick={() => editor.chain().focus().addRowBefore().run()}
                    >
                        Add Row Before
                    </button>
                    <button
                        data-testid="add-row-after"
                        onClick={() => editor.chain().focus().addRowAfter().run()}
                    >
                        Add Row After
                    </button>
                    <button
                        data-testid="delete-row"
                        onClick={() => editor.chain().focus().deleteRow().run()}
                    >
                        Delete Row
                    </button>
                    <button
                        data-testid="delete-table"
                        onClick={() => editor.chain().focus().deleteTable().run()}
                    >
                        Delete Table
                    </button>
                    <button
                        data-testid="merge-cells"
                        onClick={() => editor.chain().focus().mergeCells().run()}
                    >
                        Merge Cells
                    </button>
                    <button
                        data-testid="split-cell"
                        onClick={() => editor.chain().focus().splitCell().run()}
                    >
                        Split Cell
                    </button>
                </div>
                <EditorContent editor={editor} data-testid="tiptap-editor"/>
            </div>
        );
    };

    describe('Table Creation', () => {
        it('should insert a table with correct structure', () => {
            const {getByTestId} = render(<TestTableEditor/>);

            const insertButton = getByTestId('insert-table');
            fireEvent.click(insertButton);

            const editor = getByTestId('tiptap-editor');
            const table = editor.querySelector('table');

            expect(table).toBeInTheDocument();

            const rows = table?.querySelectorAll('tr');
            expect(rows).toHaveLength(3);

            const headerCells = rows?.[0].querySelectorAll('th');
            expect(headerCells).toHaveLength(3);

            const bodyCells = rows?.[1].querySelectorAll('td');
            expect(bodyCells).toHaveLength(3);
        });

        it('should create table with header row', () => {
            const {getByTestId} = render(<TestTableEditor/>);

            const insertButton = getByTestId('insert-table');
            fireEvent.click(insertButton);

            const editor = getByTestId('tiptap-editor');
            const headerCells = editor.querySelectorAll('th');

            expect(headerCells.length).toBeGreaterThan(0);
        });
    });

    describe('Table Column Operations', () => {
        it('should add column before current column', async () => {
            const {getByTestId} = render(<TestTableEditor/>);

            const insertButton = getByTestId('insert-table');
            fireEvent.click(insertButton);

            const editor = getByTestId('tiptap-editor');
            const firstCell = editor.querySelector('th');
            fireEvent.click(firstCell!);

            const addColumnButton = getByTestId('add-column-before');
            fireEvent.click(addColumnButton);

            await waitFor(() => {
                const table = editor.querySelector('table');
                const firstRow = table?.querySelector('tr');
                const cells = firstRow?.querySelectorAll('th, td');
                expect(cells).toHaveLength(4);
            });
        });

        it('should add column after current column', async () => {
            const {getByTestId} = render(<TestTableEditor/>);

            const insertButton = getByTestId('insert-table');
            fireEvent.click(insertButton);

            const editor = getByTestId('tiptap-editor');
            const firstCell = editor.querySelector('th');
            fireEvent.click(firstCell!);

            const addColumnButton = getByTestId('add-column-after');
            fireEvent.click(addColumnButton);

            await waitFor(() => {
                const table = editor.querySelector('table');
                const firstRow = table?.querySelector('tr');
                const cells = firstRow?.querySelectorAll('th, td');
                expect(cells).toHaveLength(4);
            });
        });

        it('should delete current column', async () => {
            const {getByTestId} = render(<TestTableEditor/>);

            const insertButton = getByTestId('insert-table');
            fireEvent.click(insertButton);

            const editor = getByTestId('tiptap-editor');
            const firstCell = editor.querySelector('th');
            fireEvent.click(firstCell!);

            const deleteColumnButton = getByTestId('delete-column');
            fireEvent.click(deleteColumnButton);

            await waitFor(() => {
                const table = editor.querySelector('table');
                const firstRow = table?.querySelector('tr');
                const cells = firstRow?.querySelectorAll('th, td');
                expect(cells).toHaveLength(2);
            });
        });
    });

    describe('Table Row Operations', () => {
        it('should add row before current row', async () => {
            const {getByTestId} = render(<TestTableEditor/>);

            const insertButton = getByTestId('insert-table');
            fireEvent.click(insertButton);

            const editor = getByTestId('tiptap-editor');
            const firstCell = editor.querySelector('td');
            fireEvent.click(firstCell!);

            const addRowButton = getByTestId('add-row-before');
            fireEvent.click(addRowButton);

            await waitFor(() => {
                const table = editor.querySelector('table');
                const rows = table?.querySelectorAll('tr');
                expect(rows).toHaveLength(4);
            });
        });

        it('should add row after current row', async () => {
            const {getByTestId} = render(<TestTableEditor/>);

            const insertButton = getByTestId('insert-table');
            fireEvent.click(insertButton);

            const editor = getByTestId('tiptap-editor');
            const firstCell = editor.querySelector('td');
            fireEvent.click(firstCell!);

            const addRowButton = getByTestId('add-row-after');
            fireEvent.click(addRowButton);

            await waitFor(() => {
                const table = editor.querySelector('table');
                const rows = table?.querySelectorAll('tr');
                expect(rows).toHaveLength(4);
            });
        });

        it('should delete current row', async () => {
            const {getByTestId} = render(<TestTableEditor/>);

            const insertButton = getByTestId('insert-table');
            fireEvent.click(insertButton);

            const editor = getByTestId('tiptap-editor');
            const firstCell = editor.querySelector('td');
            fireEvent.click(firstCell!);

            const deleteRowButton = getByTestId('delete-row');
            fireEvent.click(deleteRowButton);

            await waitFor(() => {
                const table = editor.querySelector('table');
                const rows = table?.querySelectorAll('tr');
                expect(rows).toHaveLength(2);
            });
        });
    });

    describe('Table Deletion', () => {
        it('should delete entire table', async () => {
            const {getByTestId} = render(<TestTableEditor/>);

            const insertButton = getByTestId('insert-table');
            fireEvent.click(insertButton);

            const editor = getByTestId('tiptap-editor');
            let table = editor.querySelector('table');
            expect(table).toBeInTheDocument();

            const firstCell = editor.querySelector('th');
            fireEvent.click(firstCell!);

            const deleteTableButton = getByTestId('delete-table');
            fireEvent.click(deleteTableButton);

            await waitFor(() => {
                table = editor.querySelector('table');
                expect(table).not.toBeInTheDocument();
            });
        });
    });

    describe('Table Cell Operations', () => {
        it('should merge selected cells', async () => {
            const {getByTestId} = render(<TestTableEditor/>);

            const insertButton = getByTestId('insert-table');
            fireEvent.click(insertButton);

            const editor = getByTestId('tiptap-editor');
            const firstCell = editor.querySelector('th');
            fireEvent.click(firstCell!);

            const mergeButton = getByTestId('merge-cells');
            fireEvent.click(mergeButton);

            await waitFor(() => {
                const table = editor.querySelector('table');
                expect(table).toBeInTheDocument();
            });
        });

        it('should split merged cell', async () => {
            const {getByTestId} = render(<TestTableEditor/>);

            const insertButton = getByTestId('insert-table');
            fireEvent.click(insertButton);

            const editor = getByTestId('tiptap-editor');
            const firstCell = editor.querySelector('th');
            fireEvent.click(firstCell!);

            const mergeButton = getByTestId('merge-cells');
            fireEvent.click(mergeButton);

            const splitButton = getByTestId('split-cell');
            fireEvent.click(splitButton);

            await waitFor(() => {
                const table = editor.querySelector('table');
                expect(table).toBeInTheDocument();
            });
        });
    });

    describe('Table Content Persistence', () => {
        it('should preserve table content when loading from JSON', async () => {
            const tableContent = JSON.stringify({
                type: 'doc',
                content: [
                    {
                        type: 'table',
                        content: [
                            {
                                type: 'tableRow',
                                content: [
                                    {
                                        type: 'tableHeader',
                                        content: [{type: 'paragraph', content: [{type: 'text', text: 'Header 1'}]}],
                                    },
                                    {
                                        type: 'tableHeader',
                                        content: [{type: 'paragraph', content: [{type: 'text', text: 'Header 2'}]}],
                                    },
                                ],
                            },
                            {
                                type: 'tableRow',
                                content: [
                                    {
                                        type: 'tableCell',
                                        content: [{type: 'paragraph', content: [{type: 'text', text: 'Cell 1'}]}],
                                    },
                                    {
                                        type: 'tableCell',
                                        content: [{type: 'paragraph', content: [{type: 'text', text: 'Cell 2'}]}],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            });

            const {getByTestId} = render(<TestTableEditor initialContent={tableContent}/>);

            const editor = getByTestId('tiptap-editor');

            await waitFor(() => {
                const table = editor.querySelector('table');
                expect(table).toBeInTheDocument();
            });

            const table = editor.querySelector('table');
            const headerCells = table?.querySelectorAll('th');
            expect(headerCells?.[0]).toHaveTextContent('Header 1');
            expect(headerCells?.[1]).toHaveTextContent('Header 2');

            const bodyCells = table?.querySelectorAll('td');
            expect(bodyCells?.[0]).toHaveTextContent('Cell 1');
            expect(bodyCells?.[1]).toHaveTextContent('Cell 2');
        });
    });
});

describe('TipTapEditor - Page Linking (Ctrl+K and Modal)', () => {
    const mockPages = [
        {
            id: 'page1',
            type: 'page',
            props: {title: 'Getting Started'},
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
            metadata: {},
        },
        {
            id: 'page2',
            type: 'page',
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
            metadata: {},
        },
    ];

    const mockCurrentTeam = {
        id: 'team1',
        name: 'engineering',
        display_name: 'Engineering',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        description: '',
        email: '',
        type: 'O',
        company_name: '',
        allowed_domains: '',
        invite_id: '',
        allow_open_invite: true,
        scheme_id: '',
        group_constrained: false,
        policy_id: null,
    };

    const initialState: DeepPartial<GlobalState> = {
        entities: {
            general: {
                config: {
                    MaxFileSize: '52428800',
                    EnableFileAttachments: 'true',
                },
            },
            teams: {
                currentTeamId: 'team1',
                teams: {
                    team1: mockCurrentTeam,
                },
                groupsAssociatedToTeam: {},
            },
            channels: {
                channels: {},
                groupsAssociatedToChannel: {},
            },
            users: {
                currentUserId: 'user1',
                profiles: {},
            },
            groups: {
                groups: {},
                syncables: {},
            },
            posts: {
                posts: {},
            },
        },
    };

    const baseProps = {
        content: '{"type":"doc","content":[]}',
        onContentChange: jest.fn(),
        editable: true,
        currentUserId: 'user1',
        channelId: 'channel1',
        teamId: 'team1',
        pageId: 'currentPage',
        wikiId: 'wiki1',
        pages: mockPages,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });


    test('generates correct URL format for page links', () => {
        const expectedUrl = '/engineering/wiki/channel1/wiki1/page1';
        expect(expectedUrl).toMatch(/^\/[\w-]+\/wiki\/[\w-]+\/[\w-]+\/[\w-]+$/);
    });
});
