// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createMemoryHistory} from 'history';
import React, {lazy} from 'react';

import {Client4} from 'mattermost-redux/client';

import LocalStorageStore from 'stores/local_storage_store';

import {makeAsyncComponent} from 'components/async_load';

import {renderWithContext, screen, waitFor} from 'tests/react_testing_utils';

import QueryParamActionController from './query_param_action_controller';

jest.mock('components/user_settings/modal', () => () => null);

// The global setup stubs useHistory with a fake that never changes the URL; this test needs the router's own.
jest.mock('react-router-dom', () => jest.requireActual('react-router-dom'));

// Mounted the way channel_controller mounts them: the prompt is lazy, and in the app its chunk arrives
// over the network, so it first renders after the controller's effect has stripped the action from the URL.
// The delay stands in for that load; without it jest resolves the import before the effect runs.
const PasskeyEnrollmentPrompt = makeAsyncComponent('PasskeyEnrollmentPrompt', lazy(async () => {
    await new Promise((r) => setTimeout(r, 20));
    return import('components/passkey_enrollment/passkey_enrollment_prompt');
}));

describe('open_security_settings with the passkey prompt', () => {
    beforeEach(() => {
        localStorage.clear();
        document.cookie = 'MMCSRF=tok1';
        jest.spyOn(Client4, 'getSessions').mockResolvedValue([{props: {csrf: 'tok1', login_method: 'standard'}, create_at: Date.now()}] as never);
        Object.defineProperty(window, 'PublicKeyCredential', {value: function PublicKeyCredential() {}, configurable: true});
    });

    afterEach(() => {
        jest.restoreAllMocks();
        Reflect.deleteProperty(window, 'PublicKeyCredential');
        document.cookie = 'MMCSRF=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    });

    test('opens Profile and leaves the prompt closed and still due', async () => {
        const history = createMemoryHistory({initialEntries: ['/team/town-square?action=open_security_settings']});
        const {store} = renderWithContext(
            <>
                <QueryParamActionController/>
                <PasskeyEnrollmentPrompt/>
            </>,
            {entities: {general: {config: {PasskeyEnrollmentEnabled: 'true'}}, users: {currentUserId: 'user1'}}},
            {history},
        );

        await waitFor(() => expect(Client4.getSessions).toHaveBeenCalled());
        await new Promise((r) => setTimeout(r, 50));

        expect(history.location.search).toBe('');
        expect(store.getState().views.modals.modalState.user_settings.open).toBe(true);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(LocalStorageStore.isPasskeyPromptDue('user1', 'tok1')).toBe(true);
    });

    test('still opens the prompt on an ordinary load', async () => {
        renderWithContext(
            <>
                <QueryParamActionController/>
                <PasskeyEnrollmentPrompt/>
            </>,
            {entities: {general: {config: {PasskeyEnrollmentEnabled: 'true'}}, users: {currentUserId: 'user1'}}},
            {history: createMemoryHistory({initialEntries: ['/team/town-square']})},
        );

        expect(await screen.findByRole('dialog')).toBeInTheDocument();
    });
});
