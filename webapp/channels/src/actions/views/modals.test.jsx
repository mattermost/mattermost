// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';

import {openModal, closeModal} from 'actions/views/modals';

import mockStore from 'tests/test_store';
import {ActionTypes, ModalIdentifiers} from 'utils/constants';

const TestModal = () => (
    <Modal
        show={true}
    >
        <Modal.Header closeButton={true}/>
        <Modal.Body/>
    </Modal>
);

describe('modals view actions', () => {
    let store;
    beforeEach(() => {
        store = mockStore();
    });

    test(ActionTypes.MODAL_OPEN, () => {
        const dialogType = TestModal;
        const dialogProps = {
            test: true,
        };

        const modalData = {
            type: ActionTypes.MODAL_OPEN,
            modalId: ModalIdentifiers.DELETE_CHANNEL,
            dialogType,
            dialogProps,
        };

        store.dispatch(openModal(modalData));

        const action = {
            type: ActionTypes.MODAL_OPEN,
            modalId: ModalIdentifiers.DELETE_CHANNEL,
            dialogType,
            dialogProps,
        };

        expect(store.getActions()).toEqual([action]);
    });

    test(ActionTypes.MODAL_CLOSE, () => {
        store.dispatch(closeModal(ModalIdentifiers.DELETE_CHANNEL));

        const action = {
            type: ActionTypes.MODAL_CLOSE,
            modalId: ModalIdentifiers.DELETE_CHANNEL,
        };

        expect(store.getActions()).toEqual([action]);
    });
});
