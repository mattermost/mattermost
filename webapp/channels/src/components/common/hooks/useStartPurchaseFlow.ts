// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback} from 'react';
import {useSelector} from 'react-redux';

import {isCurrentLicenseCloud, getSubscriptionProduct} from 'mattermost-redux/selectors/entities/cloud';

import {trackEvent} from 'actions/telemetry_actions';

import useHandleDowngradeFeedback from 'components/common/hooks/useHandleDowngradeFeedback';

import {CloudLinks, TELEMETRY_CATEGORIES, CloudProducts} from 'utils/constants';

export type TelemetryProps = {
    trackingLocation: string;
}

export type PurchaseFlowOptions = {
    isDowngrade?: boolean;
    contactSales?: boolean;
} & TelemetryProps;

/**
 * A hook that provides a function to start the purchase flow.
 *
 * The purchase flow directs users to the appropriate external page
 * based on whether they are on Cloud or Self-Hosted, with proper
 * telemetry tracking. It also handles special scenarios like downgrades.
 */
export default function useStartPurchaseFlow() {
    const isCloud = useSelector(isCurrentLicenseCloud);
    const subscriptionProduct = useSelector(getSubscriptionProduct);
    const handleDowngradeFeedback = useHandleDowngradeFeedback();

    const startPurchaseFlow = useCallback((options?: PurchaseFlowOptions) => {
        let category;
        let url;
        let eventName = 'click_start_purchase_flow';

        // Set category and URL based on deployment type
        if (isCloud) {
            category = TELEMETRY_CATEGORIES.CLOUD_PRICING;
            url = CloudLinks.PRICING;
        } else {
            category = 'self_hosted_pricing';
            url = CloudLinks.SELF_HOSTED_PRICING;
        }

        // Special handling for contact sales
        if (options?.contactSales) {
            eventName = 'click_contact_sales';
            url = CloudLinks.CONTACT_SALES;
        }

        // Special handling for downgrade
        if (options?.isDowngrade) {
            // Only handle downgrade specially on cloud and if not on starter plan
            if (isCloud && subscriptionProduct?.sku !== CloudProducts.STARTER) {
                trackEvent(category, 'click_start_downgrade_flow', {
                    callerInfo: options.trackingLocation,
                });

                // Use downgrade feedback workflow instead of direct link
                handleDowngradeFeedback();
                return;
            }

            // For self-hosted or cloud starter, just track as downgrade but use normal flow
            eventName = 'click_downgrade';
        }

        // Regular tracking for standard purchase flow
        trackEvent(category, eventName, {
            callerInfo: options?.trackingLocation,
        });

        window.open(url, '_blank', 'noopener,noreferrer');
    }, [isCloud, subscriptionProduct, handleDowngradeFeedback]);

    return startPurchaseFlow;
}
