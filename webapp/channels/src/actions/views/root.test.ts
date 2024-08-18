// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as Actions from 'actions/views/root';
import * as i18nSelectors from 'selectors/i18n';

import mockStore from 'tests/test_store';
import {ActionTypes} from 'utils/constants';

jest.mock('mattermost-redux/actions/general', () => {
    const original = jest.requireActual('mattermost-redux/actions/general');
    return {
        ...original,
        getClientConfig: () => ({type: 'MOCK_GET_CLIENT_CONFIG'}),
        getLicenseConfig: () => ({type: 'MOCK_GET_LICENSE_CONFIG'}),
    };
});

jest.mock('mattermost-redux/actions/users', () => {
    const original = jest.requireActual('mattermost-redux/actions/users');
    return {
        ...original,
        getMe: () => ({type: 'MOCK_LOAD_ME'}),
    };
});

jest.mock('mattermost-redux/actions/preferences', () => {
    const original = jest.requireActual('mattermost-redux/actions/preferences');
    return {
        ...original,
        getMyPreferences: () => ({type: 'MOCK_LOAD_PREFERENCES'}),
    };
});

jest.mock('mattermost-redux/actions/teams', () => {
    const original = jest.requireActual('mattermost-redux/actions/teams');
    return {
        ...original,
        getMyTeamMembers: () => ({type: 'MOCK_GET_MY_TEAM_MEMBERS'}),
        getMyTeams: () => ({type: 'MOCK_GET_MY_TEAMS'}),
        getMyTeamUnreads: () => ({type: 'MOCK_GET_MY_TEAM_UNREADS'}),
    };
});

jest.mock('mattermost-redux/selectors/entities/preferences', () => {
    const original = jest.requireActual('mattermost-redux/selectors/entities/preferences');
    return {
        ...original,
        isCollapsedThreadsEnabled: () => false,
    };
});

jest.mock('mattermost-redux/actions/limits', () => ({
    ...jest.requireActual('mattermost-redux/actions/limits'),
    getServerLimits: () => ({type: 'MOCK_GET_SERVER_LIMITS'}),
}));

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

    describe('loadConfigAndMe', () => {
        test('loadConfigAndMe, without user logged in', async () => {
            const testStore = mockStore({});

            await testStore.dispatch(Actions.loadConfigAndMe());
            expect(testStore.getActions()).toEqual([{type: 'MOCK_GET_CLIENT_CONFIG'}, {type: 'MOCK_GET_LICENSE_CONFIG'}]);
        });

        test('loadConfigAndMe, with user logged in', async () => {
            const testStore = mockStore({
                entities: {
                    general: {
                        serverVersion: '1.0.0',
                    },
                    users: {
                        currentUserId: 'userid',
                    },
                },
            });

            document.cookie = 'MMUSERID=userid';
            localStorage.setItem('was_logged_in', 'true');

            await testStore.dispatch(Actions.loadConfigAndMe());
            expect(testStore.getActions()).toEqual([
                {type: 'MOCK_GET_CLIENT_CONFIG'},
                {type: 'MOCK_GET_LICENSE_CONFIG'},
                {type: 'RECEIVED_SERVER_VERSION', data: '1.0.0'},
                {type: 'MOCK_LOAD_ME'},
                {type: 'MOCK_LOAD_PREFERENCES'},
                {type: 'MOCK_GET_MY_TEAMS'},
                {type: 'MOCK_GET_MY_TEAM_MEMBERS'},
                {type: 'MOCK_GET_MY_TEAM_UNREADS'},
                {type: 'MOCK_GET_SERVER_LIMITS'},
            ]);
        });
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
