// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {renderHook, act} from '@testing-library/react';

import * as PageDraftActions from 'actions/page_drafts';
import * as PageDraftSelectors from 'selectors/page_drafts';

import {usePageDraft, useHasUnsavedChanges} from './usePageDraft';

jest.mock('react-redux', () => ({
    useDispatch: () => jest.fn((action) => action),
    useSelector: (selector: any) => selector(),
}));

jest.mock('actions/page_drafts');
jest.mock('selectors/page_drafts');

const mockSavePageDraft = PageDraftActions.savePageDraft as jest.MockedFunction<typeof PageDraftActions.savePageDraft>;
const mockRemovePageDraft = PageDraftActions.removePageDraft as jest.MockedFunction<typeof PageDraftActions.removePageDraft>;
const mockGetPageDraft = PageDraftSelectors.getPageDraft as jest.MockedFunction<typeof PageDraftSelectors.getPageDraft>;
const mockHasUnsavedChanges = PageDraftSelectors.hasUnsavedChanges as jest.MockedFunction<typeof PageDraftSelectors.hasUnsavedChanges>;

describe('usePageDraft', () => {
    const wikiId = 'wiki123';
    const pageId = 'page123';
    const channelId = 'channel123';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('usePageDraft hook', () => {
        test('should return draft from selector', () => {
            const mockDraft = {
                message: '{"type":"doc","content":[]}',
                props: {title: 'Test Page'},
                channelId,
                wikiId,
                rootId: pageId,
            };

            mockGetPageDraft.mockReturnValue(mockDraft as any);

            const {result} = renderHook(() => usePageDraft(wikiId, pageId, channelId));

            expect(result.current.draft).toEqual(mockDraft);
        });

        test('should return null draft when no draft exists', () => {
            mockGetPageDraft.mockReturnValue(null);

            const {result} = renderHook(() => usePageDraft(wikiId, pageId, channelId));

            expect(result.current.draft).toBeNull();
        });

        test('save should dispatch savePageDraft action', () => {
            mockGetPageDraft.mockReturnValue(null);
            mockSavePageDraft.mockReturnValue(jest.fn() as any);

            const {result} = renderHook(() => usePageDraft(wikiId, pageId, channelId));

            act(() => {
                result.current.save('{"type":"doc"}', 'My Title');
            });

            expect(mockSavePageDraft).toHaveBeenCalledWith(
                channelId,
                wikiId,
                pageId,
                '{"type":"doc"}',
                'My Title',
                undefined,
                undefined,
            );
        });

        test('save should pass additional props', () => {
            mockGetPageDraft.mockReturnValue(null);
            mockSavePageDraft.mockReturnValue(jest.fn() as any);

            const {result} = renderHook(() => usePageDraft(wikiId, pageId, channelId));

            const additionalProps = {page_parent_id: 'parent123', custom: 'value'};

            act(() => {
                result.current.save('{"type":"doc"}', 'Title', additionalProps);
            });

            expect(mockSavePageDraft).toHaveBeenCalledWith(
                channelId,
                wikiId,
                pageId,
                '{"type":"doc"}',
                'Title',
                undefined,
                additionalProps,
            );
        });

        test('remove should dispatch removePageDraft action', () => {
            mockGetPageDraft.mockReturnValue(null);
            mockRemovePageDraft.mockReturnValue(jest.fn() as any);

            const {result} = renderHook(() => usePageDraft(wikiId, pageId, channelId));

            act(() => {
                result.current.remove();
            });

            expect(mockRemovePageDraft).toHaveBeenCalledWith(wikiId, pageId);
        });
    });

    describe('useHasUnsavedChanges hook', () => {
        test('should return true when there are unsaved changes', () => {
            mockHasUnsavedChanges.mockReturnValue(true);

            const {result} = renderHook(() =>
                useHasUnsavedChanges(wikiId, pageId, '{"type":"doc","content":[]}'),
            );

            expect(result.current).toBe(true);
        });

        test('should return false when there are no unsaved changes', () => {
            mockHasUnsavedChanges.mockReturnValue(false);

            const {result} = renderHook(() =>
                useHasUnsavedChanges(wikiId, pageId, '{"type":"doc","content":[]}'),
            );

            expect(result.current).toBe(false);
        });

        test('should update when published content changes', () => {
            mockHasUnsavedChanges.mockReturnValue(false);

            const {result, rerender} = renderHook(
                ({publishedContent}) => useHasUnsavedChanges(wikiId, pageId, publishedContent),
                {initialProps: {publishedContent: '{"type":"doc"}'}},
            );

            expect(result.current).toBe(false);

            mockHasUnsavedChanges.mockReturnValue(true);
            rerender({publishedContent: '{"type":"doc","content":[{"type":"paragraph"}]}'});

            expect(result.current).toBe(true);
        });
    });
});
