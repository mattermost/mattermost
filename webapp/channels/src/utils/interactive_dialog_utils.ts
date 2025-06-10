// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {submitInteractiveDialog} from 'actions/integration_actions';
import {openModal} from 'actions/views/modals';
import store from 'stores/redux_store';

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
        // Dynamically import and use new Apps Form adapter
        import('components/interactive_dialog_adapter').then((module) => {
            const InteractiveDialogAdapter = module.default;
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
        }).catch((error) => {
            console.error('Failed to load InteractiveDialogAdapter:', error);
            // Fallback to original dialog
            import('components/interactive_dialog').then((module) => {
                const InteractiveDialog = module.default;
                store.dispatch(openModal({
                    modalId: ModalIdentifiers.INTERACTIVE_DIALOG,
                    dialogType: InteractiveDialog,
                }));
            });
        });
    } else {
        // Dynamically import and use original Interactive Dialog component
        import('components/interactive_dialog').then((module) => {
            const InteractiveDialog = module.default;
            store.dispatch(openModal({
                modalId: ModalIdentifiers.INTERACTIVE_DIALOG,
                dialogType: InteractiveDialog,
            }));
        }).catch((error) => {
            console.error('Failed to load InteractiveDialog:', error);
        });
    }
}
