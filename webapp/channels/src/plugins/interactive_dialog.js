// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {openModal} from 'actions/views/modals';
import {
    IntegrationTypes,
} from 'mattermost-redux/action_types';

import InteractiveDialog from 'components/interactive_dialog';

import store from '../stores/redux_store';
import {ModalIdentifiers} from 'utils/constants';

export function openInteractiveDialog(dialog) {
    store.dispatch({type: IntegrationTypes.RECEIVED_DIALOG, data: dialog});

    store.dispatch(openModal({modalId: ModalIdentifiers.INTERACTIVE_DIALOG, dialogType: InteractiveDialog}));
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

    const dialog = state.entities.integrations.dialog || {};
    if (dialog.trigger_id !== currentTriggerId) {
        return;
    }

    store.dispatch(openModal({modalId: ModalIdentifiers.INTERACTIVE_DIALOG, dialogType: InteractiveDialog}));
});
