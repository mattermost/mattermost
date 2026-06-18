// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {IntegrationTypes} from 'mattermost-redux/action_types';

import {openModal} from 'actions/views/modals';
import store from 'stores/redux_store';

import DialogRouter from 'components/dialog_router';

import {ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

export const MAX_OPEN_DIALOGS = 3;

export function getOpenDialogCount(state: GlobalState): number {
    const modals = state.views.modals?.modalState ?? {};
    return Object.keys(modals).filter(
        (id) => id.startsWith(ModalIdentifiers.INTERACTIVE_DIALOG),
    ).length;
}

export function openInteractiveDialog(dialog: any): void {
    // Store the dialog before the cap check so the store.subscribe fallback below
    // can still find it once dialogTriggerId updates. Only the modal open is gated
    // by the concurrent-dialog cap.
    store.dispatch({type: IntegrationTypes.RECEIVED_DIALOG, data: dialog});

    if (getOpenDialogCount(store.getState()) >= MAX_OPEN_DIALOGS) {
        // eslint-disable-next-line no-console
        console.warn('Maximum number of open dialogs reached');
        return;
    }

    const triggerId = dialog?.trigger_id;
    const modalId = triggerId ? `${ModalIdentifiers.INTERACTIVE_DIALOG}_${triggerId}` : ModalIdentifiers.INTERACTIVE_DIALOG;
    store.dispatch(openModal({modalId, dialogType: DialogRouter}));
}

// This code is problematic for a couple of different reasons:
// * it monitors the store to modify the store: this is perhaps better handled by a saga
// * it makes importing this file impure by triggering a side-effect which may not be obvious
// * it's not really located in the "right place": dialogs are applicable to non-plugins too
// * it's nigh impossible to test as written
//
// It's worth fixing all of this, but I think this requires some refactoring.
let previousTriggerId = '';
store.subscribe(() => {
    const state = store.getState();
    const currentTriggerId = state.entities.integrations.dialogTriggerId;

    if (currentTriggerId === previousTriggerId) {
        return;
    }

    previousTriggerId = currentTriggerId;

    const dialog = state.entities.integrations.dialog;
    if (!dialog || dialog.trigger_id !== currentTriggerId) {
        return;
    }

    if (getOpenDialogCount(state) >= MAX_OPEN_DIALOGS) {
        // eslint-disable-next-line no-console
        console.warn('Maximum number of open dialogs reached');
        return;
    }

    const modalId = `${ModalIdentifiers.INTERACTIVE_DIALOG}_${currentTriggerId}`;
    store.dispatch(openModal({modalId, dialogType: DialogRouter}));
});
