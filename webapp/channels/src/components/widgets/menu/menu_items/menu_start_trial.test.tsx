// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import * as reactRedux from 'react-redux';

import {renderWithContext} from 'tests/react_testing_utils';
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
        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);
        const {container} = renderWithContext(<MenuStartTrial id='startTrial'/>, state);

        expect(container.querySelector('.editionText')).not.toBeNull();
        expect(container.textContent).toContain('TEAM EDITION');
        expect(container.textContent).toContain('This is the free');
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
        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);
        const {container} = renderWithContext(<MenuStartTrial id='startTrial'/>, state);

        expect(container.querySelector('.editionText')).not.toBeNull();
        expect(container.textContent).toContain('ENTRY EDITION');
        expect(container.textContent).toContain('Entry offers Enterprise Advance capabilities');
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
        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);
        const {container} = renderWithContext(<MenuStartTrial id='startTrial'/>, state);

        expect(container.innerHTML).toBe('');
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
        const dummyDispatch = jest.fn();
        useDispatchMock.mockReturnValue(dummyDispatch);
        const {container} = renderWithContext(<MenuStartTrial id='startTrial'/>, state);

        expect(container.innerHTML).toBe('');
    });
});
