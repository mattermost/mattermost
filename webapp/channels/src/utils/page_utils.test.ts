// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {copyPageAsMarkdown} from './page_utils';
import {DEFAULT_PAGE_TITLE} from './post_utils';
import {tiptapToMarkdown} from './tiptap_to_markdown';
import {copyToClipboard} from './utils';

jest.mock('./tiptap_to_markdown', () => ({
    tiptapToMarkdown: jest.fn((doc, options) => ({
        markdown: `# ${options.title}\n\nContent from ${JSON.stringify(doc)}`,
    })),
}));

jest.mock('./utils', () => ({
    copyToClipboard: jest.fn(),
}));

describe('copyPageAsMarkdown', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('input validation', () => {
        it('returns early for undefined content', () => {
            copyPageAsMarkdown(undefined, 'Title');
            expect(tiptapToMarkdown).not.toHaveBeenCalled();
            expect(copyToClipboard).not.toHaveBeenCalled();
        });

        it('returns early for empty string content', () => {
            copyPageAsMarkdown('', 'Title');
            expect(tiptapToMarkdown).not.toHaveBeenCalled();
            expect(copyToClipboard).not.toHaveBeenCalled();
        });

        it('returns early for whitespace-only content', () => {
            copyPageAsMarkdown('   ', 'Title');
            expect(tiptapToMarkdown).not.toHaveBeenCalled();
            expect(copyToClipboard).not.toHaveBeenCalled();
        });

        it('returns early for non-string content', () => {
            copyPageAsMarkdown(123 as unknown as string, 'Title');
            expect(tiptapToMarkdown).not.toHaveBeenCalled();
            expect(copyToClipboard).not.toHaveBeenCalled();
        });
    });

    describe('title handling', () => {
        const validContent = JSON.stringify({type: 'doc', content: []});

        it('uses provided title when valid', () => {
            copyPageAsMarkdown(validContent, 'My Page Title');
            expect(tiptapToMarkdown).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({title: 'My Page Title'}),
            );
        });

        it('trims whitespace from title', () => {
            copyPageAsMarkdown(validContent, '  Padded Title  ');
            expect(tiptapToMarkdown).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({title: 'Padded Title'}),
            );
        });

        it('uses DEFAULT_PAGE_TITLE when title is undefined', () => {
            copyPageAsMarkdown(validContent, undefined);
            expect(tiptapToMarkdown).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({title: DEFAULT_PAGE_TITLE}),
            );
        });

        it('uses DEFAULT_PAGE_TITLE when title is empty string', () => {
            copyPageAsMarkdown(validContent, '');
            expect(tiptapToMarkdown).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({title: DEFAULT_PAGE_TITLE}),
            );
        });

        it('uses DEFAULT_PAGE_TITLE when title is whitespace-only', () => {
            copyPageAsMarkdown(validContent, '   ');
            expect(tiptapToMarkdown).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({title: DEFAULT_PAGE_TITLE}),
            );
        });
    });

    describe('successful copy', () => {
        const validContent = JSON.stringify({type: 'doc', content: [{type: 'paragraph'}]});

        it('parses JSON content and calls tiptapToMarkdown', () => {
            copyPageAsMarkdown(validContent, 'Test Page');
            expect(tiptapToMarkdown).toHaveBeenCalledWith(
                {type: 'doc', content: [{type: 'paragraph'}]},
                expect.objectContaining({
                    title: 'Test Page',
                    includeTitle: true,
                    preserveFileUrls: true,
                }),
            );
        });

        it('copies the markdown result to clipboard', () => {
            copyPageAsMarkdown(validContent, 'Test Page');
            expect(copyToClipboard).toHaveBeenCalledWith(expect.stringContaining('# Test Page'));
        });

        it('sets includeTitle option to true', () => {
            copyPageAsMarkdown(validContent, 'Test');
            expect(tiptapToMarkdown).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({includeTitle: true}),
            );
        });

        it('sets preserveFileUrls option to true', () => {
            copyPageAsMarkdown(validContent, 'Test');
            expect(tiptapToMarkdown).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({preserveFileUrls: true}),
            );
        });
    });

    describe('error handling', () => {
        it('handles invalid JSON gracefully', () => {
            expect(() => {
                copyPageAsMarkdown('{invalid json}', 'Title');
            }).not.toThrow();
            expect(copyToClipboard).not.toHaveBeenCalled();
        });

        it('handles tiptapToMarkdown errors gracefully', () => {
            (tiptapToMarkdown as jest.Mock).mockImplementationOnce(() => {
                throw new Error('Conversion failed');
            });

            expect(() => {
                copyPageAsMarkdown(JSON.stringify({type: 'doc'}), 'Title');
            }).not.toThrow();
            expect(copyToClipboard).not.toHaveBeenCalled();
        });
    });
});
