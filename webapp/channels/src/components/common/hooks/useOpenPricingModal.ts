// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback} from 'react';
import {useSelector} from 'react-redux';

import {isCurrentLicenseCloud} from 'mattermost-redux/selectors/entities/cloud';

import {trackEvent} from 'actions/telemetry_actions';

import {TELEMETRY_CATEGORIES} from 'utils/constants';

import {useExternalLink} from './use_external_link';
import useCWSAvailabilityCheck, {CSWAvailabilityCheckTypes} from './useCWSAvailabilityCheck';

export type TelemetryProps = {
    trackingLocation: string;
}

export type UseOpenPricingModalReturn = {
    openPricingModal: (telemetryProps?: TelemetryProps) => void;
    isAirGapped: boolean;
}

export default function useOpenPricingModal(): UseOpenPricingModalReturn {
    const isCloud = useSelector(isCurrentLicenseCloud);
    const cwsAvailability = useCWSAvailabilityCheck();
    const [externalLink] = useExternalLink('https://mattermost.com/pricing');

    const isAirGapped = cwsAvailability === CSWAvailabilityCheckTypes.Unavailable;
    const canAccessExternalPricing = cwsAvailability === CSWAvailabilityCheckTypes.Available ||
                                     cwsAvailability === CSWAvailabilityCheckTypes.NotApplicable;

    const openPricingModal = useCallback((telemetryProps?: TelemetryProps) => {
        let category;

        if (isCloud) {
            category = TELEMETRY_CATEGORIES.CLOUD_PRICING;
        } else {
            category = 'self_hosted_pricing';
        }
        trackEvent(category, 'click_open_pricing_modal', {
            callerInfo: telemetryProps?.trackingLocation,
        });

        if (canAccessExternalPricing) {
            // Redirect to external pricing page
            window.open(externalLink, '_blank', 'noopener,noreferrer');
        }

        // For air-gapped instances, we don't open anything since the pricing modal has been removed
    }, [isCloud, canAccessExternalPricing]);

    return {
        openPricingModal,
        isAirGapped,
    };
}
