// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {History} from 'history';

import type {UserProfile} from '@mattermost/types/users';

import {getFirstAdminSetupComplete} from 'mattermost-redux/actions/general';
import {getProfiles} from 'mattermost-redux/actions/users';
import {General} from 'mattermost-redux/constants';
import {getIsOnboardingFlowEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getActiveTeamsList} from 'mattermost-redux/selectors/entities/teams';
import {checkIsFirstAdmin, getCurrentUser, isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';
import type {ThunkActionFunc} from 'mattermost-redux/types/actions';

import * as GlobalActions from 'actions/global_actions';

import {StoragePrefixes} from 'utils/constants';

export function redirectToOnboardingOrDefaultTeam(history: History): ThunkActionFunc<void> {
    return async (dispatch, getState) => {
        const state = getState();
        const isUserAdmin = isCurrentUserSystemAdmin(state);
        if (!isUserAdmin) {
            GlobalActions.redirectUserToDefaultTeam();
            return;
        }

        const teams = getActiveTeamsList(state);

        const onboardingFlowEnabled = getIsOnboardingFlowEnabled(state);

        if (teams.length > 0 || !onboardingFlowEnabled) {
            GlobalActions.redirectUserToDefaultTeam();
            return;
        }

        const firstAdminSetupComplete = await dispatch(getFirstAdminSetupComplete());
        if (firstAdminSetupComplete?.data) {
            GlobalActions.redirectUserToDefaultTeam();
            return;
        }

        const profilesResult = await dispatch(getProfiles(0, General.PROFILE_CHUNK_SIZE, {roles: General.SYSTEM_ADMIN_ROLE}));
        if (profilesResult.error) {
            GlobalActions.redirectUserToDefaultTeam();
            return;
        }
        const currentUser = getCurrentUser(getState());
        const adminProfiles = profilesResult.data?.reduce(
            (acc: Record<string, UserProfile>, curr: UserProfile) => {
                acc[curr.id] = curr;
                return acc;
            },
            {},
        );
        if (adminProfiles && checkIsFirstAdmin(currentUser, adminProfiles)) {
            history.push('/preparing-workspace');
            return;
        }

        GlobalActions.redirectUserToDefaultTeam();
    };
}

export function handleLoginLogoutSignal(e: StorageEvent): ThunkActionFunc<void> {
    return (dispatch, getState) => {
        // when one tab on a browser logs out, it sets __logout__ in localStorage to trigger other tabs to log out
        const isNewLocalStorageEvent = (event: StorageEvent) => event.storageArea === localStorage && event.newValue;

        if (e.key === StoragePrefixes.LOGOUT && isNewLocalStorageEvent(e)) {
            console.log('detected logout from a different tab'); //eslint-disable-line no-console
            GlobalActions.emitUserLoggedOutEvent('/', false, false);
        }
        if (e.key === StoragePrefixes.LOGIN && isNewLocalStorageEvent(e)) {
            const isLoggedIn = getCurrentUser(getState());

            // make sure this is not the same tab which sent login signal
            // because another tabs will also send login signal after reloading
            if (isLoggedIn) {
                return;
            }

            // detected login from a different tab
            function reloadOnFocus() {
                location.reload();
            }
            window.addEventListener('focus', reloadOnFocus);
        }
    };
}
