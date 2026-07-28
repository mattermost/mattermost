// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from 'types/store';

import {mapStateToProps} from './index';

describe('dialog_router mapStateToProps', () => {
    const triggerId = 'trigger-1';
    const userId = 'user-1';

    const legacyDialog = {
        callback_id: 'cb-legacy',
        title: 'Legacy Title',
        introduction_text: 'Intro',
        icon_url: 'https://example.com/legacy-icon.png',
        submit_label: 'Save',
        notify_on_cancel: true,
        state: 'legacy-state',
        source_url: 'https://example.com/refresh',
        elements: [{
            name: 'field1',
            type: 'text',
            display_name: 'Field',
            subtype: '',
            default: '',
            placeholder: '',
            help_text: '',
            optional: false,
            min_length: 0,
            max_length: 0,
            data_source: '',
            options: null,
        }],
    };

    const blockDialog = {
        title: 'Blocks Title',
        icon_url: 'https://example.com/blocks-icon.png',
        state: 'blocks-state',
        blocks: [{type: 'text', text: 'Hello'}],
        actions: 'encrypted-cookie',
        submit: {action: 'dialog_submit', label: 'Submit'},
        cancel: {action: 'dialog_cancel', label: 'Cancel'},
    };

    function makeState(overrides: {
        mmBlocksEnabled?: boolean;
        dialogs?: Record<string, unknown>;
    } = {}): GlobalState {
        const {mmBlocksEnabled = true, dialogs = {}} = overrides;
        return {
            entities: {
                general: {
                    config: {
                        FeatureFlagMmBlocksEnabled: mmBlocksEnabled ? 'true' : 'false',
                        EnableCustomEmoji: 'false',
                    },
                },
                integrations: {
                    dialogs,
                    dialogTriggerId: '',
                },
                emojis: {
                    customEmoji: {},
                },
                users: {
                    currentUserId: userId,
                    profiles: {
                        [userId]: {
                            id: userId,
                            timezone: {
                                useAutomaticTimezone: 'false',
                                automaticTimezone: '',
                                manualTimezone: 'America/New_York',
                            },
                        },
                    },
                },
            },
        } as unknown as GlobalState;
    }

    test('returns empty content when triggerId is missing', () => {
        const props = mapStateToProps(makeState(), {});

        expect(props).toEqual(expect.objectContaining({
            hasUrl: false,
            hasMmBlocks: false,
            hasContent: false,
            mmBlocksEnabled: true,
        }));
        expect(props.title).toBeUndefined();
        expect(props.mmBlocks).toBeUndefined();
    });

    test('returns empty content when dialog entry is missing', () => {
        const props = mapStateToProps(makeState(), {triggerId});

        expect(props.hasContent).toBe(false);
        expect(props.hasMmBlocks).toBe(false);
    });

    test('maps legacy dialog props and clears blocks props', () => {
        const props = mapStateToProps(makeState({
            dialogs: {
                [triggerId]: {
                    url: 'https://example.com/submit',
                    dialog: legacyDialog,
                },
            },
        }), {triggerId});

        expect(props).toEqual(expect.objectContaining({
            hasContent: true,
            hasMmBlocks: false,
            hasUrl: true,
            url: 'https://example.com/submit',
            title: 'Legacy Title',
            iconUrl: 'https://example.com/legacy-icon.png',
            state: 'legacy-state',
            callbackId: 'cb-legacy',
            introductionText: 'Intro',
            submitLabel: 'Save',
            notifyOnCancel: true,
            sourceUrl: 'https://example.com/refresh',
            elements: legacyDialog.elements,
            mmBlocks: undefined,
            mmBlocksActions: undefined,
            blockSubmit: undefined,
            blockCancel: undefined,
            timezone: 'America/New_York',
        }));
    });

    test('maps block_dialog props and clears legacy props when MmBlocksEnabled', () => {
        const props = mapStateToProps(makeState({
            dialogs: {
                [triggerId]: {
                    url: 'https://example.com/submit',
                    dialog: legacyDialog,
                    block_dialog: blockDialog,
                },
            },
        }), {triggerId});

        expect(props).toEqual(expect.objectContaining({
            hasContent: true,
            hasMmBlocks: true,
            hasUrl: false,
            url: undefined,
            title: 'Blocks Title',
            iconUrl: 'https://example.com/blocks-icon.png',
            state: 'blocks-state',
            mmBlocks: blockDialog.blocks,
            mmBlocksActions: 'encrypted-cookie',
            blockSubmit: blockDialog.submit,
            blockCancel: blockDialog.cancel,
            callbackId: undefined,
            elements: undefined,
            introductionText: undefined,
            submitLabel: undefined,
            notifyOnCancel: undefined,
            sourceUrl: undefined,
        }));
    });

    test('falls back to legacy when block_dialog present but MmBlocksEnabled is off', () => {
        const props = mapStateToProps(makeState({
            mmBlocksEnabled: false,
            dialogs: {
                [triggerId]: {
                    url: 'https://example.com/submit',
                    dialog: legacyDialog,
                    block_dialog: blockDialog,
                },
            },
        }), {triggerId});

        expect(props).toEqual(expect.objectContaining({
            hasContent: true,
            hasMmBlocks: false,
            mmBlocksEnabled: false,
            title: 'Legacy Title',
            mmBlocks: undefined,
            mmBlocksActions: undefined,
            blockSubmit: undefined,
            blockCancel: undefined,
            callbackId: 'cb-legacy',
        }));
    });

    test('has no content when only block_dialog exists and MmBlocksEnabled is off', () => {
        const props = mapStateToProps(makeState({
            mmBlocksEnabled: false,
            dialogs: {
                [triggerId]: {
                    block_dialog: blockDialog,
                },
            },
        }), {triggerId});

        expect(props.hasContent).toBe(false);
        expect(props.hasMmBlocks).toBe(false);
        expect(props.mmBlocksEnabled).toBe(false);
    });

    test('ignores non-string block_dialog.actions for mmBlocksActions', () => {
        const props = mapStateToProps(makeState({
            dialogs: {
                [triggerId]: {
                    block_dialog: {
                        ...blockDialog,
                        actions: {not: 'a-string'},
                    },
                },
            },
        }), {triggerId});

        expect(props.hasMmBlocks).toBe(true);
        expect(props.mmBlocksActions).toBeUndefined();
        expect(props.mmBlocks).toEqual(blockDialog.blocks);
    });
});
