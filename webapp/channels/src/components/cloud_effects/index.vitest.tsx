// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {GlobalState} from '@mattermost/types/store';
import type {DeepPartial} from '@mattermost/types/utilities';

import * as useShowAdminLimitReachedHook from 'components/common/hooks/useShowAdminLimitReached';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

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
        renderWithContext(
            <CloudEffectsWrapper/>,
            initialState,
        );
        const spy = vi.spyOn(useShowAdminLimitReachedHook, 'default');
        expect(spy).not.toHaveBeenCalled();
    });

    it('short circuits if user not logged in', () => {
        const initialState = stubUsers(cloudLicense({}));
        renderWithContext(
            <CloudEffectsWrapper/>,
            initialState,
        );
        const spy = vi.spyOn(useShowAdminLimitReachedHook, 'default');
        expect(spy).not.toHaveBeenCalled();
    });

    it('short circuits if user is not admin', () => {
        const initialState = nonAdminUser(cloudLicense({}));
        renderWithContext(
            <CloudEffectsWrapper/>,
            initialState,
        );
        const spy = vi.spyOn(useShowAdminLimitReachedHook, 'default');
        expect(spy).not.toHaveBeenCalled();
    });

    it('calls effects if user is admin of a cloud instance', () => {
        const initialState = adminUser(cloudLicense({}));
        const spy = vi.spyOn(useShowAdminLimitReachedHook, 'default').mockImplementation(vi.fn());
        renderWithContext(
            <CloudEffectsWrapper/>,
            initialState,
        );
        expect(spy).toHaveBeenCalledTimes(1);
    });
});
