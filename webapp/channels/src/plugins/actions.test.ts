// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {LogLevel} from '@mattermost/types/client4';
import type {PluginManifest} from '@mattermost/types/plugins';

import {Client4} from 'mattermost-redux/client';

import {logPluginLoadFailure} from './actions';

describe('logPluginLoadFailure', () => {
    const manifest = {id: 'github', version: '2.8.0'} as PluginManifest;
    let enableLogging: boolean;

    beforeEach(() => {
        enableLogging = Client4.enableLogging;
        Client4.enableLogging = true;
        jest.spyOn(Math, 'random').mockReturnValue(0);
        jest.spyOn(Client4, 'logClientError').mockResolvedValue({message: 'logged'});
    });

    afterEach(() => {
        Client4.enableLogging = enableLogging;
        jest.restoreAllMocks();
    });

    async function report(error: unknown = new Error('ReactCurrentOwner')) {
        return (logPluginLoadFailure(manifest, 'execution', error) as () => Promise<unknown>)();
    }

    test.each([0, 0.049999])('sends a sampled failure when the random value is %s', async (value) => {
        jest.mocked(Math.random).mockReturnValue(value);
        await report();
        expect(Client4.logClientError).toHaveBeenCalledWith(
            'plugin_load_failed plugin_id=github plugin_version=2.8.0 reason=execution error=ReactCurrentOwner',
            LogLevel.Error,
        );
    });

    test.each([0.05, 0.5, 0.999999])('skips reporting when the random value is %s', async (value) => {
        jest.mocked(Math.random).mockReturnValue(value);
        await expect(report()).resolves.toEqual({data: true});
        expect(Client4.logClientError).not.toHaveBeenCalled();
    });

    test('bounds the message and removes control characters', async () => {
        await report(new Error('\n' + 'é'.repeat(500)));
        const message = jest.mocked(Client4.logClientError).mock.calls[0][0];
        expect(message).toHaveLength(399);
        expect(message).toMatch(/^[\x20-\x7E]+$/);
    });

    test('respects disabled client logging', async () => {
        Client4.enableLogging = false;
        await report();
        expect(Client4.logClientError).not.toHaveBeenCalled();
        expect(Math.random).not.toHaveBeenCalled();
    });

    test.each(['throw', 'reject'])('contains logging failures that %s', async (failure) => {
        if (failure === 'throw') {
            jest.mocked(Client4.logClientError).mockImplementation(() => {
                throw new Error('Logging unavailable');
            });
        } else {
            jest.mocked(Client4.logClientError).mockRejectedValue(new Error('Logging unavailable'));
        }
        await expect(report()).resolves.toEqual({data: true});
    });
});
