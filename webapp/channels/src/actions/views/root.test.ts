// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as Actions from 'actions/views/root';
import * as i18nSelectors from 'selectors/i18n';

import mockStore from 'tests/test_store';
import {ActionTypes} from 'utils/constants';

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

            jest.spyOn(i18nSelectors, 'getTranslations').mockReturnValue(undefined as any);
            jest.spyOn(i18nSelectors, 'getCurrentLocale').mockReturnValue('en');

            testStore.dispatch(Actions.registerPluginTranslationsSource('plugin_id', jest.fn()));
            expect(testStore.getActions()).toEqual([]);
        });

        test('Should dispatch action when getTranslation is not empty', () => {
            const testStore = mockStore({});

            jest.spyOn(i18nSelectors, 'getTranslations').mockReturnValue({});
            jest.spyOn(i18nSelectors, 'getCurrentLocale').mockReturnValue('en');

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
