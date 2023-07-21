// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {trackEvent} from 'actions/telemetry_actions';
import {openModal} from 'actions/views/modals';
import {HostedCustomerTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/common';

import PurchaseInProgressModal from 'components/purchase_in_progress_modal';
import {STORAGE_KEY_EXPANSION_IN_PROGRESS} from 'components/self_hosted_purchases/constants';
import SelfHostedExpansionModal from 'components/self_hosted_purchases/self_hosted_expansion_modal';

import {ModalIdentifiers, TELEMETRY_CATEGORIES} from 'utils/constants';

import {useControlModal, ControlModal} from './useControlModal';

interface HookOptions{
    trackingLocation?: string;
}

export default function useControlSelfHostedExpansionModal(options: HookOptions): ControlModal {
    const dispatch = useDispatch();
    const currentUser = useSelector(getCurrentUser);
    const controlModal = useControlModal({
        modalId: ModalIdentifiers.SELF_HOSTED_EXPANSION,
        dialogType: SelfHostedExpansionModal,
    });

    return useMemo(() => {
        return {
            ...controlModal,
            open: async () => {
                const purchaseInProgress = localStorage.getItem(STORAGE_KEY_EXPANSION_IN_PROGRESS) === 'true';

                // check if user already has an open purchase modal in current browser.
                if (purchaseInProgress) {
                    // User within the same browser session
                    // is already trying to purchase. Notify them of this
                    // and request the exit that purchase flow before attempting again.
                    dispatch(openModal({
                        modalId: ModalIdentifiers.EXPANSION_IN_PROGRESS,
                        dialogType: PurchaseInProgressModal,
                        dialogProps: {
                            purchaserEmail: currentUser.email,
                            storageKey: STORAGE_KEY_EXPANSION_IN_PROGRESS,
                        },
                    }));
                    return;
                }

                trackEvent(TELEMETRY_CATEGORIES.SELF_HOSTED_EXPANSION, 'click_open_expansion_modal', {
                    callerInfo: options.trackingLocation,
                });

                try {
                    const result = await Client4.bootstrapSelfHostedSignup();

                    if (result.email !== currentUser.email) {
                        // Token already exists and was created by another admin.
                        // Notify user of this and do not allow them to try to expand concurrently.
                        dispatch(openModal({
                            modalId: ModalIdentifiers.EXPANSION_IN_PROGRESS,
                            dialogType: PurchaseInProgressModal,
                            dialogProps: {
                                purchaserEmail: result.email,
                                storageKey: STORAGE_KEY_EXPANSION_IN_PROGRESS,
                            },
                        }));
                        return;
                    }

                    dispatch({
                        type: HostedCustomerTypes.RECEIVED_SELF_HOSTED_SIGNUP_PROGRESS,
                        data: result.progress,
                    });

                    controlModal.open();
                } catch (e) {
                    // eslint-disable-next-line no-console
                    console.error('error bootstrapping self hosted purchase modal', e);
                }
            },
        };
    }, [controlModal, options.trackingLocation]);
}
