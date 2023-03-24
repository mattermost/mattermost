// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as reactRedux from 'react-redux';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import mockStore from 'tests/test_store';

import MenuStartTrial from './menu_start_trial';

describe('components/widgets/menu/menu_items/menu_start_trial', () => {
    const useDispatchMock = jest.spyOn(reactRedux, 'useDispatch');

    beforeEach(() => {
        useDispatchMock.mockClear();
    });

    test('should render when no trial license has ever been used and there is no license currently loaded', () => {
        const state = {
            entities: {
                users: {
                    currentUserId: 'test_id',
                },
                general: {
                    config: {
                        EnableTutorial: true,
                    },
                    license: {
                        IsLicensed: 'false',
                    },
                },
                admin: {
                    prevTrialLicense: {
                        IsLicensed: 'false',
                    },
                },
                preferences: {
                    myPreferences: {
                        'tutorial_step-test_id': {
                            user_id: 'test_id',
                            category: 'tutorial_step',
                            name: 'test_id',
                            value: '6',
                        },
                    },
                },
            },
        };
        const store = mockStore(state);
        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);
        const wrapper = mountWithIntl(<reactRedux.Provider store={store}><MenuStartTrial id='startTrial'/></reactRedux.Provider>);
        expect(wrapper.find('button').exists()).toEqual(true);
    });

    test('should render null when prevTrialLicense was used and there is no license currently loaded', () => {
        const state = {
            entities: {
                users: {
                    currentUserId: 'test_id',
                },
                general: {
                    config: {
                        EnableTutorial: true,
                    },
                    license: {
                        IsLicensed: 'false',
                        IsTrial: 'false',
                    },
                },
                admin: {
                    prevTrialLicense: {
                        IsLicensed: 'true',
                    },
                },
                preferences: {
                    myPreferences: {
                        'tutorial_step-test_id': {
                            user_id: 'test_id',
                            category: 'tutorial_step',
                            name: 'test_id',
                            value: '6',
                        },
                    },
                },
            },
        };
        const store = mockStore(state);
        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);
        const wrapper = mountWithIntl(<reactRedux.Provider store={store}><MenuStartTrial id='startTrial'/></reactRedux.Provider>);
        expect(wrapper.find('button').exists()).toEqual(false);
    });

    test('should render null when no trial license has ever been used but there is a license currently loaded', () => {
        const state = {
            entities: {
                users: {
                    currentUserId: 'test_id',
                },
                general: {
                    config: {
                        EnableTutorial: true,
                    },
                    license: {
                        IsLicensed: 'true',
                        IsTrial: 'false',
                    },
                },
                admin: {
                    prevTrialLicense: {
                        IsLicensed: 'false',
                    },
                },
                preferences: {
                    myPreferences: {
                        'tutorial_step-test_id': {
                            user_id: 'test_id',
                            category: 'tutorial_step',
                            name: 'test_id',
                            value: '6',
                        },
                    },
                },
            },
        };
        const store = mockStore(state);
        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);
        const wrapper = mountWithIntl(<reactRedux.Provider store={store}><MenuStartTrial id='startTrial'/></reactRedux.Provider>);
        expect(wrapper.find('button').exists()).toEqual(false);
    });

    test('should render menu option that open the start trial benefits modal when is current licensed but is trial', () => {
        const state = {
            entities: {
                users: {
                    currentUserId: 'test_id',
                },
                general: {
                    config: {
                        EnableTutorial: true,
                    },
                    license: {
                        IsLicensed: 'true',
                        IsTrial: 'true',
                    },
                },
                admin: {
                    prevTrialLicense: {
                        IsLicensed: 'false',
                    },
                },
                preferences: {
                    myPreferences: {
                        'tutorial_step-test_id': {
                            user_id: 'test_id',
                            category: 'tutorial_step',
                            name: 'test_id',
                            value: '6',
                        },
                    },
                },
            },
        };
        const store = mockStore(state);
        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);
        const wrapper = mountWithIntl(<reactRedux.Provider store={store}><MenuStartTrial id='startTrial'/></reactRedux.Provider>);
        expect(wrapper.find('button').exists()).toEqual(true);
        expect(wrapper.find('button').text()).toEqual('Learn More');
    });

    test('should render menu option that open the start trial modal when has no license and no previous license', () => {
        const state = {
            entities: {
                users: {
                    currentUserId: 'test_id',
                },
                general: {
                    config: {
                        EnableTutorial: true,
                    },
                    license: {
                        IsLicensed: 'false',
                        IsTrial: 'false',
                    },
                },
                admin: {
                    prevTrialLicense: {
                        IsLicensed: 'false',
                    },
                },
                preferences: {
                    myPreferences: {
                        'tutorial_step-test_id': {
                            user_id: 'test_id',
                            category: 'tutorial_step',
                            name: 'test_id',
                            value: '6',
                        },
                    },
                },
            },
        };
        const store = mockStore(state);
        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);
        const wrapper = mountWithIntl(<reactRedux.Provider store={store}><MenuStartTrial id='startTrial'/></reactRedux.Provider>);
        expect(wrapper.find('button').exists()).toEqual(true);
        expect(wrapper.find('div.start_trial_content').text()).toEqual('Try Enterprise for free now!');
        expect(wrapper.find('button').text()).toEqual('Learn More');
    });
});
