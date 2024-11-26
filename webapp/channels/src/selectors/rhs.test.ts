// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import cloneDeep from 'lodash/cloneDeep';

import * as Selectors from 'selectors/rhs';

import {StoragePrefixes} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

describe('Selectors.Rhs', () => {
    describe('should return the last time a post was selected', () => {
        [0, 1000000, 2000000].forEach((expected) => {
            it(`when open is ${expected}`, () => {
                const state = {views: {rhs: {
                    selectedPostFocussedAt: expected,
                }}} as GlobalState;

                expect(Selectors.getSelectedPostFocussedAt(state)).toEqual(expected);
            });
        });
    });

    describe('should return the open state of the sidebar', () => {
        [true, false].forEach((expected) => {
            it(`when open is ${expected}`, () => {
                const state = {views: {rhs: {
                    isSidebarOpen: expected,
                }}} as GlobalState;

                expect(Selectors.getIsRhsOpen(state)).toEqual(expected);
            });
        });
    });

    describe('should return the open state of the sidebar menu', () => {
        [true, false].forEach((expected) => {
            it(`when open is ${expected}`, () => {
                const state = {views: {rhs: {
                    isMenuOpen: expected,
                }}} as GlobalState;

                expect(Selectors.getIsRhsMenuOpen(state)).toEqual(expected);
            });
        });
    });

    describe('should return the highlighted reply\'s id', () => {
        test.each(['42', ''])('when id is %s', (expected) => {
            const state = {views: {rhs: {
                highlightedPostId: expected,
            }}} as GlobalState;

            expect(Selectors.getHighlightedPostId(state)).toEqual(expected);
        });
    });

    describe('should return the previousRhsState', () => {
        test.each([
            [[], null],
            [['channel-info'], 'channel-info'],
            [['channel-info', 'pinned'], 'pinned'],
        ])('%p gives %p', (previousArray, previous) => {
            const state = {
                views: {rhs: {
                    previousRhsStates: previousArray,
                }}} as GlobalState;
            expect(Selectors.getPreviousRhsState(state)).toEqual(previous);
        });
    });
});

describe('makeGetDraft', () => {
    const getDraft = Selectors.makeGetDraft();
    let initialStore: GlobalState;
    const channelId1 = TestHelper.getChannelMock({id: 'channelId1'}).id;
    const channelId2 = TestHelper.getChannelMock({id: 'channelId2'}).id;
    const draft1 = TestHelper.getPostDraftMock({message: 'draft 1 with channelId 1', channelId: channelId1});
    const draft2 = TestHelper.getPostDraftMock({message: 'draft 2 with channelId 2', channelId: channelId2});

    beforeEach(() => {
        initialStore = {storage: {storage: {
            [StoragePrefixes.DRAFT + channelId1]: {
                timestamp: Date.now(),
                value: draft1,
            },
            [StoragePrefixes.DRAFT + channelId2]: {
                timestamp: Date.now(),
                value: draft2,
            },
        }}} as GlobalState;
    });

    test('should return a draft with the correct fields', () => {
        const draft = getDraft(initialStore, channelId1);
        expect(draft).toEqual(draft1);
    });

    test('should return draft with correct fields even if some fields are missing from drafts in storage', () => {
        const store = cloneDeep(initialStore);
        delete store.storage.storage[StoragePrefixes.DRAFT + channelId1].value.message;
        delete store.storage.storage[StoragePrefixes.DRAFT + channelId1].value.fileInfos;
        delete store.storage.storage[StoragePrefixes.DRAFT + channelId1].value.uploadsInProgress;

        const draft = getDraft(store, channelId1);
        expect(draft.message).toBeDefined();
        expect(draft.fileInfos).toBeDefined();
        expect(draft.uploadsInProgress).toBeDefined();
    });

    test('should return a draft with the correct fields even if the draft\'s channelId or rootId mismatches with the passed one', () => {
        const store = cloneDeep(initialStore);

        // Change the channelId and rootId of the draft in storage of the draft
        store.storage.storage[StoragePrefixes.DRAFT + channelId2].value.channelId = 'channelId1New';
        store.storage.storage[StoragePrefixes.DRAFT + channelId2].value.rootId = 'rootId1';

        const draft = getDraft(store, channelId2);

        // Verify that the draft has the correct fields by which it is returned
        expect(draft).toEqual(draft2);
    });
});
