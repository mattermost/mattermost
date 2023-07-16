// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as PreferencesSelectors from 'mattermost-redux/selectors/entities/preferences';
import {GlobalState} from 'types/store';

import * as Lhs from './lhs';

jest.mock('selectors/drafts', () => ({
    makeGetDraftsCount: jest.fn().mockImplementation(() => jest.fn()),
}));

jest.mock('mattermost-redux/selectors/entities/preferences', () => ({
    insightsAreEnabled: jest.fn(),
    isCollapsedThreadsEnabled: jest.fn(),
}));

beforeEach(() => {
    jest.resetModules();
});

describe('Selectors.Lhs', () => {
    let state: unknown;

    beforeEach(() => {
        state = {};
    });

    describe('should return the open state of the sidebar menu', () => {
        [true, false].forEach((expected) => {
            it(`when open is ${expected}`, () => {
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

        it('handles nothing enabled', () => {
            jest.spyOn(PreferencesSelectors, 'insightsAreEnabled').mockImplementationOnce(() => false);
            jest.spyOn(PreferencesSelectors, 'isCollapsedThreadsEnabled').mockImplementationOnce(() => false);
            jest.spyOn(Lhs, 'getDraftsCount').mockImplementationOnce(() => 0);
            const items = Lhs.getVisibleStaticPages(state as GlobalState);
            expect(items).toEqual([]);
        });

        it('handles insights', () => {
            jest.spyOn(PreferencesSelectors, 'insightsAreEnabled').mockImplementation(() => true);
            jest.spyOn(PreferencesSelectors, 'isCollapsedThreadsEnabled').mockImplementation(() => false);
            jest.spyOn(Lhs, 'getDraftsCount').mockImplementationOnce(() => 0);
            const items = Lhs.getVisibleStaticPages(state as GlobalState);
            expect(items).toEqual([
                {
                    id: 'activity-and-insights',
                    isVisible: true,
                },
            ]);
        });

        it('handles threads - default off', () => {
            jest.spyOn(PreferencesSelectors, 'insightsAreEnabled').mockImplementation(() => false);
            jest.spyOn(PreferencesSelectors, 'isCollapsedThreadsEnabled').mockImplementation(() => true);
            jest.spyOn(Lhs, 'getDraftsCount').mockImplementationOnce(() => 0);
            const items = Lhs.getVisibleStaticPages(state as GlobalState);
            expect(items).toEqual([
                {
                    id: 'threads',
                    isVisible: true,
                },
            ]);
        });

        it('should not return drafts when empty', () => {
            jest.spyOn(PreferencesSelectors, 'insightsAreEnabled').mockImplementation(() => false);
            jest.spyOn(PreferencesSelectors, 'isCollapsedThreadsEnabled').mockImplementation(() => false);
            jest.spyOn(Lhs, 'getDraftsCount').mockImplementationOnce(() => 0);
            const items = Lhs.getVisibleStaticPages(state as GlobalState);
            expect(items).toEqual([]);
        });

        it('should return drafts when there are available', () => {
            jest.spyOn(PreferencesSelectors, 'insightsAreEnabled').mockImplementation(() => false);
            jest.spyOn(PreferencesSelectors, 'isCollapsedThreadsEnabled').mockImplementation(() => false);
            jest.spyOn(Lhs, 'getDraftsCount').mockImplementationOnce(() => 1);
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
