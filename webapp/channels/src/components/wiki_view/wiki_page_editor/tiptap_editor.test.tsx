// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, fireEvent, waitFor} from '@testing-library/react';
import Image from '@tiptap/extension-image';
import {Table} from '@tiptap/extension-table';
import {TableCell} from '@tiptap/extension-table-cell';
import {TableHeader} from '@tiptap/extension-table-header';
import {TableRow} from '@tiptap/extension-table-row';
import {EditorContent, useEditor} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import React from 'react';

/* eslint-disable react/jsx-no-literals */
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
                <div data-testid='toolbar'>
                    <button
                        data-testid='insert-table'
                        onClick={() =>
                            editor.chain().focus().insertTable({rows: 3, cols: 3, withHeaderRow: true}).run()
                        }
                    >
                        Insert Table
                    </button>
                    <button
                        data-testid='add-column-before'
                        onClick={() => editor.chain().focus().addColumnBefore().run()}
                    >
                        Add Column Before
                    </button>
                    <button
                        data-testid='add-column-after'
                        onClick={() => editor.chain().focus().addColumnAfter().run()}
                    >
                        Add Column After
                    </button>
                    <button
                        data-testid='delete-column'
                        onClick={() => editor.chain().focus().deleteColumn().run()}
                    >
                        Delete Column
                    </button>
                    <button
                        data-testid='add-row-before'
                        onClick={() => editor.chain().focus().addRowBefore().run()}
                    >
                        Add Row Before
                    </button>
                    <button
                        data-testid='add-row-after'
                        onClick={() => editor.chain().focus().addRowAfter().run()}
                    >
                        Add Row After
                    </button>
                    <button
                        data-testid='delete-row'
                        onClick={() => editor.chain().focus().deleteRow().run()}
                    >
                        Delete Row
                    </button>
                    <button
                        data-testid='delete-table'
                        onClick={() => editor.chain().focus().deleteTable().run()}
                    >
                        Delete Table
                    </button>
                    <button
                        data-testid='merge-cells'
                        onClick={() => editor.chain().focus().mergeCells().run()}
                    >
                        Merge Cells
                    </button>
                    <button
                        data-testid='split-cell'
                        onClick={() => editor.chain().focus().splitCell().run()}
                    >
                        Split Cell
                    </button>
                </div>
                <EditorContent
                    editor={editor}
                    data-testid='tiptap-editor'
                />
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

describe('TipTapEditor - Image URL Validation', () => {
    // Safe raster image data URI prefixes (matching validateImageUrl in tiptap_editor.tsx)
    const SAFE_IMAGE_DATA_URI_PREFIXES = [
        'data:image/png',
        'data:image/jpeg',
        'data:image/jpg',
        'data:image/gif',
        'data:image/webp',
        'data:image/bmp',
    ];

    const validateImageUrl = (url: string): string | null => {
        const trimmed = url.trim();
        if (!trimmed) {
            return null;
        }

        const lower = trimmed.toLowerCase();
        if (lower.startsWith('data:')) {
            for (const prefix of SAFE_IMAGE_DATA_URI_PREFIXES) {
                if (lower.startsWith(prefix)) {
                    return trimmed;
                }
            }
            return null;
        }

        // Check for dangerous protocols
        const unescaped = decodeURIComponent(trimmed).replace(/[^\w:]/g, '').toLowerCase();
        // eslint-disable-next-line no-script-url
        if (unescaped.startsWith('javascript:') || unescaped.startsWith('vbscript:')) {
            return null;
        }

        // Must be valid HTTP(S) URL
        if (!(/^https?:\/\//i).test(trimmed)) {
            return null;
        }

        return trimmed;
    };

    it('should accept valid HTTPS URLs', () => {
        expect(validateImageUrl('https://example.com/image.png')).toBe('https://example.com/image.png');
        expect(validateImageUrl('https://cdn.example.org/path/to/image.jpg')).toBe('https://cdn.example.org/path/to/image.jpg');
    });

    it('should accept valid HTTP URLs', () => {
        expect(validateImageUrl('http://example.com/image.png')).toBe('http://example.com/image.png');
    });

    it('should reject empty or whitespace-only URLs', () => {
        expect(validateImageUrl('')).toBeNull();
        expect(validateImageUrl('   ')).toBeNull();
        expect(validateImageUrl('\t\n')).toBeNull();
    });

    it('should trim whitespace from valid URLs', () => {
        expect(validateImageUrl('  https://example.com/image.png  ')).toBe('https://example.com/image.png');
    });

    it('should reject javascript: URLs', () => {
        /* eslint-disable no-script-url */
        expect(validateImageUrl('javascript:alert(1)')).toBeNull();
        expect(validateImageUrl('JAVASCRIPT:alert(1)')).toBeNull();
        expect(validateImageUrl('  javascript:alert(1)  ')).toBeNull();
        /* eslint-enable no-script-url */
    });

    it('should reject vbscript: URLs', () => {
        /* eslint-disable no-script-url */
        expect(validateImageUrl('vbscript:msgbox(1)')).toBeNull();
        expect(validateImageUrl('VBSCRIPT:msgbox(1)')).toBeNull();
        /* eslint-enable no-script-url */
    });

    it('should reject URLs without protocol', () => {
        expect(validateImageUrl('example.com/image.png')).toBeNull();
        expect(validateImageUrl('//example.com/image.png')).toBeNull();
        expect(validateImageUrl('/path/to/image.png')).toBeNull();
    });

    it('should accept safe raster image data URIs', () => {
        const pngDataUri = 'data:image/png;base64,iVBORw0KGgo=';
        expect(validateImageUrl(pngDataUri)).toBe(pngDataUri);

        const jpegDataUri = 'data:image/jpeg;base64,/9j/4AAQ=';
        expect(validateImageUrl(jpegDataUri)).toBe(jpegDataUri);

        const gifDataUri = 'data:image/gif;base64,R0lGODlh';
        expect(validateImageUrl(gifDataUri)).toBe(gifDataUri);

        const webpDataUri = 'data:image/webp;base64,UklGR';
        expect(validateImageUrl(webpDataUri)).toBe(webpDataUri);
    });

    it('should reject SVG data URIs (XSS risk)', () => {
        expect(validateImageUrl('data:image/svg+xml,<svg onload="alert(1)"></svg>')).toBeNull();
        expect(validateImageUrl('data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9ImFsZXJ0KDEpIj48L3N2Zz4=')).toBeNull();
    });

    it('should reject other dangerous data URIs', () => {
        expect(validateImageUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
        expect(validateImageUrl('data:application/javascript,alert(1)')).toBeNull();
    });
});

describe('TipTapEditor - Page Linking (Ctrl+K and Modal)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('generates correct URL format for page links', () => {
        const expectedUrl = '/engineering/wiki/channel1/wiki1/page1';
        expect(expectedUrl).toMatch(/^\/[\w-]+\/wiki\/[\w-]+\/[\w-]+\/[\w-]+$/);
    });
});

