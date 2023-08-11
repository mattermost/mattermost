// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {HostedCustomerTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/common';

import {trackEvent} from 'actions/telemetry_actions';
import {closeModal, openModal} from 'actions/views/modals';
import {isModalOpen} from 'selectors/views/modals';

import PurchaseInProgressModal from 'components/purchase_in_progress_modal';
import {STORAGE_KEY_PURCHASE_IN_PROGRESS} from 'components/self_hosted_purchases/constants';
import SelfHostedPurchaseModal from 'components/self_hosted_purchases/self_hosted_purchase_modal';

import type {GlobalState} from 'types/store';
import {ModalIdentifiers, TELEMETRY_CATEGORIES} from 'utils/constants';

import {useControlModal} from './useControlModal';
import type {ControlModal} from './useControlModal';

interface HookOptions{
    onClick?: () => void;
    productId: string;
    trackingLocation?: string;
}

export default function useControlSelfHostedPurchaseModal(options: HookOptions): ControlModal {
    const dispatch = useDispatch();
    const currentUser = useSelector(getCurrentUser);
    const controlModal = useControlModal({
        modalId: ModalIdentifiers.SELF_HOSTED_PURCHASE,
        dialogType: SelfHostedPurchaseModal,
        dialogProps: {
            productId: options.productId,
        },
    });
    const pricingModalOpen = useSelector((state: GlobalState) => isModalOpen(state, ModalIdentifiers.PRICING_MODAL));
    const purchaseModalOpen = useSelector((state: GlobalState) => isModalOpen(state, ModalIdentifiers.SELF_HOSTED_PURCHASE));
    const comparingPlansWhilePurchasing = pricingModalOpen && purchaseModalOpen;

    return useMemo(() => {
        return {
            ...controlModal,
            open: async () => {
                // check if purchase modal is already open
                // i.e. they are allowed to compare plans from within the purchase modal
                // if so, all we need to do is close the compare plans modal so that
                // the purchase modal is available again.
                if (comparingPlansWhilePurchasing) {
                    dispatch(closeModal(ModalIdentifiers.PRICING_MODAL));
                    return;
                }
                const purchaseInProgress = localStorage.getItem(STORAGE_KEY_PURCHASE_IN_PROGRESS) === 'true';

                // check if user already has an open purchase modal in current browser.
                if (purchaseInProgress) {
                    // User within the same browser session
                    // is already trying to purchase. Notify them of this
                    // and request the exit that purchase flow before attempting again.
                    dispatch(openModal({
                        modalId: ModalIdentifiers.PURCHASE_IN_PROGRESS,
                        dialogType: PurchaseInProgressModal,
                        dialogProps: {
                            purchaserEmail: currentUser.email,
                            storageKey: STORAGE_KEY_PURCHASE_IN_PROGRESS,
                        },
                    }));
                    return;
                }

                trackEvent(TELEMETRY_CATEGORIES.SELF_HOSTED_PURCHASING, 'click_open_purchase_modal', {
                    callerInfo: options.trackingLocation,
                });
                if (options.onClick) {
                    options.onClick();
                }
                try {
                    const result = await Client4.bootstrapSelfHostedSignup();

                    if (result.email !== currentUser.email) {
                        // JWT already exists and was created by another admin,
                        // meaning another admin is already trying to purchase.
                        // Notify user of this and do not allow them to try to purchase concurrently.
                        dispatch(openModal({
                            modalId: ModalIdentifiers.PURCHASE_IN_PROGRESS,
                            dialogType: PurchaseInProgressModal,
                            dialogProps: {
                                purchaserEmail: result.email,
                                storageKey: STORAGE_KEY_PURCHASE_IN_PROGRESS,
                            },
                        }));
                        return;
                    }

                    dispatch({
                        type: HostedCustomerTypes.RECEIVED_SELF_HOSTED_SIGNUP_PROGRESS,
                        data: result.progress,
                    });

                    dispatch(closeModal(ModalIdentifiers.PRICING_MODAL));
                    controlModal.open();
                } catch (e) {
                    // eslint-disable-next-line no-console
                    console.error('error bootstrapping self hosted purchase modal', e);
                }
            },
        };
    }, [controlModal, options.productId, options.onClick, options.trackingLocation, comparingPlansWhilePurchasing]);
}
