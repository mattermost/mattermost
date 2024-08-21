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

    test('should render null there is no license currently loaded', () => {
        const state = {
            entities: {
                users: {
                    currentUserId: 'test_id',
                    profiles: {
                        test_id: {
                            id: 'test_id',
                            roles: 'system_user',
                        },
                    },
                },
                general: {
                    config: {},
                    license: {
                        IsLicensed: 'false',
                        IsTrial: 'false',
                    },
                },
            },
        };
        const store = mockStore(state);
        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);
        const wrapper = mountWithIntl(<reactRedux.Provider store={store}><MenuStartTrial id='startTrial'/></reactRedux.Provider>);
        expect(wrapper.find('.editionText').exists()).toBe(true);
    });

    test('should render null when there is a license currently loaded', () => {
        const state = {
            entities: {
                users: {
                    currentUserId: 'test_id',
                    profiles: {
                        test_id: {
                            id: 'test_id',
                            roles: 'system_user',
                        },
                    },
                },
                general: {
                    config: {},
                    license: {
                        IsLicensed: 'true',
                        IsTrial: 'false',
                    },
                },
            },
        };
        const store = mockStore(state);
        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);
        const wrapper = mountWithIntl(<reactRedux.Provider store={store}><MenuStartTrial id='startTrial'/></reactRedux.Provider>);
        expect(wrapper.find('.editionText').exists()).toBe(false);
    });
});
