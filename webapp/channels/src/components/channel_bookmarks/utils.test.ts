// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';
import type {GlobalState} from '@mattermost/types/store';

import {getFileDownloadUrl} from 'mattermost-redux/utils/file_utils';

import {shouldOpenInNewTab} from 'utils/url';
import {copyToClipboard} from 'utils/utils';

import {bookmarkHasLinkUrl, copyBookmarkLink, getHaveIChannelBookmarkPermission, shouldOpenBookmarkInNewTab} from './utils';

jest.mock('utils/url', () => ({
    shouldOpenInNewTab: jest.fn(),
}));

jest.mock('utils/utils', () => ({
    copyToClipboard: jest.fn(),
}));

jest.mock('mattermost-redux/utils/file_utils', () => ({
    getFileDownloadUrl: jest.fn((fileId: string) => `/files/${fileId}`),
}));

function makeBookmark(overrides: Partial<ChannelBookmark> = {}): ChannelBookmark {
    return {
        id: 'bm1',
        channel_id: 'c1',
        owner_id: 'u1',
        display_name: 'Test',
        sort_order: 0,
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        ...overrides,
    } as ChannelBookmark;
}

describe('bookmarkHasLinkUrl', () => {
    test('returns true for link bookmarks with link_url', () => {
        expect(bookmarkHasLinkUrl(makeBookmark({type: 'link', link_url: 'https://example.com'}))).toBe(true);
    });

    test('returns true for board bookmarks with link_url', () => {
        expect(bookmarkHasLinkUrl(makeBookmark({type: 'board', link_url: '/team/boards/abc123'}))).toBe(true);
    });

    test('returns false when link_url is missing', () => {
        expect(bookmarkHasLinkUrl(makeBookmark({type: 'link', link_url: ''}))).toBe(false);
        expect(bookmarkHasLinkUrl(makeBookmark({type: 'board', link_url: undefined}))).toBe(false);
    });

    test('returns false for file bookmarks regardless of link_url', () => {
        expect(bookmarkHasLinkUrl(makeBookmark({type: 'file', link_url: 'https://example.com'}))).toBe(false);
    });
});

describe('shouldOpenBookmarkInNewTab', () => {
    const mockedShouldOpenInNewTab = jest.mocked(shouldOpenInNewTab);

    beforeEach(() => {
        mockedShouldOpenInNewTab.mockReset();
    });

    test('returns false when bookmark has no navigable link_url', () => {
        expect(shouldOpenBookmarkInNewTab(makeBookmark({type: 'file', file_id: 'f1'}))).toBe(false);
        expect(mockedShouldOpenInNewTab).not.toHaveBeenCalled();
    });

    test('delegates to shouldOpenInNewTab for link bookmarks', () => {
        const bookmark = makeBookmark({type: 'link', link_url: 'https://external.example'});
        mockedShouldOpenInNewTab.mockReturnValue(true);

        expect(shouldOpenBookmarkInNewTab(bookmark, 'http://localhost')).toBe(true);
        expect(mockedShouldOpenInNewTab).toHaveBeenCalledWith('https://external.example', 'http://localhost');
    });

    test('delegates to shouldOpenInNewTab for board bookmarks', () => {
        const bookmark = makeBookmark({type: 'board', link_url: '/team/boards/abc'});
        mockedShouldOpenInNewTab.mockReturnValue(false);

        expect(shouldOpenBookmarkInNewTab(bookmark, 'http://localhost')).toBe(false);
        expect(mockedShouldOpenInNewTab).toHaveBeenCalledWith('/team/boards/abc', 'http://localhost');
    });
});

describe('copyBookmarkLink', () => {
    beforeEach(() => {
        jest.mocked(copyToClipboard).mockClear();
        jest.mocked(getFileDownloadUrl).mockClear();
    });

    test('copies link_url for link bookmarks', () => {
        copyBookmarkLink(makeBookmark({type: 'link', link_url: 'https://example.com/doc'}));

        expect(copyToClipboard).toHaveBeenCalledWith('https://example.com/doc');
        expect(getFileDownloadUrl).not.toHaveBeenCalled();
    });

    test('copies link_url for board bookmarks', () => {
        copyBookmarkLink(makeBookmark({type: 'board', link_url: '/team/boards/abc'}));

        expect(copyToClipboard).toHaveBeenCalledWith('/team/boards/abc');
        expect(getFileDownloadUrl).not.toHaveBeenCalled();
    });

    test('copies file download URL for file bookmarks', () => {
        copyBookmarkLink(makeBookmark({type: 'file', file_id: 'file-99'}));

        expect(getFileDownloadUrl).toHaveBeenCalledWith('file-99');
        expect(copyToClipboard).toHaveBeenCalledWith('/files/file-99');
    });

    test('does not copy when file bookmark has no file_id', () => {
        copyBookmarkLink(makeBookmark({type: 'file', file_id: ''}));

        expect(copyToClipboard).not.toHaveBeenCalled();
        expect(getFileDownloadUrl).not.toHaveBeenCalled();
    });
});

describe('getHaveIChannelBookmarkPermission in a DM', () => {
    function makeState(dmGmWriteAllowed?: boolean) {
        return {
            entities: {
                general: {config: {FeatureFlagPermissionPolicies: 'true'}},
                channels: {
                    channels: {dm1: {id: 'dm1', type: 'D', delete_at: 0, team_id: ''}},
                    myMembers: {dm1: {channel_id: 'dm1'}},
                },
                renderPermissions: {
                    byResource: dmGmWriteAllowed === undefined ? {} : {permission: {'': {dm_gm_write_access: {allowed: dmGmWriteAllowed, evaluated: true, generation: 1}}}},
                },
            },
        } as unknown as GlobalState;
    }

    test('allows a member to add bookmarks while dm_gm_write_access is unknown or allows', () => {
        expect(getHaveIChannelBookmarkPermission(makeState(), 'dm1', 'add')).toBe(true);
        expect(getHaveIChannelBookmarkPermission(makeState(true), 'dm1', 'add')).toBe(true);
    });

    test('withholds every bookmark action while dm_gm_write_access denies', () => {
        const state = makeState(false);

        expect(getHaveIChannelBookmarkPermission(state, 'dm1', 'add')).toBe(false);
        expect(getHaveIChannelBookmarkPermission(state, 'dm1', 'edit')).toBe(false);
        expect(getHaveIChannelBookmarkPermission(state, 'dm1', 'delete')).toBe(false);
        expect(getHaveIChannelBookmarkPermission(state, 'dm1', 'order')).toBe(false);
    });
});
