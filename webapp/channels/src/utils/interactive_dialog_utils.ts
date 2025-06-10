// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {submitInteractiveDialog} from 'actions/integration_actions';
import {openModal} from 'actions/views/modals';
import store from 'stores/redux_store';

// Lazy imports to avoid circular dependencies
const InteractiveDialog = React.lazy(() => import('components/interactive_dialog'));
const InteractiveDialogAdapter = React.lazy(() => import('components/interactive_dialog_adapter'));

import {ModalIdentifiers} from 'utils/constants';

/**
 * Centralized function to open Interactive Dialog with feature flag support
 * This handles the decision between using the legacy InteractiveDialog or the new Apps Form adapter
 */
export function openInteractiveDialogModal(dialogRequest: any): void {
    const state = store.getState();
    const config = getConfig(state);
    const useAppsFormForDialogs = config?.FeatureFlagInteractiveDialogAppsForm === 'true';

    if (useAppsFormForDialogs) {
        // Use new Apps Form adapter
        store.dispatch(openModal({
            modalId: ModalIdentifiers.INTERACTIVE_DIALOG,
            dialogType: InteractiveDialogAdapter,
            dialogProps: {
                dialogRequest: {
                    trigger_id: dialogRequest.trigger_id,
                    url: dialogRequest.url,
                    dialog: dialogRequest.dialog || dialogRequest,
                },
                actions: {
                    submitInteractiveDialog: (request: any) => store.dispatch(submitInteractiveDialog(request)),
                },
            },
        }));
    } else {
        // Use original Interactive Dialog component
        store.dispatch(openModal({
            modalId: ModalIdentifiers.INTERACTIVE_DIALOG,
            dialogType: InteractiveDialog,
        }));
    }
}
