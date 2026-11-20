// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';

import {Client4} from 'mattermost-redux/client';

import {renderHookWithContext, waitFor} from 'tests/react_testing_utils';

import {useCreateBurnOnReadAccess} from './useCreateBurnOnReadAccess';

const channelId = 'channelid1channelid1channelid1';

function stateWith({permissionFlag = true, byResource = {}}) {
    return {
        entities: {
            general: {
                config: {
                    FeatureFlagPermissionPolicies: permissionFlag ? 'true' : 'false',
                },
                license: {},
            },
            renderPermissions: {byResource},
        },
    };
}

function decisionIs(allowed: boolean) {
    return {
        channel: {
            [channelId]: {
                create_burn_on_read_post: {allowed, evaluated: true, generation: 1},
            },
        },
    };
}

describe('useCreateBurnOnReadAccess', () => {
    beforeAll(() => {
        Client4.setUrl('http://localhost:8065');
    });

    afterEach(() => {
        nock.cleanAll();
    });

    test('fails closed while the decision is pending', () => {
        const {result} = renderHookWithContext(() => useCreateBurnOnReadAccess(channelId), stateWith({}));

        expect(result.current).toBe(false);
    });

    test('follows the decision once it arrives', async () => {
        const search = jest.spyOn(Client4, 'searchAccessControlDecisionActions').mockResolvedValue({
            resource: {type: 'channel', id: channelId},
            results: [],
            decisions: {create_burn_on_read_post: {allowed: true, evaluated: true}},
        });

        const {result} = renderHookWithContext(() => useCreateBurnOnReadAccess(channelId), stateWith({}));

        await waitFor(() => {
            expect(result.current).toBe(true);
        });

        expect(search).toHaveBeenCalledWith('channel', channelId, ['create_burn_on_read_post']);

        search.mockRestore();
    });

    test('follows a denying decision', () => {
        const {result} = renderHookWithContext(() => useCreateBurnOnReadAccess(channelId), stateWith({byResource: decisionIs(false)}));

        expect(result.current).toBe(false);
    });

    // Flag off is not the same as pending: no decision is ever asked for, so the fail-closed
    // default would stick forever. Burn-on-read is ungated in that state, not unknown.
    test('allows and asks nothing when permission policies are off', () => {
        const {result} = renderHookWithContext(() => useCreateBurnOnReadAccess(channelId), stateWith({permissionFlag: false}));

        expect(result.current).toBe(true);
        expect(nock.pendingMocks()).toHaveLength(0);
    });

    test('allows even a cached deny when permission policies are off', () => {
        const {result} = renderHookWithContext(
            () => useCreateBurnOnReadAccess(channelId),
            stateWith({permissionFlag: false, byResource: decisionIs(false)}),
        );

        expect(result.current).toBe(true);
    });

    // Callers pass no channel where the question doesn't arise — an ordinary scheduled post, or
    // a composer exported to a plugin without one. Nothing is asked of the server, and the
    // answer is the fail-closed default, which those callers ignore.
    test('asks nothing without a channel', () => {
        const {result} = renderHookWithContext(() => useCreateBurnOnReadAccess(undefined), stateWith({}));

        expect(result.current).toBe(false);
        expect(nock.pendingMocks()).toHaveLength(0);
    });
});
