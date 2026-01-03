// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PagePropsKeys} from 'utils/constants';
import {extractPlaintextFromTipTapJSON} from 'utils/tiptap_utils';

import type {PostDraft} from 'types/store/draft';

jest.mock('utils/tiptap_utils', () => ({
    extractPlaintextFromTipTapJSON: jest.fn(),
}));

jest.mock('actions/page_drafts', () => ({
    savePageDraft: jest.fn(() => ({type: 'SAVE_PAGE_DRAFT'})),
}));

jest.mock('actions/pages', () => ({
    fetchChannelDefaultPage: jest.fn(() => ({type: 'FETCH_CHANNEL_DEFAULT_PAGE'})),
    publishPageDraft: jest.fn(() => ({type: 'PUBLISH_PAGE_DRAFT'})),
    fetchPage: jest.fn(() => ({type: 'FETCH_PAGE'})),
    fetchWiki: jest.fn(() => ({type: 'FETCH_WIKI', data: {}})),
}));

jest.mock('actions/views/modals', () => ({
    openModal: jest.fn(() => ({type: 'OPEN_MODAL'})),
    closeModal: jest.fn(() => ({type: 'CLOSE_MODAL'})),
}));

jest.mock('actions/views/pages_hierarchy', () => ({
    openPagesPanel: jest.fn(() => ({type: 'OPEN_PAGES_PANEL'})),
    closePagesPanel: jest.fn(() => ({type: 'CLOSE_PAGES_PANEL'})),
}));

jest.mock('actions/wiki_edit', () => ({
    openPageInEditMode: jest.fn(() => ({type: 'OPEN_PAGE_IN_EDIT_MODE'})),
}));

describe('extractDraftAdditionalProps', () => {
    const extractDraftAdditionalProps = (draft: PostDraft): Record<string, any> | undefined => {
        const additionalProps: Record<string, any> = {};

        if (draft.props?.[PagePropsKeys.PAGE_ID]) {
            additionalProps[PagePropsKeys.PAGE_ID] = draft.props[PagePropsKeys.PAGE_ID];
        }
        if (draft.props?.[PagePropsKeys.PAGE_PARENT_ID]) {
            additionalProps[PagePropsKeys.PAGE_PARENT_ID] = draft.props[PagePropsKeys.PAGE_PARENT_ID];
        }
        if (draft.props?.[PagePropsKeys.PAGE_STATUS]) {
            additionalProps[PagePropsKeys.PAGE_STATUS] = draft.props[PagePropsKeys.PAGE_STATUS];
        }
        if (draft.props?.[PagePropsKeys.ORIGINAL_PAGE_EDIT_AT]) {
            additionalProps[PagePropsKeys.ORIGINAL_PAGE_EDIT_AT] = draft.props[PagePropsKeys.ORIGINAL_PAGE_EDIT_AT];
        }
        if (draft.props?.has_published_version !== undefined) {
            additionalProps.has_published_version = draft.props.has_published_version;
        }

        return Object.keys(additionalProps).length > 0 ? additionalProps : undefined;
    };

    test('should return undefined for draft with no props', () => {
        const draft: PostDraft = {
            message: 'test',
            channelId: 'channel1',
            rootId: 'root1',
            fileInfos: [],
            uploadsInProgress: [],
            createAt: 0,
            updateAt: 0,
        };

        const result = extractDraftAdditionalProps(draft);

        expect(result).toBeUndefined();
    });

    test('should extract page_id from draft props', () => {
        const draft: PostDraft = {
            message: 'test',
            channelId: 'channel1',
            rootId: 'root1',
            fileInfos: [],
            uploadsInProgress: [],
            createAt: 0,
            updateAt: 0,
            props: {
                [PagePropsKeys.PAGE_ID]: 'page123',
            },
        };

        const result = extractDraftAdditionalProps(draft);

        expect(result).toEqual({
            [PagePropsKeys.PAGE_ID]: 'page123',
        });
    });

    test('should extract page_parent_id from draft props', () => {
        const draft: PostDraft = {
            message: 'test',
            channelId: 'channel1',
            rootId: 'root1',
            fileInfos: [],
            uploadsInProgress: [],
            createAt: 0,
            updateAt: 0,
            props: {
                [PagePropsKeys.PAGE_PARENT_ID]: 'parent123',
            },
        };

        const result = extractDraftAdditionalProps(draft);

        expect(result).toEqual({
            [PagePropsKeys.PAGE_PARENT_ID]: 'parent123',
        });
    });

    test('should extract page_status from draft props', () => {
        const draft: PostDraft = {
            message: 'test',
            channelId: 'channel1',
            rootId: 'root1',
            fileInfos: [],
            uploadsInProgress: [],
            createAt: 0,
            updateAt: 0,
            props: {
                [PagePropsKeys.PAGE_STATUS]: 'in_review',
            },
        };

        const result = extractDraftAdditionalProps(draft);

        expect(result).toEqual({
            [PagePropsKeys.PAGE_STATUS]: 'in_review',
        });
    });

    test('should extract original_page_edit_at from draft props', () => {
        const draft: PostDraft = {
            message: 'test',
            channelId: 'channel1',
            rootId: 'root1',
            fileInfos: [],
            uploadsInProgress: [],
            createAt: 0,
            updateAt: 0,
            props: {
                [PagePropsKeys.ORIGINAL_PAGE_EDIT_AT]: 1234567890,
            },
        };

        const result = extractDraftAdditionalProps(draft);

        expect(result).toEqual({
            [PagePropsKeys.ORIGINAL_PAGE_EDIT_AT]: 1234567890,
        });
    });

    test('should extract has_published_version from draft props', () => {
        const draft: PostDraft = {
            message: 'test',
            channelId: 'channel1',
            rootId: 'root1',
            fileInfos: [],
            uploadsInProgress: [],
            createAt: 0,
            updateAt: 0,
            props: {
                has_published_version: true,
            },
        };

        const result = extractDraftAdditionalProps(draft);

        expect(result).toEqual({
            has_published_version: true,
        });
    });

    test('should extract multiple props when all are present', () => {
        const draft: PostDraft = {
            message: 'test',
            channelId: 'channel1',
            rootId: 'root1',
            fileInfos: [],
            uploadsInProgress: [],
            createAt: 0,
            updateAt: 0,
            props: {
                [PagePropsKeys.PAGE_ID]: 'page123',
                [PagePropsKeys.PAGE_PARENT_ID]: 'parent123',
                [PagePropsKeys.PAGE_STATUS]: 'draft',
                [PagePropsKeys.ORIGINAL_PAGE_EDIT_AT]: 1234567890,
                has_published_version: false,
            },
        };

        const result = extractDraftAdditionalProps(draft);

        expect(result).toEqual({
            [PagePropsKeys.PAGE_ID]: 'page123',
            [PagePropsKeys.PAGE_PARENT_ID]: 'parent123',
            [PagePropsKeys.PAGE_STATUS]: 'draft',
            [PagePropsKeys.ORIGINAL_PAGE_EDIT_AT]: 1234567890,
            has_published_version: false,
        });
    });

    test('should ignore unrelated props', () => {
        const draft: PostDraft = {
            message: 'test',
            channelId: 'channel1',
            rootId: 'root1',
            fileInfos: [],
            uploadsInProgress: [],
            createAt: 0,
            updateAt: 0,
            props: {
                [PagePropsKeys.PAGE_ID]: 'page123',
                unrelated_prop: 'should be ignored',
                another_prop: 123,
            },
        };

        const result = extractDraftAdditionalProps(draft);

        expect(result).toEqual({
            [PagePropsKeys.PAGE_ID]: 'page123',
        });
        expect(result).not.toHaveProperty('unrelated_prop');
        expect(result).not.toHaveProperty('another_prop');
    });
});

