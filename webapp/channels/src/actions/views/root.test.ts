// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as Actions from 'actions/views/root';

import mockStore from 'tests/test_store';
import {ActionTypes} from 'utils/constants';

jest.mock('selectors/i18n', () => ({
    getTranslations: jest.fn(),
    getCurrentLocale: jest.fn(),
}));

const i18nSelectors = require('selectors/i18n');

describe('root view actions', () => {
    const origCookies = document.cookie;
    const origWasLoggedIn = localStorage.getItem('was_logged_in');

    beforeAll(() => {
        document.cookie = '';
        localStorage.setItem('was_logged_in', '');
    });

    afterAll(() => {
        document.cookie = origCookies;
        localStorage.setItem('was_logged_in', origWasLoggedIn || '');
    });

    describe('registerPluginTranslationsSource', () => {
        test('Should not dispatch action when getTranslation is empty', () => {
            const testStore = mockStore({});

            i18nSelectors.getTranslations.mockReturnValue(undefined as any);
            i18nSelectors.getCurrentLocale.mockReturnValue('en');

            testStore.dispatch(Actions.registerPluginTranslationsSource('plugin_id', jest.fn()));
            expect(testStore.getActions()).toEqual([]);
        });

        test('Should dispatch action when getTranslation is not empty', () => {
            const testStore = mockStore({});

            i18nSelectors.getTranslations.mockReturnValue({});
            i18nSelectors.getCurrentLocale.mockReturnValue('en');

            testStore.dispatch(Actions.registerPluginTranslationsSource('plugin_id', jest.fn()));
            expect(testStore.getActions()).toEqual([{
                data: {
                    locale: 'en',
                    translations: {},
                },
                type: ActionTypes.RECEIVED_TRANSLATIONS,
            }]);
        });
    });
});
