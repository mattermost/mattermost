// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {IntegrationTypes} from 'mattermost-redux/action_types';

import {openModal} from 'actions/views/modals';
import store from 'stores/redux_store';

import DialogRouter from 'components/dialog_router';

import {ModalIdentifiers} from 'utils/constants';
import {MAX_OPEN_DIALOGS, getOpenDialogCount} from 'utils/interactive_dialog';

export function openInteractiveDialog(dialog: any): void {
    if (getOpenDialogCount(store.getState()) >= MAX_OPEN_DIALOGS) {
        // eslint-disable-next-line no-console
        console.warn('Maximum number of open dialogs reached');
        return;
    }

    store.dispatch({type: IntegrationTypes.RECEIVED_DIALOG, data: dialog});

    const triggerId = dialog?.trigger_id;
    const modalId = triggerId ? `${ModalIdentifiers.INTERACTIVE_DIALOG}_${triggerId}` : ModalIdentifiers.INTERACTIVE_DIALOG;
    store.dispatch(openModal({
        modalId,
        dialogType: DialogRouter,
        dialogProps: {
            triggerId,
            onExited: () => triggerId && store.dispatch({type: IntegrationTypes.REMOVE_DIALOG, data: triggerId}),
        },
    }));
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

    const dialog = state.entities.integrations.dialogs?.[currentTriggerId];
    if (!dialog) {
        return;
    }

    if (getOpenDialogCount(state) >= MAX_OPEN_DIALOGS) {
        // eslint-disable-next-line no-console
        console.warn('Maximum number of open dialogs reached');
        store.dispatch({type: IntegrationTypes.REMOVE_DIALOG, data: currentTriggerId});
        return;
    }

    const modalId = `${ModalIdentifiers.INTERACTIVE_DIALOG}_${currentTriggerId}`;
    store.dispatch(openModal({
        modalId,
        dialogType: DialogRouter,
        dialogProps: {
            triggerId: currentTriggerId,
            onExited: () => store.dispatch({type: IntegrationTypes.REMOVE_DIALOG, data: currentTriggerId}),
        },
    }));
});
