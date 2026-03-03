// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {renderHook} from '@testing-library/react';

import * as Selectors from 'mattermost-redux/selectors/entities/active_editors';

import * as Actions from 'actions/active_editors';

import {useActiveEditors} from 'hooks/useActiveEditors';

jest.mock('react-redux', () => ({
    useDispatch: () => jest.fn(),
    useSelector: (selector: any) => selector(),
}));

jest.mock('actions/active_editors');
jest.mock('mattermost-redux/selectors/entities/active_editors');

const mockFetchActiveEditors = Actions.fetchActiveEditors as jest.MockedFunction<typeof Actions.fetchActiveEditors>;
const mockRemoveStaleEditors = Actions.removeStaleEditors as jest.MockedFunction<typeof Actions.removeStaleEditors>;
const mockGetActiveEditorsWithProfiles = Selectors.getActiveEditorsWithProfiles as jest.MockedFunction<typeof Selectors.getActiveEditorsWithProfiles>;

describe('useActiveEditors', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('should fetch active editors on mount', () => {
        const wikiId = 'wiki123';
        const pageId = 'page123';

        mockGetActiveEditorsWithProfiles.mockReturnValue([]);
        mockFetchActiveEditors.mockReturnValue(jest.fn() as any);

        renderHook(() => useActiveEditors(wikiId, pageId));

        expect(mockFetchActiveEditors).toHaveBeenCalledWith(wikiId, pageId);
    });

    test('should return active editors from selector', () => {
        const wikiId = 'wiki123';
        const pageId = 'page123';
        const mockEditors = [
            {
                userId: 'user1',
                lastActivity: Date.now(),
                user: {id: 'user1', username: 'john.doe'},
            },
        ];

        mockGetActiveEditorsWithProfiles.mockReturnValue(mockEditors as any);
        mockFetchActiveEditors.mockReturnValue(jest.fn() as any);

        const {result} = renderHook(() => useActiveEditors(wikiId, pageId));

        expect(result.current).toEqual(mockEditors);
    });

    test('should start cleanup interval on mount', () => {
        const wikiId = 'wiki123';
        const pageId = 'page123';

        mockGetActiveEditorsWithProfiles.mockReturnValue([]);
        mockFetchActiveEditors.mockReturnValue(jest.fn() as any);
        mockRemoveStaleEditors.mockReturnValue(jest.fn() as any);

        renderHook(() => useActiveEditors(wikiId, pageId));

        jest.advanceTimersByTime(60000);

        expect(mockRemoveStaleEditors).toHaveBeenCalledWith(pageId);
    });

    test('should cleanup interval on unmount', () => {
        const wikiId = 'wiki123';
        const pageId = 'page123';

        mockGetActiveEditorsWithProfiles.mockReturnValue([]);
        mockFetchActiveEditors.mockReturnValue(jest.fn() as any);
        mockRemoveStaleEditors.mockReturnValue(jest.fn() as any);

        const {unmount} = renderHook(() => useActiveEditors(wikiId, pageId));

        unmount();

        jest.advanceTimersByTime(60000);

        expect(mockRemoveStaleEditors).not.toHaveBeenCalled();
    });

    test('should not fetch if wikiId is empty', () => {
        const wikiId = '';
        const pageId = 'page123';

        mockGetActiveEditorsWithProfiles.mockReturnValue([]);

        renderHook(() => useActiveEditors(wikiId, pageId));

        expect(mockFetchActiveEditors).not.toHaveBeenCalled();
    });

    test('should not fetch if pageId is empty', () => {
        const wikiId = 'wiki123';
        const pageId = '';

        mockGetActiveEditorsWithProfiles.mockReturnValue([]);

        renderHook(() => useActiveEditors(wikiId, pageId));

        expect(mockFetchActiveEditors).not.toHaveBeenCalled();
    });

    test('should call removeStaleEditors every 60 seconds', () => {
        const wikiId = 'wiki123';
        const pageId = 'page123';

        mockGetActiveEditorsWithProfiles.mockReturnValue([]);
        mockFetchActiveEditors.mockReturnValue(jest.fn() as any);
        mockRemoveStaleEditors.mockReturnValue(jest.fn() as any);

        renderHook(() => useActiveEditors(wikiId, pageId));

        jest.advanceTimersByTime(60000);
        expect(mockRemoveStaleEditors).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(60000);
        expect(mockRemoveStaleEditors).toHaveBeenCalledTimes(2);

        jest.advanceTimersByTime(60000);
        expect(mockRemoveStaleEditors).toHaveBeenCalledTimes(3);
    });

    test('should refetch when wikiId changes', () => {
        const initialWikiId = 'wiki123';
        const newWikiId = 'wiki456';
        const pageId = 'page123';

        mockGetActiveEditorsWithProfiles.mockReturnValue([]);
        mockFetchActiveEditors.mockReturnValue(jest.fn() as any);

        const {rerender} = renderHook(
            ({wikiId, pageId}) => useActiveEditors(wikiId, pageId),
            {
                initialProps: {wikiId: initialWikiId, pageId},
            },
        );

        expect(mockFetchActiveEditors).toHaveBeenCalledWith(initialWikiId, pageId);

        rerender({wikiId: newWikiId, pageId});

        expect(mockFetchActiveEditors).toHaveBeenCalledWith(newWikiId, pageId);
        expect(mockFetchActiveEditors).toHaveBeenCalledTimes(2);
    });

    test('should refetch when pageId changes', () => {
        const wikiId = 'wiki123';
        const initialPageId = 'page123';
        const newPageId = 'page456';

        mockGetActiveEditorsWithProfiles.mockReturnValue([]);
        mockFetchActiveEditors.mockReturnValue(jest.fn() as any);

        const {rerender} = renderHook(
            ({wikiId, pageId}) => useActiveEditors(wikiId, pageId),
            {
                initialProps: {wikiId, pageId: initialPageId},
            },
        );

        expect(mockFetchActiveEditors).toHaveBeenCalledWith(wikiId, initialPageId);

        rerender({wikiId, pageId: newPageId});

        expect(mockFetchActiveEditors).toHaveBeenCalledWith(wikiId, newPageId);
        expect(mockFetchActiveEditors).toHaveBeenCalledTimes(2);
    });
});
