// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useDispatch, useSelector} from 'react-redux';

import {trackEvent} from 'actions/telemetry_actions';
import {openModal} from 'actions/views/modals';
import {isCurrentLicenseCloud} from 'mattermost-redux/selectors/entities/cloud';

import PricingModal from 'components/pricing_modal';

import {ModalIdentifiers, TELEMETRY_CATEGORIES} from 'utils/constants';

export type TelemetryProps = {
    trackingLocation: string;
}

export default function useOpenPricingModal() {
    const dispatch = useDispatch();
    const isCloud = useSelector(isCurrentLicenseCloud);
    let category;
    return (telemetryProps?: TelemetryProps) => {
        if (isCloud) {
            category = TELEMETRY_CATEGORIES.CLOUD_PRICING;
        } else {
            category = 'self_hosted_pricing';
        }
        trackEvent(category, 'click_open_pricing_modal', {
            callerInfo: telemetryProps?.trackingLocation,
        });
        dispatch(openModal({
            modalId: ModalIdentifiers.PRICING_MODAL,
            dialogType: PricingModal,
            dialogProps: {
                callerCTA: telemetryProps?.trackingLocation,
            },
        }));
    };
}
