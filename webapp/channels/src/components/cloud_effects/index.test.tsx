// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Provider} from 'react-redux';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import mockStore from 'tests/test_store';
import {DeepPartial} from '@mattermost/types/utilities';
import {GlobalState} from '@mattermost/types/store';

import {TestHelper} from 'utils/test_helper';

import * as useShowAdminLimitReachedHook from 'components/common/hooks/useShowAdminLimitReached';

import CloudEffectsWrapper from './';

function nonCloudLicense(state: DeepPartial<GlobalState>): GlobalState {
    const newState = JSON.parse(JSON.stringify(state));
    if (!newState.entities) {
        newState.entities = {};
    }

    if (!newState.entities.general) {
        newState.entities.general = {};
    }

    if (!newState.entities.general.license) {
        newState.entities.general.license = TestHelper.getLicenseMock();
    }
    newState.entities.general.license.Cloud = 'false';
    return newState;
}

function cloudLicense(state: DeepPartial<GlobalState>): DeepPartial<GlobalState> {
    const newState = nonCloudLicense(state);
    newState.entities.general.license.Cloud = 'true';
    return newState;
}

function stubUsers(state: DeepPartial<GlobalState>): GlobalState {
    const newState = JSON.parse(JSON.stringify(state));
    if (!newState.entities) {
        newState.entities = {};
    }

    if (!newState.entities.users) {
        newState.entities.users = {};
    }

    newState.entities.users.currentUserId = '';
    if (!newState.entities.users.profiles) {
        newState.entities.users.profiles = {};
    }
    return newState;
}

function adminUser(state: DeepPartial<GlobalState>): GlobalState {
    const newState = stubUsers(state);
    const userId = 'admin';
    newState.entities.users.currentUserId = userId;
    newState.entities.users.profiles[userId] = TestHelper.getUserMock({
        id: userId,
        roles: 'system_admin',
    });

    return newState;
}

function nonAdminUser(state: DeepPartial<GlobalState>) {
    const newState = adminUser(state);
    const userId = 'user';
    newState.entities.users.currentUserId = userId;
    newState.entities.users.profiles[userId] = TestHelper.getUserMock({id: userId});
    return newState;
}

describe('CloudEffectsWrapper', () => {
    it('short circuits if not cloud', () => {
        const initialState = adminUser(nonCloudLicense({}));
        const store = mockStore(initialState);
        mountWithIntl(
            <Provider store={store}>
                <CloudEffectsWrapper/>
            </Provider>,
        );
        const spy = jest.spyOn(useShowAdminLimitReachedHook, 'default');
        expect(spy).not.toHaveBeenCalled();
    });

    it('short circuits if user not logged in', () => {
        const initialState = stubUsers(cloudLicense({}));
        const store = mockStore(initialState);
        mountWithIntl(
            <Provider store={store}>
                <CloudEffectsWrapper/>
            </Provider>,
        );
        const spy = jest.spyOn(useShowAdminLimitReachedHook, 'default');
        expect(spy).not.toHaveBeenCalled();
    });

    it('short circuits if user is not admin', () => {
        const initialState = nonAdminUser(cloudLicense({}));
        const store = mockStore(initialState);
        mountWithIntl(
            <Provider store={store}>
                <CloudEffectsWrapper/>
            </Provider>,
        );
        const spy = jest.spyOn(useShowAdminLimitReachedHook, 'default');
        expect(spy).not.toHaveBeenCalled();
    });

    it('calls effects if user is admin of a cloud instance', () => {
        const initialState = adminUser(cloudLicense({}));
        const store = mockStore(initialState);
        const spy = jest.spyOn(useShowAdminLimitReachedHook, 'default').mockImplementation(jest.fn());
        mountWithIntl(
            <Provider store={store}>
                <CloudEffectsWrapper/>
            </Provider>,
        );
        expect(spy).toHaveBeenCalledTimes(1);
    });
});
