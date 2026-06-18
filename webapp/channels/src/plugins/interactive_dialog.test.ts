// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Mock the singleton store before the module under test is imported, so the
// store.subscribe() side-effect at module-eval time uses the mock.
jest.mock('stores/redux_store', () => ({
    __esModule: true,
    default: {
        getState: jest.fn(),
        dispatch: jest.fn(),
        subscribe: jest.fn(),
    },
}));

jest.mock('actions/views/modals', () => ({
    openModal: jest.fn((x: any) => ({type: 'OPEN_MODAL', ...x})),
}));

jest.mock('components/dialog_router', () => ({
    __esModule: true,
    default: () => null,
}));

import {IntegrationTypes} from 'mattermost-redux/action_types';

import {openModal} from 'actions/views/modals';
import store from 'stores/redux_store';

import {ModalIdentifiers} from 'utils/constants';

import {
    MAX_OPEN_DIALOGS,
    getOpenDialogCount,
    openInteractiveDialog,
} from './interactive_dialog';

const mockStore = store as jest.Mocked<typeof store>;
const mockOpenModal = openModal as jest.MockedFunction<typeof openModal>;

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

beforeEach(() => {
    jest.clearAllMocks();
});

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

describe('openInteractiveDialog', () => {
    const sampleDialog = {trigger_id: 'trigger-abc', dialog: {}};

    describe('UNDER the cap (0 dialogs open)', () => {
        beforeEach(() => {
            mockStore.getState.mockReturnValue(makeState([]));
        });

        it('dispatches RECEIVED_DIALOG', () => {
            openInteractiveDialog(sampleDialog);

            expect(mockStore.dispatch).toHaveBeenCalledWith({
                type: IntegrationTypes.RECEIVED_DIALOG,
                data: sampleDialog,
            });
        });

        it('dispatches openModal', () => {
            openInteractiveDialog(sampleDialog);

            expect(mockOpenModal).toHaveBeenCalledTimes(1);
            expect(mockStore.dispatch).toHaveBeenCalledWith(
                expect.objectContaining({type: 'OPEN_MODAL'}),
            );
        });

        it('dispatches RECEIVED_DIALOG before openModal', () => {
            openInteractiveDialog(sampleDialog);

            // store.dispatch is called twice: first for RECEIVED_DIALOG, then for openModal.
            const calls = mockStore.dispatch.mock.calls;
            expect(calls.length).toBe(2);

            const firstCallArg = calls[0][0] as any;
            const secondCallArg = calls[1][0] as any;

            expect(firstCallArg.type).toBe(IntegrationTypes.RECEIVED_DIALOG);
            expect(secondCallArg.type).toBe('OPEN_MODAL');
        });

        it('uses trigger_id in the modalId when trigger_id is present', () => {
            openInteractiveDialog(sampleDialog);

            expect(mockOpenModal).toHaveBeenCalledWith(
                expect.objectContaining({
                    modalId: `${ModalIdentifiers.INTERACTIVE_DIALOG}_${sampleDialog.trigger_id}`,
                }),
            );
        });

        it('falls back to base ModalIdentifiers.INTERACTIVE_DIALOG when no trigger_id', () => {
            openInteractiveDialog({dialog: {}});

            expect(mockOpenModal).toHaveBeenCalledWith(
                expect.objectContaining({
                    modalId: ModalIdentifiers.INTERACTIVE_DIALOG,
                }),
            );
        });
    });

    describe('AT the cap (3 dialogs open)', () => {
        let warnSpy: jest.SpyInstance;

        beforeEach(() => {
            const atCapIds = [
                `${ModalIdentifiers.INTERACTIVE_DIALOG}_t1`,
                `${ModalIdentifiers.INTERACTIVE_DIALOG}_t2`,
                `${ModalIdentifiers.INTERACTIVE_DIALOG}_t3`,
            ];
            mockStore.getState.mockReturnValue(makeState(atCapIds));

            // Suppress the expected console.warn so setup_jest.ts doesn't fail.
            warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        });

        afterEach(() => {
            warnSpy.mockRestore();
        });

        it('still dispatches RECEIVED_DIALOG (so the store.subscribe fallback can recover) but does not open a modal', () => {
            openInteractiveDialog(sampleDialog);

            expect(mockStore.dispatch).toHaveBeenCalledTimes(1);
            expect(mockStore.dispatch).toHaveBeenCalledWith({
                type: IntegrationTypes.RECEIVED_DIALOG,
                data: sampleDialog,
            });

            // The cap gates only the modal open, not the state write.
            expect(mockOpenModal).not.toHaveBeenCalled();
        });

        it('does NOT call openModal', () => {
            openInteractiveDialog(sampleDialog);

            expect(mockOpenModal).not.toHaveBeenCalled();
        });

        it('emits a console.warn', () => {
            openInteractiveDialog(sampleDialog);

            expect(warnSpy).toHaveBeenCalledWith('Maximum number of open dialogs reached');
        });
    });

    describe('BELOW the cap (2 dialogs open)', () => {
        beforeEach(() => {
            const twoOpenIds = [
                `${ModalIdentifiers.INTERACTIVE_DIALOG}_t1`,
                `${ModalIdentifiers.INTERACTIVE_DIALOG}_t2`,
            ];
            mockStore.getState.mockReturnValue(makeState(twoOpenIds));
        });

        it('still dispatches RECEIVED_DIALOG and openModal', () => {
            openInteractiveDialog(sampleDialog);

            expect(mockStore.dispatch).toHaveBeenCalledTimes(2);
            expect(mockStore.dispatch).toHaveBeenCalledWith({
                type: IntegrationTypes.RECEIVED_DIALOG,
                data: sampleDialog,
            });
            expect(mockOpenModal).toHaveBeenCalledTimes(1);
        });
    });
});
