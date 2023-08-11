// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useState} from 'react';
import {useSelector, useDispatch} from 'react-redux';

import type {Subscription} from '@mattermost/types/cloud';
import type {PreferenceType} from '@mattermost/types/preferences';

import {getCloudProducts} from 'mattermost-redux/actions/cloud';
import {getSubscriptionProduct} from 'mattermost-redux/selectors/entities/cloud';

import {setItem} from 'actions/storage';
import {makeGetItem} from 'selectors/storage';

import type {ModalData} from 'types/actions';
import {StoragePrefixes, ModalIdentifiers} from 'utils/constants';

import DelinquencyModal from './delinquency_modal';

const SESSION_MODAL_ITEM = `${StoragePrefixes.DELINQUENCY}hide_downgrade_modal`;

type UseDelinquencyModalController = {
    userIsAdmin: boolean;
    subscription?: Subscription;
    isCloud: boolean;
    actions: {
        getCloudSubscription: () => void;
        closeModal: () => void;
        openModal: <P>(modalData: ModalData<P>) => void;
    };
    delinquencyModalPreferencesConfirmed: PreferenceType[];
}

export const useDelinquencyModalController = (props: UseDelinquencyModalController) => {
    const {isCloud, userIsAdmin, subscription, actions, delinquencyModalPreferencesConfirmed} = props;
    const product = useSelector(getSubscriptionProduct);
    const sessionModalItem = useSelector(makeGetItem(SESSION_MODAL_ITEM, ''));
    const dispatch = useDispatch();
    const [showModal, setShowModal] = useState(false);
    const {openModal} = actions;
    const [requestedProducts, setRequestedProducts] = useState(false);

    const handleOnExit = () => {
        setShowModal(() => false);
        dispatch(setItem(SESSION_MODAL_ITEM, 'true'));
    };

    useEffect(() => {
        if (delinquencyModalPreferencesConfirmed.length === 0 && product === undefined && !requestedProducts && isCloud) {
            dispatch(getCloudProducts());
            setRequestedProducts(true);
        }
    }, []);

    useEffect(() => {
        if (showModal || !isCloud) {
            return;
        }

        if (delinquencyModalPreferencesConfirmed.length > 0) {
            return;
        }

        if (subscription == null) {
            return;
        }

        const isClosed = Boolean(sessionModalItem) === true;

        if (isClosed) {
            return;
        }

        if (subscription.delinquent_since == null) {
            return;
        }

        const delinquencyDate = new Date(subscription.delinquent_since * 1000);

        const oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds
        const today = new Date();
        const diffDays = Math.round(
            Math.abs((today.valueOf() - delinquencyDate.valueOf()) / oneDay),
        );
        if (diffDays < 90) {
            return;
        }

        if (!userIsAdmin) {
            return;
        }

        setShowModal(true);
    }, [delinquencyModalPreferencesConfirmed.length, isCloud, openModal, showModal, subscription, userIsAdmin]);

    useEffect(() => {
        if (showModal && product != null) {
            openModal({
                modalId: ModalIdentifiers.DELINQUENCY_MODAL_DOWNGRADE,
                dialogType: DelinquencyModal,
                dialogProps: {
                    closeModal: actions.closeModal,
                    onExited: handleOnExit,
                    planName: product.name,
                },
            });
        }
    }, [actions.closeModal, openModal, product, showModal]);
};
