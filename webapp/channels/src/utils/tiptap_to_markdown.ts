// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MarkdownSerializerState} from '@tiptap/pm/markdown';
import {MarkdownSerializer} from '@tiptap/pm/markdown';
import {Node, Schema} from '@tiptap/pm/model';

import {makeUrlSafe} from 'utils/url';

// Export constants
const DEFAULT_FILE_EXTENSION = '.bin';
const EXPORT_ATTACHMENTS_DIR = 'attachments';

// File reference collected during serialization (images, videos, PDFs, etc.)
export type FileRef = {
    originalSrc: string;
    localPath: string; // e.g., "attachments/abc123.png"
    fileId: string;
    filename?: string; // Original filename if available
};

export type MarkdownResult = {
    markdown: string;
    files: FileRef[]; // All MM-hosted files (images, videos, docs)
};

export type MarkdownExportOptions = {
    title?: string;
    includeTitle?: boolean;
    schema?: Schema;
};

// Build ProseMirror schema directly (avoids TipTap initialization issues in tests)
let cachedSchema: Schema | null = null;

function getExportSchema(): Schema {
    if (cachedSchema) {
        return cachedSchema;
    }

    cachedSchema = new Schema({
        nodes: {
            doc: {content: 'block+'},
            text: {group: 'inline'},
            paragraph: {
                content: 'inline*',
                group: 'block',
                parseDOM: [{tag: 'p'}],
            },
            heading: {
                attrs: {level: {default: 1}},
                content: 'inline*',
                group: 'block',
                parseDOM: [
                    {tag: 'h1', attrs: {level: 1}},
                    {tag: 'h2', attrs: {level: 2}},
                    {tag: 'h3', attrs: {level: 3}},
                    {tag: 'h4', attrs: {level: 4}},
                    {tag: 'h5', attrs: {level: 5}},
                    {tag: 'h6', attrs: {level: 6}},
                ],
            },
            bulletList: {
                content: 'listItem+',
                group: 'block',
                parseDOM: [{tag: 'ul'}],
            },
            orderedList: {
                attrs: {start: {default: 1}},
                content: 'listItem+',
                group: 'block',
                parseDOM: [{tag: 'ol'}],
            },
            listItem: {
                content: 'paragraph block*',
                parseDOM: [{tag: 'li'}],
            },
            taskList: {
                content: 'taskItem+',
                group: 'block',
            },
            taskItem: {
                attrs: {checked: {default: false}},
                content: 'paragraph block*',
            },
            codeBlock: {
                attrs: {language: {default: ''}},
                content: 'text*',
                marks: '',
                group: 'block',
                code: true,
                parseDOM: [{tag: 'pre'}],
            },
            blockquote: {
                content: 'block+',
                group: 'block',
                parseDOM: [{tag: 'blockquote'}],
            },
            callout: {
                attrs: {type: {default: 'info'}},
                content: 'block+',
                group: 'block',
            },
            horizontalRule: {
                group: 'block',
                parseDOM: [{tag: 'hr'}],
            },
            hardBreak: {
                inline: true,
                group: 'inline',
                selectable: false,
                parseDOM: [{tag: 'br'}],
            },
            image: {
                inline: true,
                attrs: {
                    src: {},
                    alt: {default: ''},
                    title: {default: null},
                    filename: {default: null},
                },
                group: 'inline',
                draggable: true,
                parseDOM: [{tag: 'img'}],
            },
            imageResize: {
                inline: true,
                attrs: {
                    src: {},
                    alt: {default: ''},
                    title: {default: null},
                    width: {default: null},
                    filename: {default: null},
                },
                group: 'inline',
                draggable: true,
            },
            video: {
                attrs: {
                    src: {default: null},
                    title: {default: null},
                },
                group: 'block',
                atom: true,
            },
            fileAttachment: {
                attrs: {
                    fileId: {default: null},
                    fileName: {default: ''},
                    filename: {default: ''},
                    fileSize: {default: 0},
                    mimeType: {default: ''},
                    src: {default: ''},
                },
                group: 'block',
                atom: true,
            },
            table: {
                content: 'tableRow+',
                group: 'block',
                tableRole: 'table',
                parseDOM: [{tag: 'table'}],
            },
            tableRow: {
                content: '(tableCell | tableHeader)+',
                tableRole: 'row',
                parseDOM: [{tag: 'tr'}],
            },
            tableCell: {
                content: 'block+',
                attrs: {
                    colspan: {default: 1},
                    rowspan: {default: 1},
                },
                tableRole: 'cell',
                parseDOM: [{tag: 'td'}],
            },
            tableHeader: {
                content: 'block+',
                attrs: {
                    colspan: {default: 1},
                    rowspan: {default: 1},
                },
                tableRole: 'header_cell',
                parseDOM: [{tag: 'th'}],
            },
            mention: {
                attrs: {
                    id: {default: null},
                    label: {default: null},
                },
                group: 'inline',
                inline: true,
                atom: true,
            },
        },
        marks: {
            bold: {
                parseDOM: [{tag: 'strong'}, {tag: 'b'}],
            },
            italic: {
                parseDOM: [{tag: 'em'}, {tag: 'i'}],
            },
            code: {
                parseDOM: [{tag: 'code'}],
            },
            strike: {
                parseDOM: [{tag: 's'}, {tag: 'strike'}],
            },
            link: {
                attrs: {
                    href: {},
                    target: {default: null},
                    title: {default: null},
                },
                parseDOM: [{tag: 'a[href]'}],
            },
        },
    });

    return cachedSchema;
}

