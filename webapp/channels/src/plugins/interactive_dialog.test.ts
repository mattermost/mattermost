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

import {openInteractiveDialog} from './interactive_dialog';

const mockStore = store as jest.Mocked<typeof store>;
const mockOpenModal = openModal as jest.MockedFunction<typeof openModal>;

// Build a minimal GlobalState whose views.modals.modalState contains the
// supplied modal ids mapped to a truthy open entry.
function makeState(modalIds: string[], dialogTriggerId = '', dialog: any = null) {
    const modalState: Record<string, {open: boolean}> = {};
    for (const id of modalIds) {
        modalState[id] = {open: true};
    }
    return {
        entities: {
            integrations: {
                dialogTriggerId,
                dialog,
            },
        },
        views: {
            modals: {
                modalState,
            },
        },
    } as any;
}

// Capture the subscribe callback registered at module-load time BEFORE any
// beforeEach can clear the mock call history.
let subscribeCallback: () => void;
beforeAll(() => {
    subscribeCallback = (mockStore.subscribe as jest.Mock).mock.calls[0][0];
});

beforeEach(() => {
    jest.clearAllMocks();
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

// ---------------------------------------------------------------------------
// store.subscribe callback tests
//
// The module registers store.subscribe(callback) at load time.  previousTriggerId
// is module-scoped state that persists across invocations — each test uses a
// distinct trigger id and is ordered so that prior state is accounted for.
// ---------------------------------------------------------------------------
describe('store.subscribe callback', () => {
    // Sequence counter ensures each test gets a globally unique trigger id so
    // that module-level previousTriggerId state never causes a false "unchanged"
    // match between tests.
    let seq = 0;
    const nextId = () => `sub-trigger-${++seq}`;

    it('returns early without dispatching openModal when currentTriggerId === previousTriggerId', () => {
        // First call: advance previousTriggerId from '' to triggerId-A.
        const triggerIdA = nextId();
        mockStore.getState.mockReturnValue(
            makeState([], triggerIdA, {trigger_id: triggerIdA, dialog: {}}),
        );
        subscribeCallback(); // previousTriggerId is now triggerIdA

        jest.clearAllMocks(); // reset dispatch / openModal call counts

        // Second call with the SAME triggerId — should return early.
        mockStore.getState.mockReturnValue(
            makeState([], triggerIdA, {trigger_id: triggerIdA, dialog: {}}),
        );
        subscribeCallback();

        expect(mockStore.dispatch).not.toHaveBeenCalled();
        expect(mockOpenModal).not.toHaveBeenCalled();
    });

    it('returns early without dispatching openModal when dialog is null', () => {
        const triggerId = nextId();

        // dialog is null — even though triggerId changed, the callback should bail.
        mockStore.getState.mockReturnValue(makeState([], triggerId, null));
        subscribeCallback();

        expect(mockStore.dispatch).not.toHaveBeenCalled();
        expect(mockOpenModal).not.toHaveBeenCalled();
    });

    it('returns early without dispatching openModal when dialog.trigger_id !== currentTriggerId', () => {
        const triggerId = nextId();

        // dialog exists but its trigger_id is a different value.
        mockStore.getState.mockReturnValue(
            makeState([], triggerId, {trigger_id: 'some-other-id', dialog: {}}),
        );
        subscribeCallback();

        expect(mockStore.dispatch).not.toHaveBeenCalled();
        expect(mockOpenModal).not.toHaveBeenCalled();
    });

    it('dispatches openModal with the composite modalId when triggerId changed and dialog matches and count is under cap', () => {
        const triggerId = nextId();
        mockStore.getState.mockReturnValue(
            makeState([], triggerId, {trigger_id: triggerId, dialog: {}}),
        );
        subscribeCallback();

        expect(mockOpenModal).toHaveBeenCalledTimes(1);
        expect(mockOpenModal).toHaveBeenCalledWith(
            expect.objectContaining({
                modalId: `${ModalIdentifiers.INTERACTIVE_DIALOG}_${triggerId}`,
            }),
        );
        expect(mockStore.dispatch).toHaveBeenCalledWith(
            expect.objectContaining({type: 'OPEN_MODAL'}),
        );
    });

    it('emits console.warn and does NOT dispatch openModal when at the cap (3 open)', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            const triggerId = nextId();
            const atCapIds = [
                `${ModalIdentifiers.INTERACTIVE_DIALOG}_cap1`,
                `${ModalIdentifiers.INTERACTIVE_DIALOG}_cap2`,
                `${ModalIdentifiers.INTERACTIVE_DIALOG}_cap3`,
            ];
            mockStore.getState.mockReturnValue(
                makeState(atCapIds, triggerId, {trigger_id: triggerId, dialog: {}}),
            );
            subscribeCallback();

            expect(mockOpenModal).not.toHaveBeenCalled();
            expect(mockStore.dispatch).not.toHaveBeenCalled();
            expect(warnSpy).toHaveBeenCalledWith('Maximum number of open dialogs reached');
        } finally {
            warnSpy.mockRestore();
        }
    });
});
