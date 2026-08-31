// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ModalIdentifiers} from 'utils/constants';

import {MAX_OPEN_DIALOGS, getOpenDialogCount} from './interactive_dialog';

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
