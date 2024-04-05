// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

import {getPrevTrialLicense} from 'mattermost-redux/actions/admin';
import {Permissions} from 'mattermost-redux/constants';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {haveISystemPermission} from 'mattermost-redux/selectors/entities/roles_helpers';

import {trackEvent} from 'actions/telemetry_actions';
import {openModal} from 'actions/views/modals';

import {makeAsyncComponent} from 'components/async_load';

import {ModalIdentifiers, TELEMETRY_CATEGORIES} from 'utils/constants';
import {isTrialLicense} from 'utils/license_utils';

import './menu_item.scss';

const TrialBenefitsModal = makeAsyncComponent('TrialBenefitsModal', React.lazy(() => import('components/trial_benefits_modal/trial_benefits_modal')));
const LearnMoreTrialModal = makeAsyncComponent('LearnMoreTrialModal', React.lazy(() => import('components/learn_more_trial_modal/learn_more_trial_modal')));

type Props = {
    id: string;
}

const MenuStartTrial = (props: Props): JSX.Element | null => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const canIStartTrial = useSelector((state: GlobalState) => haveISystemPermission(state, {permission: Permissions.SYSCONSOLE_WRITE_ABOUT_EDITION_AND_LICENSE}));

    useEffect(() => {
        dispatch(getPrevTrialLicense());
    }, []);

    const openLearnMoreTrialModal = () => {
        trackEvent(
            TELEMETRY_CATEGORIES.SELF_HOSTED_START_TRIAL_MODAL,
            'open_learn_more_trial_modal',
        );
        dispatch(openModal({
            modalId: ModalIdentifiers.LEARN_MORE_TRIAL_MODAL,
            dialogType: LearnMoreTrialModal,
        }));
    };

    const openTrialBenefitsModal = () => {
        trackEvent(
            TELEMETRY_CATEGORIES.SELF_HOSTED_START_TRIAL_MODAL,
            'open_trial_benefits_modal_from_menu',
        );
        dispatch(openModal({
            modalId: ModalIdentifiers.TRIAL_BENEFITS_MODAL,
            dialogType: TrialBenefitsModal,
        }));
    };

    const prevTrialLicense = useSelector((state: GlobalState) => state.entities.admin.prevTrialLicense);
    const license = useSelector(getLicense);
    const isPrevLicensed = prevTrialLicense?.IsLicensed;
    const isCurrentLicensed = license?.IsLicensed;
    const isCurrentLicenseTrial = isTrialLicense(license);

    if (isCurrentLicenseTrial && canIStartTrial) {
        return (
            <li
                className={'MenuStartTrial'}
                role='menuitem'
                id={props.id}
            >
                <div style={{display: 'inline'}}>
                    <span>
                        {formatMessage({id: 'navbar_dropdown.reviewTrialBenefits', defaultMessage: 'Review the features you get with Enterprise. '})}
                    </span>
                    <button onClick={openTrialBenefitsModal}>
                        {formatMessage({id: 'navbar_dropdown.learnMoreTrialBenefits', defaultMessage: 'Learn More'})}
                    </button>
                </div>
            </li>
        );
    }

    if (isCurrentLicensed === 'true') {
        return null;
    }

    // Show this CTA if the instance is currently not licensed and has never had a trial license loaded before
    const showTrial = (isCurrentLicensed === 'false' && isPrevLicensed === 'false') && canIStartTrial;

    return (
        <li
            className={'MenuStartTrial'}
            role='menuitem'
            id={props.id}
        >
            <div className='free_version_badge'>{'FREE EDITION'}</div>
            {!showTrial && (
                <div className='start_trial_content'>
                    {formatMessage({id: 'navbar_dropdown.freeVersionText', defaultMessage: 'This server is on the free edition of Mattermost'})}
                </div>)}
            {showTrial && (<>
                <div className='start_trial_content'>
                    {formatMessage({id: 'navbar_dropdown.tryTrialNow', defaultMessage: 'This server is on the free edition of Mattermost. Try Enterprise for free.'})}
                </div>
                <button onClick={openLearnMoreTrialModal}>
                    {formatMessage({id: 'navbar_dropdown.learnMore', defaultMessage: 'Learn More'})}
                </button>
            </>)}
        </li>
    );
};

export default MenuStartTrial;
