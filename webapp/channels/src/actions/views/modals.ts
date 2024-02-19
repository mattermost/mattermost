// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ActionTypes} from 'utils/constants';

import type {ModalData} from 'types/actions';

export function openModal<P>(modalData: ModalData<P>) {
    return {
        type: ActionTypes.MODAL_OPEN,
        modalId: modalData.modalId,
        dialogProps: modalData.dialogProps,
        dialogType: modalData.dialogType,
    };
}

export type CloseModalType = {
    type: string;
    modalId: string;
}

export function closeModal(modalId: string) {
    return {
        type: ActionTypes.MODAL_CLOSE,
        modalId,
    };
}
