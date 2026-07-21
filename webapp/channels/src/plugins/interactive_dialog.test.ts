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
function makeState(modalIds: string[], dialogTriggerId = '', dialogs: Record<string, any> = {}) {
    const modalState: Record<string, {open: boolean}> = {};
    for (const id of modalIds) {
        modalState[id] = {open: true};
    }
    return {
        entities: {
            integrations: {
                dialogTriggerId,
                dialogs,
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

        it('passes triggerId in dialogProps', () => {
            openInteractiveDialog(sampleDialog);

            expect(mockOpenModal).toHaveBeenCalledWith(
                expect.objectContaining({
                    dialogProps: expect.objectContaining({
                        triggerId: sampleDialog.trigger_id,
                    }),
                }),
            );
        });

        it('passes onExited in dialogProps that dispatches REMOVE_DIALOG', () => {
            openInteractiveDialog(sampleDialog);

            const {dialogProps} = (mockOpenModal as jest.Mock).mock.calls[0][0];
            expect(typeof dialogProps.onExited).toBe('function');

            jest.clearAllMocks();
            dialogProps.onExited();

            expect(mockStore.dispatch).toHaveBeenCalledWith({
                type: IntegrationTypes.REMOVE_DIALOG,
                data: sampleDialog.trigger_id,
            });
        });

        it('falls back to base ModalIdentifiers.INTERACTIVE_DIALOG when no trigger_id', () => {
            openInteractiveDialog({dialog: {}});

            expect(mockOpenModal).toHaveBeenCalledWith(
                expect.objectContaining({
                    modalId: ModalIdentifiers.INTERACTIVE_DIALOG,
                }),
            );
        });

        it('onExited is a no-op when there is no trigger_id', () => {
            openInteractiveDialog({dialog: {}});

            const {dialogProps} = (mockOpenModal as jest.Mock).mock.calls[0][0];
            jest.clearAllMocks();
            dialogProps.onExited();

            expect(mockStore.dispatch).not.toHaveBeenCalled();
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

        it('does not dispatch anything or open a modal when at cap', () => {
            openInteractiveDialog(sampleDialog);

            expect(mockStore.dispatch).not.toHaveBeenCalled();
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
            makeState([], triggerIdA, {[triggerIdA]: {trigger_id: triggerIdA, dialog: {}}}),
        );
        subscribeCallback(); // previousTriggerId is now triggerIdA

        jest.clearAllMocks(); // reset dispatch / openModal call counts

        // Second call with the SAME triggerId — should return early.
        mockStore.getState.mockReturnValue(
            makeState([], triggerIdA, {[triggerIdA]: {trigger_id: triggerIdA, dialog: {}}}),
        );
        subscribeCallback();

        expect(mockStore.dispatch).not.toHaveBeenCalled();
        expect(mockOpenModal).not.toHaveBeenCalled();
    });

    it('returns early without dispatching openModal when triggerId is not in the dialogs map', () => {
        const triggerId = nextId();

        // dialogs map is empty — the lookup dialogs[triggerId] returns undefined.
        mockStore.getState.mockReturnValue(makeState([], triggerId, {}));
        subscribeCallback();

        expect(mockStore.dispatch).not.toHaveBeenCalled();
        expect(mockOpenModal).not.toHaveBeenCalled();
    });

    it('dispatches openModal with the composite modalId when triggerId changed and dialog is in map and count is under cap', () => {
        const triggerId = nextId();
        mockStore.getState.mockReturnValue(
            makeState([], triggerId, {[triggerId]: {trigger_id: triggerId, dialog: {}}}),
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

    it('passes triggerId and onExited in dialogProps', () => {
        const triggerId = nextId();
        mockStore.getState.mockReturnValue(
            makeState([], triggerId, {[triggerId]: {trigger_id: triggerId, dialog: {}}}),
        );
        subscribeCallback();

        expect(mockOpenModal).toHaveBeenCalledWith(
            expect.objectContaining({
                dialogProps: expect.objectContaining({triggerId}),
            }),
        );

        const {dialogProps} = (mockOpenModal as jest.Mock).mock.calls[0][0];
        expect(typeof dialogProps.onExited).toBe('function');

        jest.clearAllMocks();
        dialogProps.onExited();
        expect(mockStore.dispatch).toHaveBeenCalledWith({
            type: IntegrationTypes.REMOVE_DIALOG,
            data: triggerId,
        });
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
                makeState(atCapIds, triggerId, {[triggerId]: {trigger_id: triggerId, dialog: {}}}),
            );
            subscribeCallback();

            expect(mockOpenModal).not.toHaveBeenCalled();
            expect(mockStore.dispatch).toHaveBeenCalledWith({
                type: IntegrationTypes.REMOVE_DIALOG,
                data: triggerId,
            });
            expect(warnSpy).toHaveBeenCalledWith('Maximum number of open dialogs reached');
        } finally {
            warnSpy.mockRestore();
        }
    });
});
