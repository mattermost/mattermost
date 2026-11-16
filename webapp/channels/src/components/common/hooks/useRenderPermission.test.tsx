// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';

import {Client4} from 'mattermost-redux/client';

import {renderHookWithContext, waitFor} from 'tests/react_testing_utils';

import {useRenderPermission} from './useRenderPermission';

const channelId = 'channelid1channelid1channelid1';
const args = {resourceType: 'channel', resourceId: channelId, action: 'upload_file_attachment'};

function baseState(permissionPoliciesEnabled = true, byResource: any = {}) {
    return {
        entities: {
            general: {
                config: {FeatureFlagPermissionPolicies: permissionPoliciesEnabled ? 'true' : 'false'},
                license: {},
            },
            renderPermissions: {byResource},
        },
    };
}

function decisionResponse(allowed: boolean) {
    return {
        resource: {type: 'channel', id: channelId},
        results: allowed ? [{action: {name: 'upload_file_attachment'}}] : [],
        decisions: {upload_file_attachment: {allowed, evaluated: true}},
    };
}

describe('useRenderPermission', () => {
    beforeAll(() => {
        Client4.setUrl('http://localhost:8065');
    });

    afterEach(() => {
        nock.cleanAll();
    });

    test('returns the default and makes no request when permission policies are disabled', () => {
        const {result} = renderHookWithContext(() => useRenderPermission(args, true), baseState(false));

        expect(result.current).toBe(true);
        expect(nock.pendingMocks()).toHaveLength(0);
    });

    test('returns the default and makes no request without a resource id', () => {
        const {result} = renderHookWithContext(() => useRenderPermission({...args, resourceId: ''}, false), baseState());

        expect(result.current).toBe(false);
        expect(nock.pendingMocks()).toHaveLength(0);
    });

    test('returns the default while the decision is in flight, then the decision', async () => {
        const scope = nock(Client4.getBaseRoute()).
            post('/access_control/decisions/actions/search').
            reply(200, decisionResponse(false));

        const {result} = renderHookWithContext(() => useRenderPermission(args, true), baseState());

        expect(result.current).toBe(true);

        await waitFor(() => {
            expect(scope.isDone()).toBe(true);
        });
        await waitFor(() => {
            expect(result.current).toBe(false);
        });
    });

    test('reads a cached decision without fetching', () => {
        const byResource = {
            channel: {
                [channelId]: {
                    upload_file_attachment: {allowed: false, evaluated: true, reason: 'restricted_by_policy', generation: 1},
                },
            },
        };

        const {result} = renderHookWithContext(() => useRenderPermission(args, true), baseState(true, byResource));

        expect(result.current).toBe(false);
        expect(nock.pendingMocks()).toHaveLength(0);
    });

    test('a cached deny does not trigger a refetch loop', () => {
        const byResource = {
            channel: {
                [channelId]: {
                    upload_file_attachment: {allowed: false, evaluated: true, generation: 1},
                },
            },
        };

        const {result, rerender} = renderHookWithContext(() => useRenderPermission(args, true), baseState(true, byResource));

        rerender();
        rerender();

        expect(result.current).toBe(false);
        expect(nock.pendingMocks()).toHaveLength(0);
    });

    test('two hooks on the same resource and action issue a single request', async () => {
        const search = jest.spyOn(Client4, 'searchAccessControlDecisionActions').
            mockResolvedValue(decisionResponse(true));

        const {result} = renderHookWithContext(() => [
            useRenderPermission(args, false),
            useRenderPermission(args, false),
        ], baseState());

        await waitFor(() => {
            expect(result.current).toEqual([true, true]);
        });

        expect(search).toHaveBeenCalledTimes(1);
        expect(search).toHaveBeenCalledWith('channel', channelId, ['upload_file_attachment']);

        search.mockRestore();
    });

    test('different actions on the same resource are batched into one request', async () => {
        const search = jest.spyOn(Client4, 'searchAccessControlDecisionActions').mockResolvedValue({
            resource: {type: 'channel', id: channelId},
            results: [{action: {name: 'upload_file_attachment'}}],
            decisions: {
                upload_file_attachment: {allowed: true, evaluated: true},
                download_file_attachment: {allowed: false, evaluated: true},
            },
        });

        const {result} = renderHookWithContext(() => [
            useRenderPermission(args, false),
            useRenderPermission({...args, action: 'download_file_attachment'}, true),
        ], baseState());

        await waitFor(() => {
            expect(result.current).toEqual([true, false]);
        });

        expect(search).toHaveBeenCalledTimes(1);
        expect(search).toHaveBeenCalledWith('channel', channelId, ['upload_file_attachment', 'download_file_attachment']);

        search.mockRestore();
    });
});