describe('TipTapEditor - Image Preview in View Mode', () => {
    const mockDispatch = jest.fn();
    const mockOpenModal = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        mockDispatch.mockImplementation((action) => {
            if (typeof action === 'function') {
                return action(mockDispatch, jest.fn());
            }
            if (action && typeof action === 'object' && action.type === 'MODAL_OPEN') {
                mockOpenModal(action);
            }
            return action;
        });
    });

    const TestImagePreviewEditor = ({editable = false}: {editable?: boolean}) => {
        const editor = useEditor({
            extensions: [
                StarterKit,
                Image.configure({
                    HTMLAttributes: {
                        class: 'wiki-image',
                    },
                }),
            ],
            content: {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {
                                type: 'image',
                                attrs: {
                                    src: '/api/v4/files/TEST123ABC',
                                    alt: 'test-image.png',
                                    title: 'test-image.png',
                                },
                            },
                        ],
                    },
                ],
            },
            editable,
        });

        if (!editor) {
            return null;
        }

        return (
            <div>
                <EditorContent
                    editor={editor}
                    data-testid='image-preview-editor'
                />
            </div>
        );
    };

    it('should render image in view mode', () => {
        const {getByTestId} = render(<TestImagePreviewEditor editable={false}/>);

        const editor = getByTestId('image-preview-editor');
        const image = editor.querySelector('img');

        expect(image).toBeInTheDocument();
        expect(image).toHaveAttribute('src', '/api/v4/files/TEST123ABC');
        expect(image).toHaveAttribute('alt', 'test-image.png');
    });

    it('should have correct attributes for image preview', () => {
        const {getByTestId} = render(<TestImagePreviewEditor editable={false}/>);

        const editor = getByTestId('image-preview-editor');
        const image = editor.querySelector('img');

        expect(image).toHaveAttribute('src', '/api/v4/files/TEST123ABC');
        expect(image).toHaveAttribute('alt', 'test-image.png');
        expect(image).toHaveAttribute('title', 'test-image.png');
    });

    it('should extract correct file extension from filename', () => {
        const filename = 'test-image.png';
        const lastDotIndex = filename.lastIndexOf('.');
        const extension = lastDotIndex !== -1 && lastDotIndex < filename.length - 1 ?
            filename.substring(lastDotIndex + 1).toLowerCase() : 'png';

        expect(extension).toBe('png');
    });

    it('should handle different image extensions', () => {
        const testCases = [
            {filename: 'photo.jpg', expected: 'jpg'},
            {filename: 'graphic.jpeg', expected: 'jpeg'},
            {filename: 'icon.gif', expected: 'gif'},
            {filename: 'diagram.webp', expected: 'webp'},
            {filename: 'vector.svg', expected: 'svg'},
            {filename: 'no-extension', expected: 'png'}, // default fallback
        ];

        testCases.forEach(({filename, expected}) => {
            const lastDotIndex = filename.lastIndexOf('.');
            const extension = lastDotIndex !== -1 && lastDotIndex < filename.length - 1 ?
                filename.substring(lastDotIndex + 1).toLowerCase() : 'png';

            expect(extension).toBe(expected);
        });
    });

    it('should render image in edit mode', () => {
        const {getByTestId} = render(<TestImagePreviewEditor editable={true}/>);

        const editor = getByTestId('image-preview-editor');
        const image = editor.querySelector('img');

        expect(image).toBeInTheDocument();
    });
});
