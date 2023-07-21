// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GenericModal} from '@mattermost/components';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';

import {trackEvent} from 'actions/telemetry_actions';
import {closeModal} from 'actions/views/modals';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {deprecateCloudFree} from 'mattermost-redux/selectors/entities/preferences';
import {DispatchFunc} from 'mattermost-redux/types/actions';

import SystemRolesSVG from 'components/admin_console/feature_discovery/features/images/system_roles_svg';
import CloudStartTrialButton from 'components/cloud_start_trial/cloud_start_trial_btn';
import Carousel from 'components/common/carousel/carousel';
import {BtnStyle} from 'components/common/carousel/carousel_button';
import useOpenSalesLink from 'components/common/hooks/useOpenSalesLink';
import GuestAccessSvg from 'components/common/svg_images_components/guest_access_svg';
import MonitorImacLikeSVG from 'components/common/svg_images_components/monitor_imaclike_svg';
import ExternalLink from 'components/external_link';

import {ConsolePages, DocLinks, ModalIdentifiers, TELEMETRY_CATEGORIES} from 'utils/constants';

import LearnMoreTrialModalStep, {LearnMoreTrialModalStepProps} from './learn_more_trial_modal_step';
import StartTrialBtn from './start_trial_btn';

import './learn_more_trial_modal.scss';

type Props = {
    onClose?: () => void;
    onExited: () => void;
    launchedBy?: string;
}

const LearnMoreTrialModal = (
    {
        onClose,
        onExited,
        launchedBy = '',
    }: Props): JSX.Element | null => {
    const {formatMessage} = useIntl();
    const [embargoed, setEmbargoed] = useState(false);
    const dispatch = useDispatch<DispatchFunc>();

    const [, salesLink] = useOpenSalesLink();

    // Cloud conditions
    const license = useSelector(getLicense);
    const cloudFreeDeprecated = useSelector(deprecateCloudFree);
    const isCloud = license?.Cloud === 'true';

    const handleEmbargoError = useCallback(() => {
        setEmbargoed(true);
    }, []);

    let startTrialBtnMsg = formatMessage({id: 'start_trial.modal_btn.start_free_trial', defaultMessage: 'Start free 30-day trial'});

    // close this modal once start trial btn is clicked and trial has started successfully
    const dismissAction = useCallback(() => {
        dispatch(closeModal(ModalIdentifiers.LEARN_MORE_TRIAL_MODAL));
    }, []);

    let startTrialBtn = (
        <StartTrialBtn
            message={startTrialBtnMsg}
            handleEmbargoError={handleEmbargoError}
            telemetryId={`start_trial__learn_more_modal__${launchedBy}`}
            onClick={dismissAction}
        />
    );

    // no need to check if is cloud trial or if it have had prev cloud trial because the button that show this modal takes care of that
    if (isCloud) {
        startTrialBtnMsg = formatMessage({id: 'trial_btn.free.tryFreeFor30Days', defaultMessage: 'Start trial'});
        startTrialBtn = (
            <CloudStartTrialButton
                message={startTrialBtnMsg}
                telemetryId={`start_cloud_trial__learn_more_modal__${launchedBy}`}
                onClick={dismissAction}
                extraClass={'btn btn-primary start-cloud-trial-btn'}
            />
        );
        if (cloudFreeDeprecated) {
            startTrialBtn = (
                <ExternalLink
                    location='learn_more_trial_modal'
                    href={salesLink}
                    className='btn btn-primary start-cloud-trial-btn'
                >
                    <FormattedMessage
                        id='learn_more_trial_modal.contact_sales'
                        defaultMessage='Contact sales'
                    />
                </ExternalLink>
            );
        }
    }

    const handleOnClose = useCallback(() => {
        if (onClose) {
            onClose();
        }

        onExited();
    }, [onClose, onExited]);

    useEffect(() => {
        trackEvent(
            TELEMETRY_CATEGORIES.SELF_HOSTED_START_TRIAL_MODAL,
            'learn_more_trial_modal_view',
        );
    }, []);

    const buttonLabel = formatMessage({id: 'learn_more_trial_modal_step.learnMoreAboutFeature', defaultMessage: 'Learn more about this feature.'});

    const steps: LearnMoreTrialModalStepProps[] = useMemo(() => [
        {
            id: 'useSso',
            title: formatMessage({id: 'learn_more_about_trial.modal.useSsoTitle', defaultMessage: 'Use SSO (with OpenID, SAML, Google, O365)'}),
            description: formatMessage({id: 'learn_more_about_trial.modal.useSsoDescription', defaultMessage: 'Sign on quickly and easily with our SSO feature that works with OpenID, SAML, Google, and O365.'}),
            svgWrapperClassName: 'guestAccessSvg',
            svgElement: (
                <GuestAccessSvg
                    width={400}
                    height={180}
                />
            ),
            pageURL: DocLinks.SETUP_SAML,
            buttonLabel,
        },
        {
            id: 'ldap',
            title: formatMessage({id: 'learn_more_about_trial.modal.ldapTitle', defaultMessage: 'Synchronize your Active Directory/LDAP groups'}),
            description: formatMessage({id: 'learn_more_about_trial.modal.ldapDescription', defaultMessage: 'Use AD/LDAP groups to organize and apply actions to multiple users at once. Manage team and channel memberships, permissions and more.'}),
            svgWrapperClassName: 'personMacSvg',
            svgElement: (
                <MonitorImacLikeSVG
                    width={400}
                    height={180}
                />
            ),
            pageURL: DocLinks.SETUP_LDAP,
            buttonLabel,
        },
        {
            id: 'systemConsole',
            title: formatMessage({id: 'learn_more_about_trial.modal.systemConsoleTitle', defaultMessage: 'Provide controlled access to the System Console'}),
            description: formatMessage({id: 'learn_more_about_trial.modal.systemConsoleDescription', defaultMessage: 'Use System Roles to give designated users read and/or write access to select sections of System Console.'}),
            svgWrapperClassName: 'personBoxSvg',
            svgElement: (
                <SystemRolesSVG
                    width={400}
                    height={180}
                />
            ),
            pageURL: ConsolePages.LICENSE,
            buttonLabel,
        },
    ], []);

    const handleOnPrevNextSlideClick = useCallback((slideIndex: number) => {
        const slideId = steps[slideIndex - 1]?.id;

        if (slideId) {
            trackEvent(
                TELEMETRY_CATEGORIES.SELF_HOSTED_START_TRIAL_MODAL,
                'learn_more_trial_modal_slide_shown_' + slideId,
            );
        }
    }, [steps]);

    const getSlides = useMemo(
        () =>
            steps.map(({id, ...rest}) => (
                <LearnMoreTrialModalStep
                    {...rest}
                    id={id}
                    key={id}
                />
            )),
        [],
    );

    const headerText = formatMessage({id: 'learn_more_trial_modal.pretitle', defaultMessage: 'With Enterprise, you can...'});

    return (
        <GenericModal
            className='LearnMoreTrialModal'
            id='learnMoreTrialModal'
            onExited={handleOnClose}
            modalHeaderText={headerText}
        >
            <Carousel
                dataSlides={getSlides}
                id={'learnMoreTrialModalCarousel'}
                infiniteSlide={false}
                onNextSlideClick={handleOnPrevNextSlideClick}
                onPrevSlideClick={handleOnPrevNextSlideClick}
                disableNextButton={embargoed}
                btnsStyle={BtnStyle.CHEVRON}
                actionButton={startTrialBtn}
            />
        </GenericModal>
    );
};

export default LearnMoreTrialModal;
