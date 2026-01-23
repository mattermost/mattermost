// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect} from 'react';
import {useSelector, useDispatch} from 'react-redux';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';
import {getBool} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUser, isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';

import {isModalOpen} from 'selectors/views/modals';

import useGetTotalUsersNoBots from 'components/common/hooks/useGetTotalUsersNoBots';
import useOpenStartTrialFormModal from 'components/common/hooks/useOpenStartTrialFormModal';

import {
    Preferences,
    Constants,
    ModalIdentifiers,
} from 'utils/constants';

import type {GlobalState} from 'types/store';

const ShowStartTrialModal = () => {
    const isUserAdmin = useSelector((state: GlobalState) => isCurrentUserSystemAdmin(state));
    const openStartTrialFormModal = useOpenStartTrialFormModal();

    const dispatch = useDispatch();

    const userThreshold = 10;
    const TRUE = 'true';

    const isBenefitsModalOpened = useSelector((state: GlobalState) => isModalOpen(state, ModalIdentifiers.TRIAL_BENEFITS_MODAL));

    const config = useSelector((state: GlobalState) => getConfig(state));
    const installationDate = config.InstallationDate;
    const currentUser = useSelector((state: GlobalState) => getCurrentUser(state));
    const hadAdminDismissedModal = useSelector((state: GlobalState) => getBool(state, Preferences.START_TRIAL_MODAL, Constants.TRIAL_MODAL_AUTO_SHOWN));

    const prevTrialLicense = useSelector((state: GlobalState) => state.entities.admin.prevTrialLicense);
    const currentLicense = useSelector(getLicense);
    const isLicensed = (license: any) => {
        if (!license?.IsLicensed) {
            return false;
        }
        return license.IsLicensed === TRUE;
    };
    const isPrevLicensed = isLicensed(prevTrialLicense);
    const isCurrentLicensed = isLicensed(currentLicense);
    const totalUsers = useGetTotalUsersNoBots(true);

    // Show this modal if the instance is currently not licensed and has never had a trial license loaded before
    const isLicensedOrPreviousLicensed = (isCurrentLicensed || isPrevLicensed);

    const handleOnClose = () => {
        dispatch(savePreferences(currentUser.id, [
            {
                category: Preferences.START_TRIAL_MODAL,
                user_id: currentUser.id,
                name: Constants.TRIAL_MODAL_AUTO_SHOWN,
                value: TRUE,
            },
        ]));
    };

    useEffect(() => {
        const installationDatePlus6Hours = (6 * 60 * 60 * 1000) + Number(installationDate);
        const now = new Date().getTime();
        const hasEnvMoreThan6Hours = now > installationDatePlus6Hours;
        const hasEnvMoreThan10Users = Number(totalUsers) > userThreshold;
        if (isUserAdmin && !isBenefitsModalOpened && hasEnvMoreThan10Users && hasEnvMoreThan6Hours && !hadAdminDismissedModal && !isLicensedOrPreviousLicensed) {
            openStartTrialFormModal(handleOnClose);
        }
    }, [totalUsers]);

    return null;
};
export default ShowStartTrialModal;
