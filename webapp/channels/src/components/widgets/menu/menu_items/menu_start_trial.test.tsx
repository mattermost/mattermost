// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import * as reactRedux from 'react-redux';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import mockStore from 'tests/test_store';
import {TestHelper} from 'utils/test_helper';

import MenuStartTrial from './menu_start_trial';

describe('components/widgets/menu/menu_items/menu_start_trial', () => {
    const useDispatchMock = jest.spyOn(reactRedux, 'useDispatch');

    beforeEach(() => {
        useDispatchMock.mockClear();
    });

    test('should render TEAM EDITION for unlicensed', () => {
        const state = {
            entities: {
                users: {
                    currentUserId: 'test_id',
                },
                general: {
                    license: TestHelper.getLicenseMock({
                        IsLicensed: 'false',
                        SkuShortName: '',
                    }),
                },
            },
        };
        const store = mockStore(state);
        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);
        const wrapper = mountWithIntl(<reactRedux.Provider store={store}><MenuStartTrial id='startTrial'/></reactRedux.Provider>);

        expect(wrapper.find('.editionText').exists()).toBe(true);
        expect(wrapper.text()).toContain('TEAM EDITION');
        expect(wrapper.text()).toContain('This is the free');
    });

    test('should render ENTRY EDITION for Entry license', () => {
        const state = {
            entities: {
                users: {
                    currentUserId: 'test_id',
                },
                general: {
                    license: TestHelper.getLicenseMock({
                        IsLicensed: 'true',
                        SkuShortName: 'entry',
                    }),
                },
            },
        };
        const store = mockStore(state);
        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);
        const wrapper = mountWithIntl(<reactRedux.Provider store={store}><MenuStartTrial id='startTrial'/></reactRedux.Provider>);

        expect(wrapper.find('.editionText').exists()).toBe(true);
        expect(wrapper.text()).toContain('ENTRY EDITION');
        expect(wrapper.text()).toContain('Entry offers Enterprise Advance capabilities');
    });

    test('should return null for Professional license', () => {
        const state = {
            entities: {
                users: {
                    currentUserId: 'test_id',
                },
                general: {
                    license: TestHelper.getLicenseMock({
                        IsLicensed: 'true',
                        SkuShortName: 'professional',
                    }),
                },
            },
        };
        const store = mockStore(state);
        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);
        const wrapper = mountWithIntl(<reactRedux.Provider store={store}><MenuStartTrial id='startTrial'/></reactRedux.Provider>);

        expect(wrapper.isEmptyRender()).toBe(true);
    });

    test('should return null for Enterprise license', () => {
        const state = {
            entities: {
                users: {
                    currentUserId: 'test_id',
                },
                general: {
                    license: TestHelper.getLicenseMock({
                        IsLicensed: 'true',
                        SkuShortName: 'enterprise',
                    }),
                },
            },
        };
        const store = mockStore(state);
        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);
        const wrapper = mountWithIntl(<reactRedux.Provider store={store}><MenuStartTrial id='startTrial'/></reactRedux.Provider>);

        expect(wrapper.isEmptyRender()).toBe(true);
    });
});