// Sanitize code block language to prevent injection
function sanitizeCodeLanguage(lang: string | undefined): string {
    if (!lang) {
        return '';
    }
    return lang.replace(/[^a-zA-Z0-9+-]/g, '').slice(0, 20);
}

// Check if URL is MM-hosted file that should be bundled
function isMattermostFileUrl(src: string): boolean {
    return src.startsWith('/api/v4/files/') || src.includes('/api/v4/files/');
}

// Extract file ID from MM file URL
function extractFileId(src: string): string | null {
    const match = src.match(/\/api\/v4\/files\/([a-z0-9]+)/i);
    return match ? match[1] : null;
}

// Get file extension from URL, filename attr, or default
function getFileExtension(src: string, filename?: string): string {
    // Try filename first
    if (filename) {
        const match = filename.match(/\.([a-zA-Z0-9]+)$/);
        if (match) {
            return `.${match[1].toLowerCase()}`;
        }
    }

    // Try URL
    const urlMatch = src.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    if (urlMatch) {
        return `.${urlMatch[1].toLowerCase()}`;
    }

    // Default
    return DEFAULT_FILE_EXTENSION;
}

// Sanitize filename for safe use in file paths
function sanitizeFilename(filename: string): string {
    // Remove path traversal and invalid characters
    return filename.
        replace(/[<>:"/\\|?*\u0000-\u001f]/g, ''). // eslint-disable-line no-control-regex
        replace(/\.\./g, '').
        trim() || 'file';
}

// Escape text for markdown (used in certain contexts like alt text)
function escapeMarkdownText(text: string | undefined): string {
    if (!text) {
        return '';
    }
    return text.
        replace(/\\/g, '\\\\').
        replace(/\*/g, '\\*').
        replace(/_/g, '\\_').
        replace(/`/g, '\\`').
        replace(/\[/g, '\\[').
        replace(/\]/g, '\\]').
        replace(/</g, '&lt;').
        replace(/>/g, '&gt;');
}

// Create serializer that collects MM-hosted files (images, videos, attachments)
function createSerializer(fileRefs: FileRef[]) {
    // Process image/video nodes
    const processMediaNode = (state: MarkdownSerializerState, node: Node, isVideo = false) => {
        const src = (node.attrs.src as string) || '';
        const alt = escapeMarkdownText(node.attrs.alt as string);

        if (isMattermostFileUrl(src)) {
            const fileId = extractFileId(src);
            if (fileId) {
                const originalFilename = (node.attrs.filename as string) || (node.attrs.title as string);
                const ext = getFileExtension(src, originalFilename);

                // Use original filename if available, otherwise fall back to fileId
                let exportFilename: string;
                if (originalFilename) {
                    exportFilename = sanitizeFilename(originalFilename);
                } else {
                    exportFilename = fileId + ext;
                }
                const localPath = `${EXPORT_ATTACHMENTS_DIR}/${exportFilename}`;
                fileRefs.push({originalSrc: src, localPath, fileId, filename: originalFilename});

                if (isVideo) {
                    // Videos as links (markdown doesn't support video embeds)
                    const label = alt || (node.attrs.title as string) || 'video';
                    state.write(`[${label}](${localPath})`);
                } else {
                    state.write(`![${alt}](${localPath})`);
                }
                return;
            }
        }

        // External URL or data URL: preserve as-is
        const safeSrc = makeUrlSafe(src);
        if (safeSrc) {
            if (isVideo) {
                const label = alt || 'video';
                state.write(`[${label}](${safeSrc})`);
            } else {
                state.write(`![${alt}](${safeSrc})`);
            }
        }
    };

    // Process file attachment nodes (PDFs, docs, etc.)
    const processFileAttachment = (state: MarkdownSerializerState, node: Node) => {
        const src = (node.attrs.src as string) || '';
        const originalFilename = (node.attrs.fileName as string) || (node.attrs.filename as string) || 'file';

        if (isMattermostFileUrl(src)) {
            const fileId = extractFileId(src);
            if (fileId) {
                const exportFilename = sanitizeFilename(originalFilename);
                const localPath = `${EXPORT_ATTACHMENTS_DIR}/${exportFilename}`;
                fileRefs.push({originalSrc: src, localPath, fileId, filename: originalFilename});
                state.write(`[${escapeMarkdownText(originalFilename)}](${localPath})`);
                state.closeBlock(node);
                return;
            }
        }

        // External: preserve as-is
        const safeSrc = makeUrlSafe(src);
        if (safeSrc) {
            state.write(`[${escapeMarkdownText(originalFilename)}](${safeSrc})`);
        }
        state.closeBlock(node);
    };

    return new MarkdownSerializer(
        {
            doc: (state, node) => state.renderContent(node),
            paragraph: (state, node) => {
                state.renderInline(node);
                state.closeBlock(node);
            },
            heading: (state, node) => {
                const level = Math.min((node.attrs.level as number) || 1, 6);
                state.write('#'.repeat(level) + ' ');
                state.renderInline(node);
                state.closeBlock(node);
            },
            bulletList: (state, node) => {
                state.renderList(node, '  ', () => '- ');
            },
            orderedList: (state, node) => {
                const start = (node.attrs.start as number) || 1;
                state.renderList(node, '  ', (i) => `${start + i}. `);
            },
            listItem: (state, node) => {
                state.renderContent(node);
            },
            codeBlock: (state, node) => {
                const lang = sanitizeCodeLanguage(node.attrs.language as string);
                state.write('```' + lang + '\n');
                state.text(node.textContent, false);
                state.write('\n```');
                state.closeBlock(node);
            },
            blockquote: (state, node) => {
                state.wrapBlock('> ', null, node, () => state.renderContent(node));
            },
            callout: (state, node) => {
                const calloutType = (node.attrs.type as string) || 'info';
                state.write(`> **${calloutType.charAt(0).toUpperCase() + calloutType.slice(1)}**\n`);
                state.wrapBlock('> ', null, node, () => state.renderContent(node));
            },
            image: (state, node) => processMediaNode(state, node, false),
            imageResize: (state, node) => processMediaNode(state, node, false),
            video: (state, node) => {
                processMediaNode(state, node, true);
                state.closeBlock(node);
            },
            fileAttachment: (state, node) => processFileAttachment(state, node),
            horizontalRule: (state, node) => {
                state.write('---');
                state.closeBlock(node);
            },
            hardBreak: (state) => {
                state.write('  \n');
            },
            text: (state, node) => {
                state.text(node.text || '');
            },
            table: (state, node) => {
                // Render table with GFM format
                let isFirstRow = true;
                node.forEach((row) => {
                    if (row.type.name === 'tableRow') {
                        state.write('|');
                        row.forEach((cell) => {
                            state.write(' ');
                            state.renderInline(cell);
                            state.write(' |');
                        });
                        state.write('\n');

                        // Add header separator after first row
                        if (isFirstRow) {
                            state.write('|');
                            row.forEach(() => {
                                state.write(' --- |');
                            });
                            state.write('\n');
                            isFirstRow = false;
                        }
                    }
                });
                state.closeBlock(node);
            },
            tableRow: () => {
                // Handled by table
            },
            tableHeader: (state, node) => {
                state.renderInline(node);
            },
            tableCell: (state, node) => {
                state.renderInline(node);
            },
            taskList: (state, node) => {
                state.renderList(node, '  ', () => '');
            },
            taskItem: (state, node) => {
                const checked = node.attrs.checked ? '[x] ' : '[ ] ';
                state.write('- ' + checked);
                state.renderContent(node);
            },
            mention: (state, node) => {
                const label = (node.attrs.label as string) || (node.attrs.id as string) || '';
                state.write(`@${escapeMarkdownText(label)}`);
            },
        },
        {
            bold: {open: '**', close: '**', mixable: true, expelEnclosingWhitespace: true},
            italic: {open: '*', close: '*', mixable: true, expelEnclosingWhitespace: true},
            code: {open: '`', close: '`', escape: false},
            strike: {open: '~~', close: '~~', mixable: true},
            link: {
                open: '[',
                close: (_, mark) => {
                    const href = makeUrlSafe((mark.attrs.href as string) || '');
                    return href ? `](${href})` : ']()';
                },
            },
        },
    );
}

function isValidTipTapDoc(doc: unknown): doc is {type: 'doc'; content?: unknown[]} {
    if (doc === null || typeof doc !== 'object') {
        return false;
    }
    if (!('type' in doc) || (doc as {type: unknown}).type !== 'doc') {
        return false;
    }
    if ('content' in doc && !Array.isArray((doc as {content: unknown}).content)) {
        return false;
    }
    return true;
}

export function tiptapToMarkdown(
    doc: unknown,
    options?: MarkdownExportOptions,
): MarkdownResult {
    if (!isValidTipTapDoc(doc)) {
        throw new Error('Invalid TipTap document structure');
    }

    const fileRefs: FileRef[] = [];
    const serializer = createSerializer(fileRefs);

    const nodeSchema = options?.schema || getExportSchema();
    const node = Node.fromJSON(nodeSchema, doc);

    let markdown = '';
    if (options?.includeTitle && options?.title) {
        markdown = `# ${options.title}\n\n`;
    }
    markdown += serializer.serialize(node);

    return {markdown, files: fileRefs};
}

// Export schema getter for testing
export {getExportSchema};
