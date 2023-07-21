// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import {trackEvent} from 'actions/telemetry_actions';
import {getConfig} from 'mattermost-redux/selectors/entities/admin';

import useCanSelfHostedSignup from 'components/common/hooks/useCanSelfHostedSignup';
import {
    useControlAirGappedSelfHostedPurchaseModal,
    useControlScreeningInProgressModal,
} from 'components/common/hooks/useControlModal';
import useControlSelfHostedPurchaseModal from 'components/common/hooks/useControlSelfHostedPurchaseModal';
import useGetSelfHostedProducts from 'components/common/hooks/useGetSelfHostedProducts';

import {CloudLinks, SelfHostedProducts} from 'utils/constants';
import {findSelfHostedProductBySku} from 'utils/hosted_customer';

import './purchase_link.scss';

export interface Props {
    buttonTextElement: JSX.Element;
    eventID?: string;
}

const PurchaseLink: React.FC<Props> = (props: Props) => {
    const controlAirgappedModal = useControlAirGappedSelfHostedPurchaseModal();
    const controlScreeningInProgressModal = useControlScreeningInProgressModal();
    const selfHostedSignupAvailable = useCanSelfHostedSignup();
    const [products, productsLoaded] = useGetSelfHostedProducts();
    const professionalProductId = findSelfHostedProductBySku(products, SelfHostedProducts.PROFESSIONAL)?.id || '';
    const controlSelfHostedPurchaseModal = useControlSelfHostedPurchaseModal({productId: professionalProductId});

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

        if (productsLoaded && professionalProductId) {
            controlSelfHostedPurchaseModal.open();
        }
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
