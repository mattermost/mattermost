// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useDispatch} from 'react-redux';

import {trackEvent} from 'actions/telemetry_actions';
import {openModal} from 'actions/views/modals';

import PurchaseModal from 'components/purchase_modal';

import {ModalIdentifiers, TELEMETRY_CATEGORIES} from 'utils/constants';

interface OpenPurchaseModalOptions{
    onClick?: () => void;
    trackingLocation?: string;
    isDelinquencyModal?: boolean;
}
type TelemetryProps = Pick<OpenPurchaseModalOptions, 'trackingLocation'>

export default function useOpenCloudPurchaseModal(options: OpenPurchaseModalOptions) {
    const dispatch = useDispatch();
    return (telemetryProps: TelemetryProps) => {
        if (options.onClick) {
            options.onClick();
        }
        trackEvent(TELEMETRY_CATEGORIES.CLOUD_ADMIN, options.isDelinquencyModal ? 'click_open_delinquency_modal' : 'click_open_purchase_modal', {
            callerInfo: telemetryProps.trackingLocation,
        });
        dispatch(openModal({
            modalId: ModalIdentifiers.CLOUD_PURCHASE,
            dialogType: PurchaseModal,
            dialogProps: {
                callerCTA: telemetryProps.trackingLocation,
            },
        }));
    };
}
