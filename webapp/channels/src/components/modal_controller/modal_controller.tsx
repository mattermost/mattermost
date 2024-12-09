// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

type Modal = {
    open: boolean;
    dialogType: React.ComponentType;
    dialogProps?: Record<string, any>;
}

type Props = {

    /*
     * Object that has map of modal's id and element
     */
    modals: {
        modalState: {
            [modalId: string]: Modal;
        };
    };

    /*
     * Object with action creators
     */
    actions: {

        /*
         * Action creator to close modal
         */
        closeModal: (modalId: string) => void;
    };
}

const ModalController = ({
    modals,
    actions,
}: Props) => {
    if (!modals) {
        return null;
    }

    const {modalState} = modals;
    const modalOutput = [];

    for (const modalId in modalState) {
        if (Object.hasOwn(modalState, modalId)) {
            const modal = modalState[modalId];
            if (modal.open) {
                const modalComponent = React.createElement(modal.dialogType, Object.assign({}, modal.dialogProps, {
                    onExited: () => {
                        actions.closeModal(modalId);

                        // Call any onExited prop provided by whoever opened the modal, if one was provided
                        modal.dialogProps?.onExited?.();
                    },
                    onHide: actions.closeModal.bind(this, modalId),
                    key: `${modalId}_modal`,
                }));

                modalOutput.push(modalComponent);
            }
        }
    }

    return <>{modalOutput}</>;
};

export default ModalController;
