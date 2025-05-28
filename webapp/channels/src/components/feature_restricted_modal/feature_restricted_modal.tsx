// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useEffect} from 'react';
import {useIntl, FormattedMessage} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';

import {GenericModal} from '@mattermost/components';

import {getPrevTrialLicense} from 'mattermost-redux/actions/admin';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';

import {closeModal} from 'actions/views/modals';
import {isModalOpen} from 'selectors/views/modals';

import {NotifyStatus} from 'components/common/hooks/useGetNotifyAdmin';
import useOpenPricingModal from 'components/common/hooks/useOpenPricingModal';
import ExternalLink from 'components/external_link';
import StartTrialBtn from 'components/learn_more_trial_modal/start_trial_btn';
import {useNotifyAdmin} from 'components/notify_admin_cta/notify_admin_cta';

import {FREEMIUM_TO_ENTERPRISE_TRIAL_LENGTH_DAYS} from 'utils/cloud_utils';
import {ModalIdentifiers, AboutLinks, LicenseLinks} from 'utils/constants';

import type {GlobalState} from 'types/store';

import './feature_restricted_modal.scss';

type FeatureRestrictedModalProps = {
    titleAdminPreTrial: string;
    messageAdminPreTrial: string;
    titleAdminPostTrial?: string;
    messageAdminPostTrial?: string;
    titleEndUser?: string;
    messageEndUser?: string;
    customSecondaryButton?: { msg: string; action: () => void };
    feature?: string;
    minimumPlanRequiredForFeature?: string;
}

const FeatureRestrictedModal = ({
    titleAdminPreTrial,
    messageAdminPreTrial,
    titleAdminPostTrial,
    messageAdminPostTrial,
    titleEndUser,
    messageEndUser,
    customSecondaryButton,
    feature,
    minimumPlanRequiredForFeature,
}: FeatureRestrictedModalProps) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    useEffect(() => {
        dispatch(getPrevTrialLicense());
    }, []);

    const prevTrialLicense = useSelector((state: GlobalState) => state.entities.admin.prevTrialLicense);
    const hasSelfHostedPriorTrial = prevTrialLicense.IsLicensed === 'true';

    const hasPriorTrial = hasSelfHostedPriorTrial;
    const isSystemAdmin = useSelector(isCurrentUserSystemAdmin);
    const show = useSelector((state: GlobalState) => isModalOpen(state, ModalIdentifiers.FEATURE_RESTRICTED_MODAL));
    const license = useSelector(getLicense);
    const isCloud = license?.Cloud === 'true';
    const openPricingModal = useOpenPricingModal();

    const [notifyAdminBtnText, notifyAdmin, notifyRequestStatus] = useNotifyAdmin({
        ctaText: formatMessage({
            id: 'feature_restricted_modal.button.notify',
            defaultMessage: 'Notify Admin',
        }),
    }, {
        required_feature: feature || '',
        required_plan: minimumPlanRequiredForFeature || '',
        trial_notification: false,
    });

    if (!show) {
        return null;
    }

    const dismissAction = () => {
        dispatch(closeModal(ModalIdentifiers.FEATURE_RESTRICTED_MODAL));
    };

    const handleViewPlansClick = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        if (isSystemAdmin) {
            openPricingModal({trackingLocation: 'feature_restricted_modal'});
            dismissAction();
        } else {
            notifyAdmin(e, 'feature_restricted_modal');
        }
    };

    const getTitle = () => {
        if (isSystemAdmin) {
            return (hasPriorTrial) ? titleAdminPostTrial : titleAdminPreTrial;
        }

        return titleEndUser;
    };

    const getMessage = () => {
        if (isSystemAdmin) {
            return (hasPriorTrial) ? messageAdminPostTrial : messageAdminPreTrial;
        }

        return messageEndUser;
    };

    const showStartTrial = isSystemAdmin && !hasPriorTrial && !isCloud;

    // define what is the secondary button text and action, by default will be the View Plan button
    let secondaryBtnMsg = formatMessage({id: 'feature_restricted_modal.button.plans', defaultMessage: 'View plans'});
    if (!isSystemAdmin) {
        secondaryBtnMsg = notifyAdminBtnText as string;
    }
    let secondaryBtnAction = handleViewPlansClick;
    if (customSecondaryButton) {
        secondaryBtnMsg = customSecondaryButton.msg;
        secondaryBtnAction = customSecondaryButton.action;
    }

    const trialBtn = (
        <StartTrialBtn
            onClick={dismissAction}
            telemetryId='start_self_hosted_trial_after_team_creation_restricted'
            btnClass='btn btn-primary'
            renderAsButton={true}
        />
    );

    return (
        <GenericModal
            id='FeatureRestrictedModal'
            className='FeatureRestrictedModal'
            compassDesign={true}
            modalHeaderText={getTitle()}
            onExited={dismissAction}
        >
            <div className='FeatureRestrictedModal__body'>
                <p className='FeatureRestrictedModal__description'>
                    {getMessage()}
                </p>
                {showStartTrial && (
                    <p className='FeatureRestrictedModal__terms'>
                        <FormattedMessage
                            id='feature_restricted_modal.agreement'
                            defaultMessage='By selecting <highlight>Try free for {trialLength} days</highlight>, I agree to the <linkEvaluation>Mattermost Software and Services License Agreement</linkEvaluation>, <linkPrivacy>Privacy Policy</linkPrivacy>, and receiving product emails.'
                            values={{
                                trialLength: FREEMIUM_TO_ENTERPRISE_TRIAL_LENGTH_DAYS,
                                highlight: (msg: React.ReactNode) => (
                                    <strong>{msg}</strong>
                                ),
                                linkEvaluation: (msg: React.ReactNode) => (
                                    <ExternalLink
                                        href={LicenseLinks.SOFTWARE_SERVICES_LICENSE_AGREEMENT}
                                        location='feature_restricted_modal'
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                                linkPrivacy: (msg: React.ReactNode) => (
                                    <ExternalLink
                                        href={AboutLinks.PRIVACY_POLICY}
                                        location='feature_restricted_modal'
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                            }}
                        />
                    </p>
                )}
                <div className={classNames('FeatureRestrictedModal__buttons', {single: !showStartTrial})}>
                    <button
                        id='button-plans'
                        className='button-plans'
                        onClick={secondaryBtnAction}
                        disabled={notifyRequestStatus === NotifyStatus.AlreadyComplete}
                    >
                        {secondaryBtnMsg}
                    </button>
                    {showStartTrial && (
                        trialBtn
                    )}
                </div>
            </div>
        </GenericModal>
    );
};

export default FeatureRestrictedModal;
