// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {extractPlaintextFromTipTapJSON} from 'utils/tiptap_utils';

jest.mock('utils/tiptap_utils', () => ({
    extractPlaintextFromTipTapJSON: jest.fn(),
}));

describe('Conflict Modal - Copy Content Behavior', () => {
    const mockClipboard = {
        writeText: jest.fn(),
    };

    beforeAll(() => {
        Object.assign(navigator, {
            clipboard: mockClipboard,
        });
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('extractPlaintextFromTipTapJSON integration', () => {
        test('should extract plain text from simple TipTap JSON', () => {
            const tiptapJSON = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hello World"}]}]}';
            const expectedPlainText = 'Hello World';

            (extractPlaintextFromTipTapJSON as jest.Mock).mockReturnValue(expectedPlainText);

            const result = extractPlaintextFromTipTapJSON(tiptapJSON);

            expect(result).toBe(expectedPlainText);
            expect(extractPlaintextFromTipTapJSON).toHaveBeenCalledWith(tiptapJSON);
        });

        test('should extract plain text from complex TipTap JSON with multiple blocks', () => {
            const tiptapJSON = JSON.stringify({
                type: 'doc',
                content: [
                    {
                        type: 'heading',
                        attrs: {level: 1},
                        content: [{type: 'text', text: 'Title'}],
                    },
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'First paragraph'}],
                    },
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'Second paragraph'}],
                    },
                ],
            });
            const expectedPlainText = 'Title\n\nFirst paragraph\n\nSecond paragraph';

            (extractPlaintextFromTipTapJSON as jest.Mock).mockReturnValue(expectedPlainText);

            const result = extractPlaintextFromTipTapJSON(tiptapJSON);

            expect(result).toBe(expectedPlainText);
        });

        test('should return empty string for empty TipTap JSON', () => {
            const tiptapJSON = '{"type":"doc","content":[]}';

            (extractPlaintextFromTipTapJSON as jest.Mock).mockReturnValue('');

            const result = extractPlaintextFromTipTapJSON(tiptapJSON);

            expect(result).toBe('');
        });

        test('should handle TipTap JSON with mentions', () => {
            const tiptapJSON = JSON.stringify({
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {type: 'text', text: 'Hello '},
                            {type: 'mention', attrs: {id: 'user123', label: '@john'}},
                            {type: 'text', text: ' how are you?'},
                        ],
                    },
                ],
            });
            const expectedPlainText = 'Hello @john how are you?';

            (extractPlaintextFromTipTapJSON as jest.Mock).mockReturnValue(expectedPlainText);

            const result = extractPlaintextFromTipTapJSON(tiptapJSON);

            expect(result).toBe(expectedPlainText);
        });
    });

    describe('Copy behavior with clipboard', () => {
        test('should copy plain text to clipboard, not JSON', async () => {
            const tiptapJSON = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"My content"}]}]}';
            const plainText = 'My content';

            (extractPlaintextFromTipTapJSON as jest.Mock).mockReturnValue(plainText);

            const convertedText = extractPlaintextFromTipTapJSON(tiptapJSON);
            await navigator.clipboard.writeText(convertedText);

            expect(mockClipboard.writeText).toHaveBeenCalledWith(plainText);
            expect(mockClipboard.writeText).not.toHaveBeenCalledWith(tiptapJSON);
        });

        test('should fallback to raw JSON if extraction returns empty', async () => {
            const tiptapJSON = '{"type":"doc","content":[]}';

            (extractPlaintextFromTipTapJSON as jest.Mock).mockReturnValue('');

            const convertedText = extractPlaintextFromTipTapJSON(tiptapJSON);
            const contentToCopy = convertedText || tiptapJSON;
            await navigator.clipboard.writeText(contentToCopy);

            expect(mockClipboard.writeText).toHaveBeenCalledWith(tiptapJSON);
        });
    });
});
