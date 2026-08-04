// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {renderHook} from '@testing-library/react';
import React from 'react';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';

import {fetchRenderActionsForResource} from 'mattermost-redux/actions/render_permissions';

import {useRenderPermission} from './useRenderPermission';

jest.mock('mattermost-redux/actions/render_permissions', () => ({
    fetchRenderActionsForResource: jest.fn(() => ({type: 'MOCK_FETCH_RENDER'})),
}));

const mockStore = configureStore([]);

function buildState(permissionPoliciesEnabled: boolean, byResource: any = {}) {
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

function wrapperFor(state: any) {
    const store = mockStore(state);
    return ({children}: {children: React.ReactNode}) => <Provider store={store}>{children}</Provider>;
}

const args = {resourceType: 'channel', resourceId: 'chan1', action: 'upload_file_attachment'};

describe('useRenderPermission', () => {
    beforeEach(() => {
        (fetchRenderActionsForResource as jest.Mock).mockClear();
    });

    test('returns allowed/evaluated and does not fetch when permission policies are disabled', () => {
        const {result} = renderHook(() => useRenderPermission(args), {wrapper: wrapperFor(buildState(false))});

        expect(result.current).toEqual({allowed: true, evaluated: true, loading: false});
        expect(fetchRenderActionsForResource).not.toHaveBeenCalled();
    });

    test('fetches on cache miss and reports loading', () => {
        const {result} = renderHook(() => useRenderPermission(args), {wrapper: wrapperFor(buildState(true))});

        expect(fetchRenderActionsForResource).toHaveBeenCalledWith('channel', 'chan1', ['upload_file_attachment']);
        expect(result.current.evaluated).toBe(false);
        expect(result.current.loading).toBe(true);
        expect(result.current.allowed).toBeUndefined();
    });

    test('returns a cached deny decision and does not fetch', () => {
        const byResource = {
            channel: {
                chan1: {
                    upload_file_attachment: {allowed: false, evaluated: true, reason: 'restricted_by_policy', generation: 1, receivedAt: 1},
                },
            },
        };
        const {result} = renderHook(() => useRenderPermission(args), {wrapper: wrapperFor(buildState(true, byResource))});

        expect(result.current.allowed).toBe(false);
        expect(result.current.evaluated).toBe(true);
        expect(result.current.reason).toBe('restricted_by_policy');
        expect(fetchRenderActionsForResource).not.toHaveBeenCalled();
    });
});
