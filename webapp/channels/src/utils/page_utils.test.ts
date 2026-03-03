// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {copyPageAsMarkdown} from './page_utils';
import {DEFAULT_PAGE_TITLE} from './post_utils';
import {tiptapToMarkdown} from './tiptap_to_markdown';

jest.mock('./tiptap_to_markdown', () => ({
    tiptapToMarkdown: jest.fn((doc, options) => ({
        markdown: `# ${options.title}\n\nContent from ${JSON.stringify(doc)}`,
    })),
}));

describe('copyPageAsMarkdown', () => {
    let mockWriteText: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        mockWriteText = jest.fn(() => Promise.resolve());
        Object.assign(navigator, {
            clipboard: {
                writeText: mockWriteText,
            },
        });
    });

    describe('input validation', () => {
        it('returns false for undefined content', async () => {
            const result = await copyPageAsMarkdown(undefined, 'Title');
            expect(result).toBe(false);
            expect(tiptapToMarkdown).not.toHaveBeenCalled();
            expect(mockWriteText).not.toHaveBeenCalled();
        });

        it('returns false for empty string content', async () => {
            const result = await copyPageAsMarkdown('', 'Title');
            expect(result).toBe(false);
            expect(tiptapToMarkdown).not.toHaveBeenCalled();
            expect(mockWriteText).not.toHaveBeenCalled();
        });

        it('returns false for whitespace-only content', async () => {
            const result = await copyPageAsMarkdown('   ', 'Title');
            expect(result).toBe(false);
            expect(tiptapToMarkdown).not.toHaveBeenCalled();
            expect(mockWriteText).not.toHaveBeenCalled();
        });

        it('returns false for non-string content', async () => {
            const result = await copyPageAsMarkdown(123 as unknown as string, 'Title');
            expect(result).toBe(false);
            expect(tiptapToMarkdown).not.toHaveBeenCalled();
            expect(mockWriteText).not.toHaveBeenCalled();
        });
    });

    describe('title handling', () => {
        const validContent = JSON.stringify({type: 'doc', content: []});

        it('uses provided title when valid', async () => {
            await copyPageAsMarkdown(validContent, 'My Page Title');
            expect(tiptapToMarkdown).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({title: 'My Page Title'}),
            );
        });

        it('trims whitespace from title', async () => {
            await copyPageAsMarkdown(validContent, '  Padded Title  ');
            expect(tiptapToMarkdown).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({title: 'Padded Title'}),
            );
        });

        it('uses DEFAULT_PAGE_TITLE when title is undefined', async () => {
            await copyPageAsMarkdown(validContent, undefined);
            expect(tiptapToMarkdown).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({title: DEFAULT_PAGE_TITLE}),
            );
        });

        it('uses DEFAULT_PAGE_TITLE when title is empty string', async () => {
            await copyPageAsMarkdown(validContent, '');
            expect(tiptapToMarkdown).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({title: DEFAULT_PAGE_TITLE}),
            );
        });

        it('uses DEFAULT_PAGE_TITLE when title is whitespace-only', async () => {
            await copyPageAsMarkdown(validContent, '   ');
            expect(tiptapToMarkdown).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({title: DEFAULT_PAGE_TITLE}),
            );
        });
    });

    describe('successful copy', () => {
        const validContent = JSON.stringify({type: 'doc', content: [{type: 'paragraph'}]});

        it('parses JSON content and calls tiptapToMarkdown', async () => {
            await copyPageAsMarkdown(validContent, 'Test Page');
            expect(tiptapToMarkdown).toHaveBeenCalledWith(
                {type: 'doc', content: [{type: 'paragraph'}]},
                expect.objectContaining({
                    title: 'Test Page',
                    includeTitle: true,
                    preserveFileUrls: true,
                }),
            );
        });

        it('copies the markdown result to clipboard', async () => {
            await copyPageAsMarkdown(validContent, 'Test Page');
            expect(mockWriteText).toHaveBeenCalledWith(expect.stringContaining('# Test Page'));
        });

        it('returns true when copy succeeds', async () => {
            const result = await copyPageAsMarkdown(validContent, 'Test Page');
            expect(result).toBe(true);
        });

        it('returns false when clipboard.writeText rejects', async () => {
            mockWriteText.mockRejectedValueOnce(new Error('Permission denied'));
            const result = await copyPageAsMarkdown(validContent, 'Test Page');
            expect(result).toBe(false);
        });

        it('sets includeTitle option to true', async () => {
            await copyPageAsMarkdown(validContent, 'Test');
            expect(tiptapToMarkdown).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({includeTitle: true}),
            );
        });

        it('sets preserveFileUrls option to true', async () => {
            await copyPageAsMarkdown(validContent, 'Test');
            expect(tiptapToMarkdown).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({preserveFileUrls: true}),
            );
        });
    });

    describe('error handling', () => {
        it('handles invalid JSON gracefully and returns false', async () => {
            const result = await copyPageAsMarkdown('{invalid json}', 'Title');
            expect(result).toBe(false);
            expect(mockWriteText).not.toHaveBeenCalled();
        });

        it('handles tiptapToMarkdown errors gracefully and returns false', async () => {
            (tiptapToMarkdown as jest.Mock).mockImplementationOnce(() => {
                throw new Error('Conversion failed');
            });

            const result = await copyPageAsMarkdown(JSON.stringify({type: 'doc'}), 'Title');
            expect(result).toBe(false);
            expect(mockWriteText).not.toHaveBeenCalled();
        });
    });
});
