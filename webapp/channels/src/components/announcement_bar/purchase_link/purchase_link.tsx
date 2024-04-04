// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import {getConfig} from 'mattermost-redux/selectors/entities/admin';

import {trackEvent} from 'actions/telemetry_actions';

import useCanSelfHostedSignup from 'components/common/hooks/useCanSelfHostedSignup';
import {
    useControlAirGappedSelfHostedPurchaseModal,
    useControlScreeningInProgressModal,
} from 'components/common/hooks/useControlModal';
import useOpenSalesLink from 'components/common/hooks/useOpenSalesLink';

import {CloudLinks} from 'utils/constants';

import './purchase_link.scss';

export interface Props {
    buttonTextElement: JSX.Element;
    eventID?: string;
}

const PurchaseLink: React.FC<Props> = (props: Props) => {
    const controlAirgappedModal = useControlAirGappedSelfHostedPurchaseModal();
    const controlScreeningInProgressModal = useControlScreeningInProgressModal();
    const selfHostedSignupAvailable = useCanSelfHostedSignup();
    const [openSalesLink] = useOpenSalesLink();

    const isSelfHostedPurchaseEnabled = useSelector(getConfig)?.ServiceSettings?.SelfHostedPurchase;

    const handlePurchaseLinkClick = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.preventDefault();
        trackEvent('admin', props.eventID || 'in_trial_purchase_license');
        if (!isSelfHostedPurchaseEnabled) {
            window.open(CloudLinks.SELF_HOSTED_SIGNUP, '_blank');
            return;
        }

        if (!selfHostedSignupAvailable.ok) {
            if (selfHostedSignupAvailable.screeningInProgress) {
                controlScreeningInProgressModal.open();
            } else {
                controlAirgappedModal.open();
            }
            return;
        }

        openSalesLink();
    };

    return (
        <button
            id={props.eventID}
            className={'annnouncementBar__purchaseNow'}
            onClick={handlePurchaseLinkClick}
        >
            {props.buttonTextElement}
        </button>
    );
};

export default PurchaseLink;
