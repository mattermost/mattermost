// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {trackEvent} from 'actions/telemetry_actions';
import {closeModal, openModal} from 'actions/views/modals';
import {ModalIdentifiers, TELEMETRY_CATEGORIES} from 'utils/constants';
import SelfHostedRenewalModal from 'components/self_hosted_renewal_modal';
import {STORAGE_KEY_RENEWAL_IN_PROGRESS } from 'components/self_hosted_purchase_modal/constants';
import PurchaseInProgressModal from 'components/purchase_in_progress_modal';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/common';
import {isModalOpen} from 'selectors/views/modals';

import {GlobalState} from 'types/store';

interface HookOptions{
    onClick?: () => void;
    trackingLocation?: string;
}

export default function useControlSelfHostedRenewalModal(options: HookOptions) {
    const dispatch = useDispatch();
    const currentUser = useSelector(getCurrentUser);
    const pricingModalOpen = useSelector((state: GlobalState) => isModalOpen(state, ModalIdentifiers.PRICING_MODAL));
    const renewModalOpen = useSelector((state: GlobalState) => isModalOpen(state, ModalIdentifiers.SELF_HOSTED_RENEWAL));
    const comparingPlansWhilePurchasing = pricingModalOpen && renewModalOpen;

    return useMemo(() => {
        return {
            close: () => {
                dispatch(closeModal(ModalIdentifiers.SELF_HOSTED_RENEWAL));
            },
            open: async (productId: string) => {
                // check if purchase modal is already open
                // i.e. they are allowed to compare plans from within the purchase modal
                // if so, all we need to do is close the compare plans modal so that
                // the purchase modal is available again.
                if (comparingPlansWhilePurchasing) {
                    dispatch(closeModal(ModalIdentifiers.PRICING_MODAL));
                    return;
                }
                const purchaseInProgress = localStorage.getItem(STORAGE_KEY_RENEWAL_IN_PROGRESS) === 'true';

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
                        },
                    }));
                    return;
                }

                trackEvent(TELEMETRY_CATEGORIES.SELF_HOSTED_RENEWAL, 'click_open_renewal_modal', {
                    callerInfo: options.trackingLocation,
                });
                if (options.onClick) {
                    options.onClick();
                }
                dispatch(closeModal(ModalIdentifiers.PRICING_MODAL));
                dispatch(openModal({
                  modalId: ModalIdentifiers.SELF_HOSTED_RENEWAL,
                  dialogType: SelfHostedRenewalModal,
                  dialogProps: {
                      productId,
                  },
                }));
        },
    }}, [options.onClick, options.trackingLocation, comparingPlansWhilePurchasing]);
}
