// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback} from 'react';
import {useDispatch} from 'react-redux';

import {trackEvent} from 'actions/telemetry_actions';
import {openModal} from 'actions/views/modals';

import DowngradeModal from 'components/downgrade_modal';

import {ModalIdentifiers, TELEMETRY_CATEGORIES} from 'utils/constants';

interface OpenDowngradeModalOptions{
    trackingLocation?: string;
}
type TelemetryProps = Pick<OpenDowngradeModalOptions, 'trackingLocation'>

export default function useOpenDowngradeModal() {
    const dispatch = useDispatch();
    return useCallback((telemetryProps: TelemetryProps) => {
        trackEvent(TELEMETRY_CATEGORIES.CLOUD_ADMIN, 'click_open_downgrade_modal', {
            callerInfo: telemetryProps.trackingLocation,
        });
        dispatch(openModal({
            modalId: ModalIdentifiers.DOWNGRADE_MODAL,
            dialogType: DowngradeModal,
        }));
    }, [dispatch]);
}
