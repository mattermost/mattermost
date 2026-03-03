// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as PageDraftActions from 'actions/page_drafts';

import {debounceSavePageDraft} from './draft_autosave';

jest.mock('actions/page_drafts');

const mockSavePageDraft = PageDraftActions.savePageDraft as jest.MockedFunction<typeof PageDraftActions.savePageDraft>;

describe('draft_autosave', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
        debounceSavePageDraft.cancel();
    });

    describe('debounceSavePageDraft', () => {
        const mockDispatch = jest.fn();
        const channelId = 'channel123';
        const wikiId = 'wiki123';
        const pageId = 'page123';
        const message = '{"type":"doc","content":[]}';
        const title = 'Test Page';

        test('should not call savePageDraft immediately', () => {
            debounceSavePageDraft(mockDispatch, channelId, wikiId, pageId, message, title);

            expect(mockSavePageDraft).not.toHaveBeenCalled();
        });

        test('should call savePageDraft after 500ms debounce', () => {
            mockSavePageDraft.mockReturnValue(jest.fn() as any);

            debounceSavePageDraft(mockDispatch, channelId, wikiId, pageId, message, title);

            jest.advanceTimersByTime(499);
            expect(mockSavePageDraft).not.toHaveBeenCalled();

            jest.advanceTimersByTime(1);
            expect(mockSavePageDraft).toHaveBeenCalledTimes(1);
            expect(mockSavePageDraft).toHaveBeenCalledWith(channelId, wikiId, pageId, message, title);
        });

        test('should dispatch the savePageDraft action', () => {
            const mockAction = jest.fn();
            mockSavePageDraft.mockReturnValue(mockAction as any);

            debounceSavePageDraft(mockDispatch, channelId, wikiId, pageId, message, title);

            jest.advanceTimersByTime(500);

            expect(mockDispatch).toHaveBeenCalledWith(mockAction);
        });

        test('should debounce multiple rapid calls', () => {
            mockSavePageDraft.mockReturnValue(jest.fn() as any);

            // First call
            debounceSavePageDraft(mockDispatch, channelId, wikiId, pageId, 'content1', 'title1');
            jest.advanceTimersByTime(200);

            // Second call - resets the timer
            debounceSavePageDraft(mockDispatch, channelId, wikiId, pageId, 'content2', 'title2');
            jest.advanceTimersByTime(200);

            // Third call - resets the timer again
            debounceSavePageDraft(mockDispatch, channelId, wikiId, pageId, 'content3', 'title3');
            jest.advanceTimersByTime(200);

            // Still not called yet
            expect(mockSavePageDraft).not.toHaveBeenCalled();

            // Wait remaining time
            jest.advanceTimersByTime(300);

            // Should only be called once with the last values
            expect(mockSavePageDraft).toHaveBeenCalledTimes(1);
            expect(mockSavePageDraft).toHaveBeenCalledWith(channelId, wikiId, pageId, 'content3', 'title3');
        });

        test('should handle empty title', () => {
            mockSavePageDraft.mockReturnValue(jest.fn() as any);

            debounceSavePageDraft(mockDispatch, channelId, wikiId, pageId, message, '');

            jest.advanceTimersByTime(500);

            expect(mockSavePageDraft).toHaveBeenCalledWith(channelId, wikiId, pageId, message, '');
        });

        test('should handle undefined title', () => {
            mockSavePageDraft.mockReturnValue(jest.fn() as any);

            debounceSavePageDraft(mockDispatch, channelId, wikiId, pageId, message, undefined as any);

            jest.advanceTimersByTime(500);

            expect(mockSavePageDraft).toHaveBeenCalledWith(channelId, wikiId, pageId, message, undefined);
        });

        test('cancel should prevent pending save', () => {
            mockSavePageDraft.mockReturnValue(jest.fn() as any);

            debounceSavePageDraft(mockDispatch, channelId, wikiId, pageId, message, title);

            jest.advanceTimersByTime(250);

            // Cancel before debounce completes
            debounceSavePageDraft.cancel();

            jest.advanceTimersByTime(500);

            expect(mockSavePageDraft).not.toHaveBeenCalled();
        });

        test('flush should immediately execute pending save', () => {
            mockSavePageDraft.mockReturnValue(jest.fn() as any);

            debounceSavePageDraft(mockDispatch, channelId, wikiId, pageId, message, title);

            // Flush immediately
            debounceSavePageDraft.flush();

            expect(mockSavePageDraft).toHaveBeenCalledTimes(1);
            expect(mockSavePageDraft).toHaveBeenCalledWith(channelId, wikiId, pageId, message, title);
        });

        test('should handle different wiki/page combinations correctly', () => {
            mockSavePageDraft.mockReturnValue(jest.fn() as any);

            // Save to first page
            debounceSavePageDraft(mockDispatch, channelId, 'wiki1', 'page1', 'content1', 'title1');
            jest.advanceTimersByTime(500);

            expect(mockSavePageDraft).toHaveBeenCalledWith(channelId, 'wiki1', 'page1', 'content1', 'title1');

            mockSavePageDraft.mockClear();

            // Save to different page
            debounceSavePageDraft(mockDispatch, channelId, 'wiki2', 'page2', 'content2', 'title2');
            jest.advanceTimersByTime(500);

            expect(mockSavePageDraft).toHaveBeenCalledWith(channelId, 'wiki2', 'page2', 'content2', 'title2');
        });
    });
});
