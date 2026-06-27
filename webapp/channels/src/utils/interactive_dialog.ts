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