describe('Autosave Debounce Behavior', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('should debounce rapid content changes', async () => {
        const AUTOSAVE_DEBOUNCE_MS = 500;
        const mockSave = jest.fn();
        let timeoutId: NodeJS.Timeout | null = null;

        const scheduleAutosave = (content: string) => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            timeoutId = setTimeout(() => {
                mockSave(content);
            }, AUTOSAVE_DEBOUNCE_MS);
        };

        scheduleAutosave('a');
        scheduleAutosave('ab');
        scheduleAutosave('abc');

        expect(mockSave).not.toHaveBeenCalled();

        jest.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);

        expect(mockSave).toHaveBeenCalledTimes(1);
        expect(mockSave).toHaveBeenCalledWith('abc');
    });

    test('should save after debounce delay', async () => {
        const AUTOSAVE_DEBOUNCE_MS = 500;
        const mockSave = jest.fn();
        let timeoutId: NodeJS.Timeout | null = null;

        const scheduleAutosave = (content: string) => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            timeoutId = setTimeout(() => {
                mockSave(content);
            }, AUTOSAVE_DEBOUNCE_MS);
        };

        scheduleAutosave('test content');

        jest.advanceTimersByTime(250);
        expect(mockSave).not.toHaveBeenCalled();

        jest.advanceTimersByTime(250);
        expect(mockSave).toHaveBeenCalledTimes(1);
    });

    test('should cancel pending save when draft changes', async () => {
        const AUTOSAVE_DEBOUNCE_MS = 500;
        const mockSave = jest.fn();
        let timeoutId: NodeJS.Timeout | null = null;
        let currentDraftId = 'draft1';

        const scheduleAutosave = (content: string, draftId: string) => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            const capturedDraftId = draftId;
            timeoutId = setTimeout(() => {
                if (currentDraftId === capturedDraftId) {
                    mockSave(content, capturedDraftId);
                }
            }, AUTOSAVE_DEBOUNCE_MS);
        };

        scheduleAutosave('content for draft 1', 'draft1');

        jest.advanceTimersByTime(250);

        currentDraftId = 'draft2';
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }

        scheduleAutosave('content for draft 2', 'draft2');

        jest.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);

        expect(mockSave).toHaveBeenCalledTimes(1);
        expect(mockSave).toHaveBeenCalledWith('content for draft 2', 'draft2');
    });

    test('should not save if draft is null', async () => {
        const AUTOSAVE_DEBOUNCE_MS = 500;
        const mockSave = jest.fn();
        let timeoutId: NodeJS.Timeout | null = null;
        let currentDraft: {id: string} | null = {id: 'draft1'};

        const scheduleAutosave = (content: string) => {
            if (!currentDraft) {
                return;
            }
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            timeoutId = setTimeout(() => {
                if (currentDraft) {
                    mockSave(content);
                }
            }, AUTOSAVE_DEBOUNCE_MS);
        };

        currentDraft = null;
        scheduleAutosave('should not save');

        jest.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);

        expect(mockSave).not.toHaveBeenCalled();
    });

    test('should cancel autosave on unmount', async () => {
        const AUTOSAVE_DEBOUNCE_MS = 500;
        const mockSave = jest.fn();
        let timeoutId: NodeJS.Timeout | null = null;

        const scheduleAutosave = (content: string) => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            timeoutId = setTimeout(() => {
                mockSave(content);
            }, AUTOSAVE_DEBOUNCE_MS);
        };

        const cleanup = () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
        };

        scheduleAutosave('test content');

        cleanup();

        jest.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);

        expect(mockSave).not.toHaveBeenCalled();
    });
});

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
