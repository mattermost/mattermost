// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {Invoice} from '@mattermost/types/cloud';

import {closeModal} from 'actions/views/modals';
import {isModalOpen} from 'selectors/views/modals';

import {ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

import BillingHistoryTable from './billing_history_table';

import './billing_history_modal.scss';
import './billing_history.scss';

type BillingHistoryModalProps = {
    invoices: Invoice[] | undefined;
    onHide?: () => void;
}

const invoiceListToRecordList = (invoices: Invoice[]) => {
    const records = {} as Record<string, Invoice>;
    invoices.forEach((invoice) => {
        records[invoice.id] = invoice;
    });
    return records;
};

export default function BillingHistoryModal(props: BillingHistoryModalProps) {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();

    const isBillingHistoryModalOpen = useSelector((state: GlobalState) => isModalOpen(state, ModalIdentifiers.BILLING_HISTORY));

    if (!props.invoices) {
        return null;
    }

    const onHide = () => {
        dispatch(closeModal(ModalIdentifiers.BILLING_HISTORY));

        if (typeof props.onHide === 'function') {
            props.onHide();
        }
    };

    return (
        <Modal
            show={isBillingHistoryModalOpen}
            onExited={onHide}
            onHide={onHide}
            id='cloud-billing-history-modal'
            className='CloudBillingHistoryModal'
            dialogClassName='a11y__modal'
        >
            <Modal.Header closeButton={true}>
                <Modal.Title className='CloudBillingHistoryModal__title'>{formatMessage({id: 'cloud_billing_history_modal.title', defaultMessage: 'Unpaid Invoice(s)'})}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <BillingHistoryTable invoices={invoiceListToRecordList(props.invoices)}/>
            </Modal.Body>
        </Modal>
    );
}
