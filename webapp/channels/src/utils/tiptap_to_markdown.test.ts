// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {tiptapToMarkdown} from './tiptap_to_markdown';

describe('tiptapToMarkdown', () => {
    describe('basic text', () => {
        it('should convert paragraph to plain text', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'Hello world'}],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown.trim()).toBe('Hello world');
            expect(result.files).toHaveLength(0);
        });

        it('should handle multiple paragraphs', () => {
            const doc = {
                type: 'doc',
                content: [
                    {type: 'paragraph', content: [{type: 'text', text: 'First paragraph'}]},
                    {type: 'paragraph', content: [{type: 'text', text: 'Second paragraph'}]},
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('First paragraph');
            expect(result.markdown).toContain('Second paragraph');
        });

        it('should handle empty document', () => {
            const doc = {type: 'doc', content: []};

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toBe('');
            expect(result.files).toHaveLength(0);
        });
    });

    describe('headings', () => {
        it('should convert heading level 1', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'heading',
                        attrs: {level: 1},
                        content: [{type: 'text', text: 'Title'}],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown.trim()).toBe('# Title');
        });

        it('should convert all heading levels', () => {
            const doc = {
                type: 'doc',
                content: [
                    {type: 'heading', attrs: {level: 1}, content: [{type: 'text', text: 'H1'}]},
                    {type: 'heading', attrs: {level: 2}, content: [{type: 'text', text: 'H2'}]},
                    {type: 'heading', attrs: {level: 3}, content: [{type: 'text', text: 'H3'}]},
                    {type: 'heading', attrs: {level: 4}, content: [{type: 'text', text: 'H4'}]},
                    {type: 'heading', attrs: {level: 5}, content: [{type: 'text', text: 'H5'}]},
                    {type: 'heading', attrs: {level: 6}, content: [{type: 'text', text: 'H6'}]},
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('# H1');
            expect(result.markdown).toContain('## H2');
            expect(result.markdown).toContain('### H3');
            expect(result.markdown).toContain('#### H4');
            expect(result.markdown).toContain('##### H5');
            expect(result.markdown).toContain('###### H6');
        });

        it('should clamp heading levels greater than 6', () => {
            const doc = {
                type: 'doc',
                content: [
                    {type: 'heading', attrs: {level: 7}, content: [{type: 'text', text: 'Deep'}]},
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown.trim()).toBe('###### Deep');
        });
    });

    describe('marks (bold, italic, code, strike)', () => {
        it('should convert bold text', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {type: 'text', text: 'Hello '},
                            {type: 'text', marks: [{type: 'bold'}], text: 'world'},
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown.trim()).toBe('Hello **world**');
        });

        it('should convert italic text', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {type: 'text', marks: [{type: 'italic'}], text: 'emphasis'},
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown.trim()).toBe('*emphasis*');
        });

        it('should convert inline code', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {type: 'text', text: 'Use '},
                            {type: 'text', marks: [{type: 'code'}], text: 'const x = 1'},
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown.trim()).toBe('Use `const x = 1`');
        });

        it('should convert strikethrough', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {type: 'text', marks: [{type: 'strike'}], text: 'deleted'},
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown.trim()).toBe('~~deleted~~');
        });

        it('should handle mixed marks', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {type: 'text', marks: [{type: 'bold'}, {type: 'italic'}], text: 'bold italic'},
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toMatch(/\*{1,3}bold italic\*{1,3}/);
        });
    });

    describe('links', () => {
        it('should convert links', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {
                                type: 'text',
                                marks: [{type: 'link', attrs: {href: 'https://example.com'}}],
                                text: 'Example',
                            },
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown.trim()).toBe('[Example](https://example.com)');
        });

        it('should handle links with empty href', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {
                                type: 'text',
                                marks: [{type: 'link', attrs: {href: ''}}],
                                text: 'No link',
                            },
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown.trim()).toBe('[No link]()');
        });
    });

    describe('lists', () => {
        it('should convert bullet list', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'bulletList',
                        content: [
                            {type: 'listItem', content: [{type: 'paragraph', content: [{type: 'text', text: 'Item 1'}]}]},
                            {type: 'listItem', content: [{type: 'paragraph', content: [{type: 'text', text: 'Item 2'}]}]},
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('- Item 1');
            expect(result.markdown).toContain('- Item 2');
        });

        it('should convert ordered list', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'orderedList',
                        attrs: {start: 1},
                        content: [
                            {type: 'listItem', content: [{type: 'paragraph', content: [{type: 'text', text: 'First'}]}]},
                            {type: 'listItem', content: [{type: 'paragraph', content: [{type: 'text', text: 'Second'}]}]},
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('1. First');
            expect(result.markdown).toContain('2. Second');
        });

        it('should convert task list with checked/unchecked items', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'taskList',
                        content: [
                            {type: 'taskItem', attrs: {checked: true}, content: [{type: 'paragraph', content: [{type: 'text', text: 'Done'}]}]},
                            {type: 'taskItem', attrs: {checked: false}, content: [{type: 'paragraph', content: [{type: 'text', text: 'Todo'}]}]},
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('- [x] ');
            expect(result.markdown).toContain('- [ ] ');
            expect(result.markdown).toContain('Done');
            expect(result.markdown).toContain('Todo');
        });

        it('should handle nested lists', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'bulletList',
                        content: [
                            {
                                type: 'listItem',
                                content: [
                                    {type: 'paragraph', content: [{type: 'text', text: 'Parent'}]},
                                    {
                                        type: 'bulletList',
                                        content: [
                                            {type: 'listItem', content: [{type: 'paragraph', content: [{type: 'text', text: 'Child'}]}]},
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            // Just verify content is present (exact formatting varies)
            expect(result.markdown).toContain('Parent');
            expect(result.markdown).toContain('Child');
            expect(result.markdown).toContain('-');
        });
    });

    describe('code blocks', () => {
        it('should convert code block without language', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'codeBlock',
                        attrs: {},
                        content: [{type: 'text', text: 'const x = 1;'}],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('```\nconst x = 1;\n```');
        });

        it('should convert code block with language', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'codeBlock',
                        attrs: {language: 'javascript'},
                        content: [{type: 'text', text: 'const x = 1;'}],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('```javascript\nconst x = 1;\n```');
        });

        it('should sanitize code block language', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'codeBlock',
                        attrs: {language: 'js<script>alert(1)</script>'},
                        content: [{type: 'text', text: 'code'}],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).not.toContain('<script>');
            expect(result.markdown).toContain('```jsscriptalert1script');
        });
    });

    describe('blockquote', () => {
        it('should convert blockquote', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'blockquote',
                        content: [
                            {type: 'paragraph', content: [{type: 'text', text: 'Quote text'}]},
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('> Quote text');
        });
    });

    describe('callout', () => {
        it('should convert callout with type', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'callout',
                        attrs: {type: 'warning'},
                        content: [
                            {type: 'paragraph', content: [{type: 'text', text: 'Warning message'}]},
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('> **Warning**');
            expect(result.markdown).toContain('Warning message');
        });
    });

    describe('horizontal rule', () => {
        it('should convert horizontal rule', () => {
            const doc = {
                type: 'doc',
                content: [
                    {type: 'paragraph', content: [{type: 'text', text: 'Above'}]},
                    {type: 'horizontalRule'},
                    {type: 'paragraph', content: [{type: 'text', text: 'Below'}]},
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('---');
        });
    });

    describe('hard break', () => {
        it('should convert hard break to markdown line break', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {type: 'text', text: 'Line 1'},
                            {type: 'hardBreak'},
                            {type: 'text', text: 'Line 2'},
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('Line 1  \nLine 2');
        });
    });

    describe('tables', () => {
        it('should convert table to GFM format', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'table',
                        content: [
                            {
                                type: 'tableRow',
                                content: [
                                    {type: 'tableHeader', content: [{type: 'paragraph', content: [{type: 'text', text: 'Col1'}]}]},
                                    {type: 'tableHeader', content: [{type: 'paragraph', content: [{type: 'text', text: 'Col2'}]}]},
                                ],
                            },
                            {
                                type: 'tableRow',
                                content: [
                                    {type: 'tableCell', content: [{type: 'paragraph', content: [{type: 'text', text: 'A'}]}]},
                                    {type: 'tableCell', content: [{type: 'paragraph', content: [{type: 'text', text: 'B'}]}]},
                                ],
                            },
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            // Table structure with pipes and separators
            expect(result.markdown).toContain('|');
            expect(result.markdown).toContain('---');
            expect(result.markdown).toContain('Col1');
            expect(result.markdown).toContain('Col2');
            expect(result.markdown).toContain('A');
            expect(result.markdown).toContain('B');
        });
    });

    describe('images', () => {
        it('should convert external image', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {type: 'image', attrs: {src: 'https://example.com/image.png', alt: 'Alt text'}},
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('![Alt text](https://example.com/image.png)');
            expect(result.files).toHaveLength(0);
        });

        it('should collect MM-hosted image and convert to local path', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {type: 'image', attrs: {src: '/api/v4/files/abc123?thumbnail=true', alt: 'Screenshot'}},
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('![Screenshot](attachments/abc123.bin)');
            expect(result.files).toHaveLength(1);
            expect(result.files[0]).toMatchObject({
                fileId: 'abc123',
                localPath: 'attachments/abc123.bin',
            });
        });

        it('should extract file extension from URL', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {type: 'image', attrs: {src: '/api/v4/files/def456.png', alt: ''}},
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.files[0].localPath).toBe('attachments/def456.png');
        });

        it('should use original filename when available', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {type: 'image', attrs: {src: '/api/v4/files/xyz789', alt: 'My Screenshot', filename: 'screenshot-2024.png'}},
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            // Should use original filename instead of fileId
            expect(result.files[0].localPath).toBe('attachments/screenshot-2024.png');
            expect(result.files[0].fileId).toBe('xyz789');
            expect(result.files[0].filename).toBe('screenshot-2024.png');
            expect(result.markdown).toContain('![My Screenshot](attachments/screenshot-2024.png)');
        });

        it('should handle imageResize node', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {type: 'imageResize', attrs: {src: 'https://example.com/resized.jpg', alt: 'Resized'}},
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('![Resized](https://example.com/resized.jpg)');
        });
    });

    describe('video', () => {
        it('should convert external video to link', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'video',
                        attrs: {src: 'https://example.com/video.mp4', title: 'My Video'},
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            // Video is converted to link (title becomes label if no alt)
            expect(result.markdown).toContain('[');
            expect(result.markdown).toContain('](https://example.com/video.mp4)');
        });

        it('should collect MM-hosted video', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'video',
                        attrs: {src: '/api/v4/files/vid789', title: 'Recording'},
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.files).toHaveLength(1);
            expect(result.files[0].fileId).toBe('vid789');

            // Uses title as filename since that's the only available name
            expect(result.markdown).toContain('](attachments/Recording)');
        });
    });

    describe('file attachment', () => {
        it('should convert file attachment to link', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'fileAttachment',
                        attrs: {
                            src: '/api/v4/files/doc123',
                            fileName: 'document.pdf',
                            fileSize: 1024,
                            mimeType: 'application/pdf',
                        },
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            // Uses original filename instead of fileId
            expect(result.markdown).toContain('[document.pdf](attachments/document.pdf)');
            expect(result.files).toHaveLength(1);
            expect(result.files[0]).toMatchObject({
                fileId: 'doc123',
                filename: 'document.pdf',
                localPath: 'attachments/document.pdf',
            });
        });
    });

    describe('mention', () => {
        it('should convert mention to @username', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {type: 'text', text: 'Hello '},
                            {type: 'mention', attrs: {id: 'user123', label: 'johndoe'}},
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('@johndoe');
        });
    });

    describe('options', () => {
        it('should include title when includeTitle is true', () => {
            const doc = {
                type: 'doc',
                content: [
                    {type: 'paragraph', content: [{type: 'text', text: 'Content'}]},
                ],
            };

            const result = tiptapToMarkdown(doc, {title: 'My Page', includeTitle: true});

            expect(result.markdown).toContain('# My Page');
            expect(result.markdown).toContain('Content');
        });

        it('should not include title when includeTitle is false', () => {
            const doc = {
                type: 'doc',
                content: [
                    {type: 'paragraph', content: [{type: 'text', text: 'Content'}]},
                ],
            };

            const result = tiptapToMarkdown(doc, {title: 'My Page', includeTitle: false});

            expect(result.markdown).not.toContain('# My Page');
            expect(result.markdown).toContain('Content');
        });
    });

    describe('preserveFileUrls option', () => {
        it('should preserve file URLs when preserveFileUrls is true', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {type: 'image', attrs: {src: '/api/v4/files/abc123', alt: 'test image'}},
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc, {preserveFileUrls: true});

            expect(result.markdown).toContain('![test image](/api/v4/files/abc123)');
            expect(result.files).toHaveLength(0);
        });

        it('should rewrite to attachments when preserveFileUrls is false', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {type: 'image', attrs: {src: '/api/v4/files/abc123', alt: 'test image'}},
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc, {preserveFileUrls: false});

            expect(result.markdown).toContain('attachments/');
            expect(result.files).toHaveLength(1);
        });

        it('should preserve file URLs for video nodes when preserveFileUrls is true', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'video',
                        attrs: {src: '/api/v4/files/video123', title: 'My Video'},
                    },
                ],
            };

            const result = tiptapToMarkdown(doc, {preserveFileUrls: true});

            expect(result.markdown).toContain('[My Video](/api/v4/files/video123)');
            expect(result.files).toHaveLength(0);
        });

        it('should preserve file URLs for file attachments when preserveFileUrls is true', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'fileAttachment',
                        attrs: {
                            fileId: 'doc123',
                            fileName: 'report.pdf',
                            src: '/api/v4/files/doc123',
                        },
                    },
                ],
            };

            const result = tiptapToMarkdown(doc, {preserveFileUrls: true});

            expect(result.markdown).toContain('[report.pdf](/api/v4/files/doc123)');
            expect(result.files).toHaveLength(0);
        });

        it('should still handle external URLs normally when preserveFileUrls is true', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {type: 'image', attrs: {src: 'https://example.com/image.png', alt: 'External image'}},
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc, {preserveFileUrls: true});

            expect(result.markdown).toContain('![External image](https://example.com/image.png)');
            expect(result.files).toHaveLength(0);
        });
    });

    describe('error handling', () => {
        it('should throw error for invalid document', () => {
            expect(() => tiptapToMarkdown(null)).toThrow('Invalid TipTap document structure');
            expect(() => tiptapToMarkdown(undefined)).toThrow('Invalid TipTap document structure');
            expect(() => tiptapToMarkdown({})).toThrow('Invalid TipTap document structure');
            expect(() => tiptapToMarkdown({type: 'notdoc'})).toThrow('Invalid TipTap document structure');
        });

        it('should handle document with content array that is not an array', () => {
            expect(() => tiptapToMarkdown({type: 'doc', content: 'invalid'})).toThrow('Invalid TipTap document structure');
        });
    });
});
