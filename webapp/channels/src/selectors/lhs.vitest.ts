// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as PreferencesSelectors from 'mattermost-redux/selectors/entities/preferences';

import type {GlobalState} from 'types/store';

import * as Lhs from './lhs';

vi.mock('selectors/drafts', () => ({
    makeGetDraftsCount: vi.fn().mockImplementation(() => vi.fn()),
}));

vi.mock('mattermost-redux/selectors/entities/preferences', () => ({
    isCollapsedThreadsEnabled: vi.fn(),
}));

beforeEach(() => {
    vi.resetModules();
});

describe('Selectors.Lhs', () => {
    let state: unknown;

    beforeEach(() => {
        state = {};
    });

    describe('should return the open state of the sidebar menu', () => {
        [true, false].forEach((expected) => {
            test(`when open is ${expected}`, () => {
                state = {
                    views: {
                        lhs: {
                            isOpen: expected,
                        },
                    },
                };

                expect(Lhs.getIsLhsOpen(state as GlobalState)).toEqual(expected);
            });
        });
    });

    describe('getVisibleLhsStaticPages', () => {
        beforeEach(() => {
            state = {
                views: {
                    lhs: {
                        isOpen: false,
                        currentStaticPageId: '',
                    },
                },
            };
        });

        test('handles nothing enabled', () => {
            vi.spyOn(PreferencesSelectors, 'isCollapsedThreadsEnabled').mockImplementationOnce(() => false);
            vi.spyOn(Lhs, 'getDraftsCount').mockImplementationOnce(() => 0);
            const items = Lhs.getVisibleStaticPages(state as GlobalState);
            expect(items).toEqual([]);
        });

        test('handles threads - default off', () => {
            vi.spyOn(PreferencesSelectors, 'isCollapsedThreadsEnabled').mockImplementation(() => true);
            vi.spyOn(Lhs, 'getDraftsCount').mockImplementationOnce(() => 0);
            const items = Lhs.getVisibleStaticPages(state as GlobalState);
            expect(items).toEqual([
                {
                    id: 'threads',
                    isVisible: true,
                },
            ]);
        });

        test('should not return drafts when empty', () => {
            vi.spyOn(PreferencesSelectors, 'isCollapsedThreadsEnabled').mockImplementation(() => false);
            vi.spyOn(Lhs, 'getDraftsCount').mockImplementationOnce(() => 0);
            const items = Lhs.getVisibleStaticPages(state as GlobalState);
            expect(items).toEqual([]);
        });

        test('should return drafts when there are available', () => {
            vi.spyOn(PreferencesSelectors, 'isCollapsedThreadsEnabled').mockImplementation(() => false);
            vi.spyOn(Lhs, 'getDraftsCount').mockImplementationOnce(() => 1);
            const items = Lhs.getVisibleStaticPages(state as GlobalState);
            expect(items).toEqual([
                {
                    id: 'drafts',
                    isVisible: true,
                },
            ]);
        });
    });
});
