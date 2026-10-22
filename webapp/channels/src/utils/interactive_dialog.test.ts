// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ModalIdentifiers} from 'utils/constants';

import {MAX_OPEN_DIALOGS, getOpenDialogCount, getTopOpenDialogTriggerId} from './interactive_dialog';

// Build a minimal GlobalState whose views.modals.modalState contains the
// supplied modal ids mapped to a truthy open entry.
function makeState(modalIds: string[]) {
    const modalState: Record<string, {open: boolean}> = {};
    for (const id of modalIds) {
        modalState[id] = {open: true};
    }
    return {
        views: {
            modals: {
                modalState,
            },
        },
    } as any;
}

describe('MAX_OPEN_DIALOGS', () => {
    it('is 3', () => {
        expect(MAX_OPEN_DIALOGS).toBe(3);
    });
});

describe('getOpenDialogCount', () => {
    it('returns 0 when modalState is empty', () => {
        const state = makeState([]);
        expect(getOpenDialogCount(state)).toBe(0);
    });

    it('returns 0 when modalState is undefined', () => {
        const state = {views: {modals: {}}} as any;
        expect(getOpenDialogCount(state)).toBe(0);
    });

    it('counts only keys that start with ModalIdentifiers.INTERACTIVE_DIALOG', () => {
        const interactiveDialogIds = [
            ModalIdentifiers.INTERACTIVE_DIALOG,
            `${ModalIdentifiers.INTERACTIVE_DIALOG}_trigger1`,
            `${ModalIdentifiers.INTERACTIVE_DIALOG}_trigger2`,
        ];
        const otherIds = ['delete_channel', 'edit_post', 'some_other_modal'];
        const state = makeState([...interactiveDialogIds, ...otherIds]);

        expect(getOpenDialogCount(state)).toBe(3);
    });

    it('returns 0 when only non-interactive-dialog modals are open', () => {
        const state = makeState(['delete_channel', 'edit_post']);
        expect(getOpenDialogCount(state)).toBe(0);
    });

    it('returns 1 when a single interactive dialog is open', () => {
        const state = makeState([ModalIdentifiers.INTERACTIVE_DIALOG]);
        expect(getOpenDialogCount(state)).toBe(1);
    });
});

describe('getTopOpenDialogTriggerId', () => {
    // dialogTriggerIds: entries in the dialogs map, in arrival order.
    // openTriggerIds: dialogs that have an open modal.
    function makeDialogState(dialogTriggerIds: string[], openTriggerIds: string[]) {
        const state = makeState(openTriggerIds.map((id) => `${ModalIdentifiers.INTERACTIVE_DIALOG}_${id}`));
        state.entities = {integrations: {dialogs: Object.fromEntries(dialogTriggerIds.map((id) => [id, {trigger_id: id}]))}};
        return state;
    }

    it('returns undefined when no dialogs are open', () => {
        expect(getTopOpenDialogTriggerId(makeDialogState([], []))).toBeUndefined();
    });

    it('returns the most recently opened dialog', () => {
        const state = makeDialogState(['parent', 'child'], ['parent', 'child']);
        expect(getTopOpenDialogTriggerId(state)).toBe('child');
    });

    it('returns the parent once the child is closed', () => {
        const state = makeDialogState(['parent'], ['parent']);
        expect(getTopOpenDialogTriggerId(state)).toBe('parent');
    });

    it('skips dialogs that are stored but have no open modal', () => {
        // An open_dialog event for a trigger that never becomes current (e.g. from
        // another session) leaves an entry in the dialogs map without a modal. It
        // must not be treated as the top dialog, or the real open dialog gets hidden.
        const state = makeDialogState(['parent', 'orphan'], ['parent']);
        expect(getTopOpenDialogTriggerId(state)).toBe('parent');
    });

    it('follows the order modals were opened, not the order dialogs were stored', () => {
        // Dialog A is stored by an open_dialog event before its trigger id is current,
        // then B is stored and opened, then A's trigger id lands and A opens on top.
        // The dialogs map keeps A first, but A is the top dialog.
        const state = makeDialogState(['a', 'b'], ['b', 'a']);
        expect(getTopOpenDialogTriggerId(state)).toBe('a');
    });

    it('ignores other modals opened after the dialog', () => {
        const state = makeDialogState(['parent'], ['parent']);
        state.views.modals.modalState.delete_channel = {open: true};
        expect(getTopOpenDialogTriggerId(state)).toBe('parent');
    });
});
