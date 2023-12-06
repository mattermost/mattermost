// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';

import {getCloudProducts, getCloudSubscription} from 'mattermost-redux/actions/cloud';
import {getCloudSubscription as selectCloudSubscription, getSubscriptionProduct as selectSubscriptionProduct, isCurrentLicenseCloud} from 'mattermost-redux/selectors/entities/cloud';
import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';
import {isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';

import useOpenPricingModal from 'components/common/hooks/useOpenPricingModal';
import type {TelemetryProps} from 'components/common/hooks/useOpenPricingModal';
import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';

import Constants, {CloudProducts} from 'utils/constants';

const UpgradeButton = styled.button`
background: var(--denim-button-bg);
border-radius: 4px;
border: none;
box-shadow: none;
height: 24px;
width: auto;
font-family: 'Open Sans';
font-style: normal;
font-weight: 600;
font-size: 11px !important;
line-height: 10px;
letter-spacing: 0.02em;
color: var(--button-color);
`;

let openPricingModal: (telemetryProps?: TelemetryProps) => void;

const PlanUpgradeButton = (): JSX.Element | null => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();

    openPricingModal = useOpenPricingModal();
    const isCloud = useSelector(isCurrentLicenseCloud);

    useEffect(() => {
        if (isCloud) {
            dispatch(getCloudSubscription());
            dispatch(getCloudProducts());
        }
    }, [isCloud]);

    const isAdmin = useSelector(isCurrentUserSystemAdmin);
    const subscription = useSelector(selectCloudSubscription);
    const product = useSelector(selectSubscriptionProduct);
    const config = useSelector(getConfig);
    const license = useSelector(getLicense);

    const isEnterpriseTrial = subscription?.is_free_trial === 'true';

    const isCloudFree = product?.sku === CloudProducts.STARTER;

    const isSelfHostedEnterpriseTrial = !isCloud && license.IsTrial === 'true';
    const isSelfHostedStarter = license.IsLicensed === 'false';
    const isEnterpriseReady = config.BuildEnterpriseReady === 'true';

    if (!isAdmin) {
        return null;
    }

    // If not on Enterprise edition, don't show
    if (!isEnterpriseReady) {
        return null;
    }

    // for cloud, only show when subscribed to free or enterprise trial plans
    if (isCloud && !(isCloudFree || isEnterpriseTrial)) {
        return null;
    }

    // for non cloud, only show when subscribed to self hosted starter or self hosted enterprise trial plans
    if (!isCloud && !(isSelfHostedStarter || isSelfHostedEnterpriseTrial)) {
        return null;
    }

    const tooltip = (
        <Tooltip id='upgrade_button_tooltip'>
            {formatMessage({id: 'pricing_modal.btn.tooltip', defaultMessage: 'Only visible to system admins'})}
        </Tooltip>
    );

    return (
        <OverlayTrigger
            trigger={['hover']}
            delayShow={Constants.OVERLAY_TIME_DELAY}
            placement='bottom'
            overlay={tooltip}
        >
            <UpgradeButton
                id='UpgradeButton'
                aria-haspopup='dialog'
                onClick={() => openPricingModal({trackingLocation: 'global_header_plan_upgrade_button'})}
            >
                {formatMessage({id: 'pricing_modal.btn.viewPlans', defaultMessage: 'View plans'})}
            </UpgradeButton>
        </OverlayTrigger>);
};

export default PlanUpgradeButton;
export {openPricingModal};
