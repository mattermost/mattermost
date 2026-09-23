// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import ConnectedDialogRouter from './index';

// Capture what mapStateToProps resolved, without rendering the real form stack.
let capturedProps: any;
jest.mock('./interactive_dialog_adapter', () => {
    return function MockInteractiveDialogAdapter(props: any) {
        capturedProps = props;
        return <div data-testid='interactive-dialog-adapter'/>;
    };
});

describe('components/dialog_router/index — mapStateToProps', () => {
    const triggerId = 'trigger_for_channel_x';

    const makeState = (dialogChannelId?: string): DeepPartial<GlobalState> => ({
        entities: {
            integrations: {
                dialogs: {
                    [triggerId]: {
                        trigger_id: triggerId,
                        url: 'http://example.com',
                        channel_id: dialogChannelId,
                        dialog: {
                            callback_id: 'abc123',
                            title: 'Test Dialog',
                            elements: [],
                        },
                    },
                },
            },
        },
    });

    beforeEach(() => {
        capturedProps = undefined;
    });

    // MM-70251 / ECHO-40: the server resolves the channel from the trigger, so it is
    // correct even for a dialog this client never initiated — a command a plugin ran
    // server-side against a playbook run's channel, for instance.
    test('uses the channel the server sent with the dialog', () => {
        renderWithContext(
            <ConnectedDialogRouter triggerId={triggerId}/>,
            makeState('channel_from_server'),
        );

        expect(capturedProps.channelId).toBe('channel_from_server');
    });

    // Only reachable for a trigger minted by a node that predates the change; the submit
    // and lookup actions then fall back to the current channel.
    test('supplies no channel when the dialog carries none', () => {
        renderWithContext(
            <ConnectedDialogRouter triggerId={triggerId}/>,
            makeState(),
        );

        expect(capturedProps.channelId).toBeUndefined();
    });
});
