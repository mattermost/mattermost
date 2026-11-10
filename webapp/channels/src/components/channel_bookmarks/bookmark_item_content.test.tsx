// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act} from '@testing-library/react';
import * as ReactRedux from 'react-redux';

import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';
import type {FileInfo} from '@mattermost/types/files';

import {renderHookWithContext} from 'tests/react_testing_utils';
import {ActionTypes, ModalIdentifiers} from 'utils/constants';

import {useBookmarkLink} from './bookmark_item_content';

function makeLinkBookmark(overrides: Partial<ChannelBookmark> = {}): ChannelBookmark {
    return {
        id: 'bm1',
        channel_id: 'c1',
        owner_id: 'u1',
        type: 'link',
        link_url: 'https://example.com/page',
        display_name: 'Example',
        sort_order: 0,
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        ...overrides,
    } as ChannelBookmark;
}

function makeFileBookmark(overrides: Partial<ChannelBookmark> = {}): ChannelBookmark {
    return {
        id: 'bm2',
        channel_id: 'c1',
        owner_id: 'u1',
        type: 'file',
        file_id: 'f1',
        display_name: 'Doc.pdf',
        sort_order: 0,
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        ...overrides,
    } as ChannelBookmark;
}

const fileInfoFixture: Partial<FileInfo> = {
    id: 'f1',
    name: 'Doc.pdf',
    extension: 'pdf',
    size: 1234,
};

describe('useBookmarkLink', () => {
    let dispatchMock: jest.Mock;

    beforeEach(() => {
        dispatchMock = jest.fn();
        jest.spyOn(ReactRedux, 'useDispatch').mockReturnValue(dispatchMock);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('href computation', () => {
        test('link bookmark returns the link_url when not disabled', () => {
            const {result} = renderHookWithContext(
                () => useBookmarkLink(makeLinkBookmark(), false),
            );

            expect(result.current.href).toBe('https://example.com/page');
            expect(result.current.isFile).toBe(false);
        });

        test('link bookmark returns "#" when disabled', () => {
            const {result} = renderHookWithContext(
                () => useBookmarkLink(makeLinkBookmark(), true),
            );

            expect(result.current.href).toBe('#');
        });

        test('file bookmark returns the download URL and isFile=true when not disabled', () => {
            const {result} = renderHookWithContext(
                () => useBookmarkLink(makeFileBookmark(), false),
                {entities: {files: {files: {f1: fileInfoFixture as FileInfo}}}},
            );

            expect(result.current.href).toContain('/api/v4/files/f1');
            expect(result.current.isFile).toBe(true);
        });

        test('file bookmark returns "#" when disabled', () => {
            const {result} = renderHookWithContext(
                () => useBookmarkLink(makeFileBookmark(), true),
                {entities: {files: {files: {f1: fileInfoFixture as FileInfo}}}},
            );

            expect(result.current.href).toBe('#');
        });
    });

    describe('onClick wiring', () => {
        test('link with onNavigate sets onClick to a handler that calls onNavigate', () => {
            const onNavigate = jest.fn();
            const {result} = renderHookWithContext(
                () => useBookmarkLink(makeLinkBookmark(), false, onNavigate),
            );

            expect(typeof result.current.onClick).toBe('function');
            const fakeEvent = {preventDefault: jest.fn()} as unknown as React.MouseEvent<HTMLElement>;
            result.current.onClick?.(fakeEvent);
            expect(onNavigate).toHaveBeenCalledTimes(1);
        });

        test('link without onNavigate has no onClick', () => {
            const {result} = renderHookWithContext(
                () => useBookmarkLink(makeLinkBookmark(), false),
            );

            expect(result.current.onClick).toBeUndefined();
        });

        test('file onClick preventDefaults and dispatches the file preview modal', () => {
            const {result} = renderHookWithContext(
                () => useBookmarkLink(makeFileBookmark(), false),
                {entities: {files: {files: {f1: fileInfoFixture as FileInfo}}}},
            );

            const fakeEvent = {preventDefault: jest.fn()} as unknown as React.MouseEvent<HTMLElement>;

            act(() => {
                result.current.onClick?.(fakeEvent);
            });

            expect(fakeEvent.preventDefault).toHaveBeenCalled();
            expect(dispatchMock).toHaveBeenCalledWith(expect.objectContaining({
                type: ActionTypes.MODAL_OPEN,
                modalId: ModalIdentifiers.FILE_PREVIEW_MODAL,
            }));
        });
    });

    describe('openBookmark (imperative)', () => {
        test('does nothing when disableLinks=true', () => {
            const {result} = renderHookWithContext(
                () => useBookmarkLink(makeLinkBookmark(), true),
            );

            act(() => {
                result.current.openBookmark();
            });

            expect(dispatchMock).not.toHaveBeenCalled();
        });

        test('file bookmark dispatches the file preview modal and calls onNavigate', () => {
            const onNavigate = jest.fn();
            const {result} = renderHookWithContext(
                () => useBookmarkLink(makeFileBookmark(), false, onNavigate),
                {entities: {files: {files: {f1: fileInfoFixture as FileInfo}}}},
            );

            act(() => {
                result.current.openBookmark();
            });

            expect(dispatchMock).toHaveBeenCalledWith(expect.objectContaining({
                type: ActionTypes.MODAL_OPEN,
                modalId: ModalIdentifiers.FILE_PREVIEW_MODAL,
            }));
            expect(onNavigate).toHaveBeenCalledTimes(1);
        });

        test('external link opens via window.open in a new tab', () => {
            const onNavigate = jest.fn();
            const windowOpenSpy = jest.spyOn(window, 'open').mockImplementation(() => null);

            try {
                const {result} = renderHookWithContext(
                    () => useBookmarkLink(makeLinkBookmark({link_url: 'https://elsewhere.example.com/'}), false, onNavigate),
                );

                act(() => {
                    result.current.openBookmark();
                });

                expect(windowOpenSpy).toHaveBeenCalledWith(
                    'https://elsewhere.example.com/',
                    '_blank',
                    'noopener,noreferrer',
                );
                expect(onNavigate).toHaveBeenCalledTimes(1);
            } finally {
                windowOpenSpy.mockRestore();
            }
        });
    });

    describe('open() (DOM click)', () => {
        test('clicks the rendered linkRef element', () => {
            const {result} = renderHookWithContext(
                () => useBookmarkLink(makeLinkBookmark(), false),
            );

            const click = jest.fn();
            (result.current.linkRef as React.MutableRefObject<HTMLAnchorElement | null>).current = {
                click,
            } as unknown as HTMLAnchorElement;

            act(() => {
                result.current.open();
            });

            expect(click).toHaveBeenCalledTimes(1);
        });

        test('is a no-op when linkRef is unset', () => {
            const {result} = renderHookWithContext(
                () => useBookmarkLink(makeLinkBookmark(), false),
            );

            // Should not throw
            expect(() => act(() => {
                result.current.open();
            })).not.toThrow();
        });
    });
});
