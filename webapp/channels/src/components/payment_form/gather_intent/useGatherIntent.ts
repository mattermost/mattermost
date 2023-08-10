// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useState, useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {TypePurchases} from '@mattermost/types/cloud';

import {updateCloudCustomer} from 'mattermost-redux/actions/cloud';

import {trackEvent} from 'actions/telemetry_actions';

import type {MetadataGatherWireTransferKeys} from '@mattermost/types/cloud';
import type {GlobalState} from 'types/store';

interface UseGatherIntentArgs {
    typeGatherIntent: keyof typeof TypePurchases;
}

export type FormDataState = FormDateStateWithoutOtherPayment | FormDateStateWithOtherPayment;

interface FormDateStateWithOtherPayment {
    wire: boolean;
    ach: boolean;
    other: true;
    otherPaymentOption: string;
}

interface FormDateStateWithoutOtherPayment {
    wire: boolean;
    ach: boolean;
    other: false;
    otherPaymentOption?: never;
}

export const useGatherIntent = ({typeGatherIntent}: UseGatherIntentArgs) => {
    const dispatch = useDispatch<any>();
    const [feedbackSaved, setFeedbackSave] = useState(false);
    const [showError, setShowError] = useState(false);
    const [submittingFeedback, setSubmittingFeedback] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const customer = useSelector((state: GlobalState) => state.entities.cloud.customer);

    const handleSaveFeedback = async (formData: FormDataState) => {
        setSubmittingFeedback(() => true);

        const gatherIntentKey: MetadataGatherWireTransferKeys = `${TypePurchases[typeGatherIntent]}_alt_payment_method`;

        const {error} = await dispatch(updateCloudCustomer({
            [gatherIntentKey]: JSON.stringify(formData),
        }));

        if (error == null) {
            setFeedbackSave(() => true);
        }

        if (error != null) {
            setShowError(() => true);
        }

        setSubmittingFeedback(() => false);
    };

    const handleOpenModal = () => {
        trackEvent('click_open_payment_feedback_form_modal', {
            location: `${TypePurchases[typeGatherIntent]}_form`,
        });
        setShowModal(() => true);
    };

    const handleCloseModal = () => {
        setShowModal(() => false);
    };

    useEffect(() => {
        if (customer != null) {
            const gatherIntentKey: MetadataGatherWireTransferKeys = `${TypePurchases[typeGatherIntent]}_alt_payment_method`;
            setFeedbackSave(Boolean(customer[gatherIntentKey]));
        }
    }, [customer, typeGatherIntent]);

    return {feedbackSaved, handleSaveFeedback, handleOpenModal, showModal, handleCloseModal, submittingFeedback, showError};
};
