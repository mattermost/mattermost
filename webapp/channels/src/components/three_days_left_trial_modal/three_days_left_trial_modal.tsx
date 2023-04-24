// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {useSelector, useDispatch} from 'react-redux';
import {useIntl} from 'react-intl';

import {isModalOpen} from 'selectors/views/modals';
import {GlobalState} from 'types/store';

import {closeModal} from 'actions/views/modals';

import {DispatchFunc} from 'mattermost-redux/types/actions';

import {ConsolePages, DocLinks, ModalIdentifiers} from 'utils/constants';

import GenericModal from 'components/generic_modal';
import GuestAccessSvg from 'components/common/svg_images_components/guest_access_svg';
import MonitorImacLikeSVG from 'components/common/svg_images_components/monitor_imaclike_svg';
import SystemRolesSVG from 'components/admin_console/feature_discovery/features/images/system_roles_svg';
import useOpenPricingModal from 'components/common/hooks/useOpenPricingModal';
import WorkspaceLimitsPanel from 'components/cloud_usage_modal/workspace_limits_panel';
import useGetUsage from 'components/common/hooks/useGetUsage';
import useGetLimits from 'components/common/hooks/useGetLimits';

import ThreeDaysLeftTrialCard, {ThreeDaysLeftTrialCardProps} from './three_days_left_trial_modal_card';

import './three_days_left_trial_modal.scss';

type Props = {
    onExited?: () => void;
    limitsOverpassed: boolean;
}

function ThreeDaysLeftTrialModal(props: Props): JSX.Element | null {
    const dispatch = useDispatch<DispatchFunc>();
    const {formatMessage} = useIntl();
    const openPricingModal = useOpenPricingModal();
    const show = useSelector((state: GlobalState) => isModalOpen(state, ModalIdentifiers.THREE_DAYS_LEFT_TRIAL_MODAL));
    const usage = useGetUsage();
    const [limits] = useGetLimits();

    // move this to the show three days left so it is easier to test
    const handleOnClose = async () => {
        if (props.onExited) {
            props.onExited();
        }
        await dispatch(closeModal(ModalIdentifiers.THREE_DAYS_LEFT_TRIAL_MODAL));
    };

    const handleOpenPricingModal = async () => {
        await dispatch(closeModal(ModalIdentifiers.THREE_DAYS_LEFT_TRIAL_MODAL));
        openPricingModal({trackingLocation: 'three_days_left_trial_modal'});
    };

    const buttonLabel = formatMessage({id: 'three_days_left_trial_modal.learnMore', defaultMessage: 'Learn more'});

    const steps: ThreeDaysLeftTrialCardProps[] = useMemo(() => [
        {
            id: 'useSso',
            title: formatMessage({id: 'three_days_left_trial.modal.useSsoTitle', defaultMessage: 'Single Sign on (with OpenID, SAML, Google, 0365)'}),
            description: formatMessage({id: 'three_days_left_trial.modal.useSsoDescription', defaultMessage: 'Collaborate with users outside of your organization while tightly controlling their access to channels and team members.'}),
            svgWrapperClassName: 'guestAccessSvg',
            svgElement: (
                <GuestAccessSvg
                    width={130}
                    height={90}
                />
            ),
            pageURL: DocLinks.ONBOARD_SSO,
            buttonLabel,
        },
        {
            id: 'ldap',
            title: formatMessage({id: 'three_days_left_trial.modal.ldapTitle', defaultMessage: 'Synchronize your Active Directory/LDAP groups'}),
            description: formatMessage({id: 'three_days_left_trial.modal.ldapDescription', defaultMessage: 'Use AD/LDAP groups to organize and apply actions to multiple users at once. Manage team and channel memberships, permissions and more.'}),
            svgWrapperClassName: 'personMacSvg',
            svgElement: (
                <MonitorImacLikeSVG
                    width={130}
                    height={90}
                />
            ),
            pageURL: DocLinks.ONBOARD_LDAP,
            buttonLabel,
        },
        {
            id: 'systemConsole',
            title: formatMessage({id: 'three_days_left_trial.modal.systemConsoleTitle', defaultMessage: 'Provide controlled access to the System Console'}),
            description: formatMessage({id: 'three_days_left_trial.modal.systemConsoleDescription', defaultMessage: 'Use System Roles to give designated users read and/or write access to select sections of System Console.'}),
            svgWrapperClassName: 'personBoxSvg',
            svgElement: (
                <SystemRolesSVG
                    width={130}
                    height={90}
                />
            ),
            pageURL: ConsolePages.LICENSE,
            buttonLabel,
        },
    ], []);

    let headerText = formatMessage({id: 'three_days_left_trial.modal.title', defaultMessage: 'Your trial ends soon'});
    let headerSubtitleText = formatMessage({id: 'three_days_left_trial.modal.subtitle', defaultMessage: 'There is still time to explore what our paid plans can help you accomplish.'});

    let content: React.ReactNode = useMemo(
        () =>
            steps.map(({id, ...rest}) => (
                <ThreeDaysLeftTrialCard
                    {...rest}
                    id={id}
                    key={id}
                />
            )),
        [],
    );

    if (props.limitsOverpassed) {
        headerText = formatMessage({id: 'three_days_left_trial.modal.titleLimitsOverpassed', defaultMessage: 'Upgrade before the trial ends'});
        headerSubtitleText = formatMessage({id: 'three_days_left_trial.modal.subtitleLimitsOverpassed', defaultMessage: 'There are 3 days left on your trial. Upgrade to our Professional or Enterprise plan to avoid exceeding your data limits on the Free plan.'});
        content = (
            <div className='workspace-limits-panel'>
                <p className='limits-title'>
                    {formatMessage({id: 'three_days_left_trial.modal.limitsTitle', defaultMessage: 'Limits'})}
                </p>
                <WorkspaceLimitsPanel
                    showIcons={true}
                    limits={limits}
                    usage={usage}
                />
            </div>
        );
    }

    if (!show) {
        return null;
    }

    return (
        <GenericModal
            className='ThreeDaysLeftTrialModal'
            id='threeDaysLeftTrialModal'
            onExited={handleOnClose}
            modalHeaderText={headerText}
            compassDesign={true}
        >
            <div className='header-subtitle-text'>
                {headerSubtitleText}
            </div>
            <div className='content-container'>
                {content}
            </div>
            <div className='divisory-line'/>
            <div className='footer-content'>
                <button
                    onClick={handleOpenPricingModal}
                    className='open-view-plans-modal-btn'
                >
                    {formatMessage({id: 'three_days_left_trial.modal.viewPlans', defaultMessage: 'View plan options'})}
                </button>
            </div>
        </GenericModal>
    );
}

export default ThreeDaysLeftTrialModal;
