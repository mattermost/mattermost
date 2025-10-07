// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback} from 'react';

import {useExternalLink} from './use_external_link';
import useCWSAvailabilityCheck, {CSWAvailabilityCheckTypes} from './useCWSAvailabilityCheck';

export type UseOpenPricingModalReturn = {
    openPricingModal: () => void;
    isAirGapped: boolean;
}

export default function useOpenPricingModal(): UseOpenPricingModalReturn {
    const cwsAvailability = useCWSAvailabilityCheck();
    const [externalLink] = useExternalLink('https://mattermost.com/pricing');

    const isAirGapped = cwsAvailability === CSWAvailabilityCheckTypes.Unavailable;
    const canAccessExternalPricing = cwsAvailability === CSWAvailabilityCheckTypes.Available ||
                                     cwsAvailability === CSWAvailabilityCheckTypes.NotApplicable;

    const openPricingModal = useCallback(() => {
        if (canAccessExternalPricing) {
            // Redirect to external pricing page
            window.open(externalLink, '_blank', 'noopener,noreferrer');
        }

        // For air-gapped instances, we don't open anything since the pricing modal has been removed
    }, [canAccessExternalPricing]);

    return {
        openPricingModal,
        isAirGapped,
    };
}
