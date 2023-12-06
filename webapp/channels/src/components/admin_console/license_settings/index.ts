// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';

import type {StatusOK} from '@mattermost/types/client4';
import type {ServerError} from '@mattermost/types/errors';
import type {GetFilteredUsersStatsOpts, UsersStats} from '@mattermost/types/users';

import {uploadLicense, removeLicense, getPrevTrialLicense} from 'mattermost-redux/actions/admin';
import {getLicenseConfig} from 'mattermost-redux/actions/general';
import {getFilteredUsersStats} from 'mattermost-redux/actions/users';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getFilteredUsersStats as selectFilteredUserStats} from 'mattermost-redux/selectors/entities/users';
import type {Action, ActionResult, GenericAction} from 'mattermost-redux/types/actions';

import {requestTrialLicense, upgradeToE0Status, upgradeToE0, restartServer, ping} from 'actions/admin_actions';
import {openModal} from 'actions/views/modals';

import type {ModalData} from 'types/actions';
import type {GlobalState} from 'types/store';

import LicenseSettings from './license_settings';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);

    return {
        totalUsers: selectFilteredUserStats(state)?.total_users_count || 0,
        upgradedFromTE: config.UpgradedFromTE === 'true',
        prevTrialLicense: state.entities.admin.prevTrialLicense,
    };
}

type StatusOKFunc = () => Promise<StatusOK>;
type PromiseStatusFunc = () => Promise<{status: string}>;
type ActionCreatorTypes = Action | PromiseStatusFunc | StatusOKFunc;

type Actions = {
    getLicenseConfig: () => void;
    uploadLicense: (file: File) => Promise<ActionResult>;
    removeLicense: () => Promise<ActionResult>;
    getPrevTrialLicense: () => void;
    upgradeToE0: StatusOKFunc;
    upgradeToE0Status: () => Promise<{percentage: number; error: string | JSX.Element}>;
    restartServer: StatusOKFunc;
    ping: PromiseStatusFunc;
    requestTrialLicense: (users: number, termsAccepted: boolean, receiveEmailsAccepted: boolean, featureName: string) => Promise<ActionResult>;
    openModal: <P>(modalData: ModalData<P>) => void;
    getFilteredUsersStats: (filters: GetFilteredUsersStatsOpts) => Promise<{ data?: UsersStats | undefined; error?: ServerError | undefined}>;
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionCreatorTypes>, Actions>({
            getLicenseConfig,
            uploadLicense,
            removeLicense,
            getPrevTrialLicense,
            upgradeToE0,
            upgradeToE0Status,
            restartServer,
            ping,
            requestTrialLicense,
            openModal,
            getFilteredUsersStats,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(LicenseSettings);
