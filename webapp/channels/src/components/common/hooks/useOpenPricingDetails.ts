// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback} from 'react';
import {useSelector} from 'react-redux';

import {isCurrentLicenseCloud} from 'mattermost-redux/selectors/entities/cloud';

import {trackEvent} from 'actions/telemetry_actions';

import {TELEMETRY_CATEGORIES} from 'utils/constants';

export type TelemetryProps = {
    trackingLocation: string;
}

export default function useOpenPricingDetails() {
    const isCloud = useSelector(isCurrentLicenseCloud);

    const openPricingDetails = useCallback((telemetryProps?: TelemetryProps) => {
        let category;

        if (isCloud) {
            category = TELEMETRY_CATEGORIES.CLOUD_PRICING;
        } else {
            category = 'self_hosted_pricing';
        }

        trackEvent(category, 'click_open_pricing_page', {
            callerInfo: telemetryProps?.trackingLocation,
        });

        window.open('https://mattermost.com/pricing', '_blank', 'noopener,noreferrer');
    }, [isCloud]);

    return openPricingDetails;
}
