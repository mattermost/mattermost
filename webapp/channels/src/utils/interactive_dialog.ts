// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

// Maximum number of interactive dialogs that may be open at once. Kept in a
// side-effect-free module so it can be shared by both plugins/interactive_dialog
// (which runs a store.subscribe side-effect at module load) and websocket_actions
// without dragging that side-effect into the importer's module graph.
export const MAX_OPEN_DIALOGS = 3;

export function getOpenDialogCount(state: GlobalState): number {
    const modals = state.views.modals?.modalState ?? {};
    return Object.keys(modals).filter(
        (id) => id.startsWith(ModalIdentifiers.INTERACTIVE_DIALOG),
    ).length;
}

// Returns the trigger_id of the most recently opened interactive dialog. modalState
// keys are in the order the modals opened (entries are deleted on close), which is
// what the modal manager stacks by. The dialogs map is not used: a dialog can be
// stored before it opens (an open_dialog event that arrives before its trigger id),
// and it keeps that earlier position when it opens later.
export function getTopOpenDialogTriggerId(state: GlobalState): string | undefined {
    const prefix = `${ModalIdentifiers.INTERACTIVE_DIALOG}_`;
    const modals = state.views.modals?.modalState ?? {};
    const topModalId = Object.keys(modals).
        filter((modalId) => modalId.startsWith(prefix) && modals[modalId]?.open).
        pop();
    return topModalId?.slice(prefix.length);
}
