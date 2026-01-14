// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Editor} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

import FileAttachment from './file_attachment_extension';

describe('FileAttachment Extension', () => {
    let editor: Editor;

    beforeEach(() => {
        editor = new Editor({
            extensions: [StarterKit, FileAttachment],
            content: '<p>Test content</p>',
        });
    });

    afterEach(() => {
        editor.destroy();
    });

    describe('node configuration', () => {
        it('is configured as a block node', () => {
            const fileAttachmentType = editor.schema.nodes.fileAttachment;
            expect(fileAttachmentType).toBeDefined();
            expect(fileAttachmentType.spec.group).toBe('block');
        });

        it('is configured as an atom (non-editable content)', () => {
            const fileAttachmentType = editor.schema.nodes.fileAttachment;
            expect(fileAttachmentType.spec.atom).toBe(true);
        });

        it('is draggable', () => {
            const fileAttachmentType = editor.schema.nodes.fileAttachment;
            expect(fileAttachmentType.spec.draggable).toBe(true);
        });

        it('is isolating', () => {
            const fileAttachmentType = editor.schema.nodes.fileAttachment;
            expect(fileAttachmentType.spec.isolating).toBe(true);
        });
    });

    describe('insertFileAttachment command', () => {
        it('inserts file attachment with basic attributes', () => {
            editor.commands.insertFileAttachment({
                fileId: 'file123',
                fileName: 'document.pdf',
                fileSize: 1024,
                mimeType: 'application/pdf',
                src: '/api/v4/files/file123',
            });

            const json = editor.getJSON();
            const fileNode = json.content?.find((node) => node.type === 'fileAttachment');
            expect(fileNode).toBeDefined();
            expect(fileNode?.attrs?.fileId).toBe('file123');
            expect(fileNode?.attrs?.fileName).toBe('document.pdf');
            expect(fileNode?.attrs?.fileSize).toBe(1024);
            expect(fileNode?.attrs?.mimeType).toBe('application/pdf');
            expect(fileNode?.attrs?.src).toBe('/api/v4/files/file123');
        });

        it('inserts file attachment with loading state', () => {
            editor.commands.insertFileAttachment({
                fileId: null,
                fileName: 'uploading.pdf',
                fileSize: 0,
                mimeType: 'application/pdf',
                src: '',
                loading: true,
            });

            const json = editor.getJSON();
            const fileNode = json.content?.find((node) => node.type === 'fileAttachment');
            expect(fileNode?.attrs?.loading).toBe(true);
        });

        it('defaults loading to false when not specified', () => {
            editor.commands.insertFileAttachment({
                fileId: 'file123',
                fileName: 'document.pdf',
                fileSize: 1024,
                mimeType: 'application/pdf',
                src: '/api/v4/files/file123',
            });

            const json = editor.getJSON();
            const fileNode = json.content?.find((node) => node.type === 'fileAttachment');
            expect(fileNode?.attrs?.loading).toBe(false);
        });

        it('handles partial attributes', () => {
            editor.commands.insertFileAttachment({
                fileName: 'unnamed.txt',
            });

            const json = editor.getJSON();
            const fileNode = json.content?.find((node) => node.type === 'fileAttachment');
            expect(fileNode).toBeDefined();
            expect(fileNode?.attrs?.fileName).toBe('unnamed.txt');
            expect(fileNode?.attrs?.fileId).toBeNull();
            expect(fileNode?.attrs?.fileSize).toBe(0);
        });
    });

    describe('HTML parsing', () => {
        it('parses div with data-file-attachment attribute', () => {
            const html = '<div data-file-attachment data-file-id="file123" data-file-name="test.pdf" data-file-size="2048" data-mime-type="application/pdf" data-src="/api/v4/files/file123"></div>';
            editor.commands.setContent(html);

            const json = editor.getJSON();
            const fileNode = json.content?.find((node) => node.type === 'fileAttachment');
            expect(fileNode).toBeDefined();
            expect(fileNode?.attrs?.fileId).toBe('file123');
            expect(fileNode?.attrs?.fileName).toBe('test.pdf');
            expect(fileNode?.attrs?.fileSize).toBe(2048);
            expect(fileNode?.attrs?.mimeType).toBe('application/pdf');
            expect(fileNode?.attrs?.src).toBe('/api/v4/files/file123');
        });

        it('parses loading state from HTML', () => {
            const html = '<div data-file-attachment data-file-name="uploading.pdf" data-loading="true"></div>';
            editor.commands.setContent(html);

            const json = editor.getJSON();
            const fileNode = json.content?.find((node) => node.type === 'fileAttachment');
            expect(fileNode?.attrs?.loading).toBe(true);
        });

        it('parses file size as integer', () => {
            const html = '<div data-file-attachment data-file-size="12345"></div>';
            editor.commands.setContent(html);

            const json = editor.getJSON();
            const fileNode = json.content?.find((node) => node.type === 'fileAttachment');
            expect(fileNode?.attrs?.fileSize).toBe(12345);
            expect(typeof fileNode?.attrs?.fileSize).toBe('number');
        });

        it('returns NaN for invalid fileSize value', () => {
            const html = '<div data-file-attachment data-file-size="invalid"></div>';
            editor.commands.setContent(html);

            const json = editor.getJSON();
            const fileNode = json.content?.find((node) => node.type === 'fileAttachment');
            expect(fileNode?.attrs?.fileSize).toBeNaN();
        });
    });

    describe('HTML rendering', () => {
        it('renders with wiki-file-attachment class', () => {
            editor.commands.insertFileAttachment({
                fileId: 'file123',
                fileName: 'document.pdf',
                fileSize: 1024,
                mimeType: 'application/pdf',
                src: '/api/v4/files/file123',
            });

            const html = editor.getHTML();
            expect(html).toContain('class="wiki-file-attachment"');
        });

        it('renders with data-file-attachment marker', () => {
            editor.commands.insertFileAttachment({
                fileId: 'file123',
                fileName: 'document.pdf',
                fileSize: 1024,
                mimeType: 'application/pdf',
                src: '/api/v4/files/file123',
            });

            const html = editor.getHTML();
            expect(html).toContain('data-file-attachment');
        });

        it('renders with data-file-id attribute', () => {
            editor.commands.insertFileAttachment({
                fileId: 'abc123',
                fileName: 'document.pdf',
                fileSize: 1024,
                mimeType: 'application/pdf',
                src: '/api/v4/files/abc123',
            });

            const html = editor.getHTML();
            expect(html).toContain('data-file-id="abc123"');
        });

        it('renders with data-file-name attribute', () => {
            editor.commands.insertFileAttachment({
                fileId: 'file123',
                fileName: 'my-document.pdf',
                fileSize: 1024,
                mimeType: 'application/pdf',
                src: '/api/v4/files/file123',
            });

            const html = editor.getHTML();
            expect(html).toContain('data-file-name="my-document.pdf"');
        });

        it('renders with data-file-size attribute', () => {
            editor.commands.insertFileAttachment({
                fileId: 'file123',
                fileName: 'document.pdf',
                fileSize: 5678,
                mimeType: 'application/pdf',
                src: '/api/v4/files/file123',
            });

            const html = editor.getHTML();
            expect(html).toContain('data-file-size="5678"');
        });

        it('renders with data-mime-type attribute', () => {
            editor.commands.insertFileAttachment({
                fileId: 'file123',
                fileName: 'document.pdf',
                fileSize: 1024,
                mimeType: 'application/pdf',
                src: '/api/v4/files/file123',
            });

            const html = editor.getHTML();
            expect(html).toContain('data-mime-type="application/pdf"');
        });

        it('renders with data-src attribute', () => {
            editor.commands.insertFileAttachment({
                fileId: 'file123',
                fileName: 'document.pdf',
                fileSize: 1024,
                mimeType: 'application/pdf',
                src: '/api/v4/files/file123',
            });

            const html = editor.getHTML();
            expect(html).toContain('data-src="/api/v4/files/file123"');
        });

        it('renders with data-loading when loading', () => {
            editor.commands.insertFileAttachment({
                fileId: null,
                fileName: 'uploading.pdf',
                fileSize: 0,
                mimeType: 'application/pdf',
                src: '',
                loading: true,
            });

            const html = editor.getHTML();
            expect(html).toContain('data-loading="true"');
        });

        it('does not render empty attributes', () => {
            editor.commands.insertFileAttachment({
                fileId: null,
                fileName: '',
                fileSize: 0,
                mimeType: '',
                src: '',
            });

            const html = editor.getHTML();
            expect(html).not.toContain('data-file-id=""');
            expect(html).not.toContain('data-file-name=""');
            expect(html).not.toContain('data-mime-type=""');
            expect(html).not.toContain('data-src=""');
        });
    });

    describe('content handling', () => {
        it('file attachment node has no editable content (atom)', () => {
            editor.commands.insertFileAttachment({
                fileId: 'file123',
                fileName: 'document.pdf',
                fileSize: 1024,
                mimeType: 'application/pdf',
                src: '/api/v4/files/file123',
            });

            const json = editor.getJSON();
            const fileNode = json.content?.find((node) => node.type === 'fileAttachment');
            expect(fileNode?.content).toBeUndefined();
        });

        it('multiple file attachments can be inserted', () => {
            editor.commands.insertFileAttachment({
                fileId: 'file1',
                fileName: 'doc1.pdf',
                fileSize: 1024,
                mimeType: 'application/pdf',
                src: '/api/v4/files/file1',
            });
            editor.commands.insertFileAttachment({
                fileId: 'file2',
                fileName: 'doc2.docx',
                fileSize: 2048,
                mimeType: 'application/vnd.openxmlformats',
                src: '/api/v4/files/file2',
            });

            const json = editor.getJSON();
            const fileNodes = json.content?.filter((node) => node.type === 'fileAttachment');
            expect(fileNodes?.length).toBe(2);
        });
    });

    describe('keyboard shortcuts', () => {
        it('Backspace deletes selected file attachment', () => {
            editor.commands.insertFileAttachment({
                fileId: 'file123',
                fileName: 'document.pdf',
                fileSize: 1024,
                mimeType: 'application/pdf',
                src: '/api/v4/files/file123',
            });

            // Find the file attachment node position
            let filePos = -1;
            editor.state.doc.descendants((node, pos) => {
                if (node.type.name === 'fileAttachment') {
                    filePos = pos;
                    return false;
                }
                return true;
            });

            // Select the file attachment node
            if (filePos >= 0) {
                editor.chain().setNodeSelection(filePos).run();
            }

            // Verify it exists before deletion
            const beforeJson = editor.getJSON();
            expect(beforeJson.content?.find((node) => node.type === 'fileAttachment')).toBeDefined();

            // Simulate Backspace
            editor.commands.deleteSelection();

            // Verify deletion
            const afterJson = editor.getJSON();
            expect(afterJson.content?.find((node) => node.type === 'fileAttachment')).toBeUndefined();
        });
    });
});
