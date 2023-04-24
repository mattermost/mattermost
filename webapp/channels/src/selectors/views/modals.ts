// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from 'types/store';

export function isModalOpen(state: GlobalState, modalId: string) {
    return Boolean(state.views.modals.modalState[modalId] && state.views.modals.modalState[modalId].open);
}
export function isAnyModalOpen(state: GlobalState) {
    return Boolean(state.views.modals.modalState && findOpenModal(state));
}

function findOpenModal(state: GlobalState) {
    let isOpen = false;
    const modalStateObject = state.views.modals.modalState;
    for (const modal in modalStateObject) {
        if (modal && modalStateObject[modal].open) {
            isOpen = true;
            break;
        }
    }
    return isOpen;
}
