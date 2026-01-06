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

    const openPricingModal = useCallback(() => {
        window.open(externalLink, '_blank', 'noopener,noreferrer');
    }, [externalLink]);

    return {
        openPricingModal,
        isAirGapped,
    };
}
