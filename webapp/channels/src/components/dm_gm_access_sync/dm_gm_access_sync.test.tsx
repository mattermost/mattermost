// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {GeneralTypes, RenderPermissionTypes} from 'mattermost-redux/action_types';

import {fetchDmGmAccess, hideDirectAndGroupChannels, restoreDirectAndGroupChannels} from 'actions/dm_gm_access';

import {act, renderWithContext} from 'tests/react_testing_utils';

import DmGmAccessSync from '.';

// The flag's action type is spelled out because jest.mock factories can't reference imports.
jest.mock('actions/dm_gm_access', () => ({
    fetchDmGmAccess: jest.fn(() => ({type: 'MOCK_FETCH_DM_GM_ACCESS'})),

    // Behaves like the real one as far as this component can see: the conversations go and the
    // flag is set.
    hideDirectAndGroupChannels: jest.fn(() => ({type: 'SET_DM_GM_HIDDEN', data: true})),
    restoreDirectAndGroupChannels: jest.fn(() => ({type: 'SET_DM_GM_HIDDEN', data: false})),
}));

const config = {FeatureFlagPermissionPolicies: 'true'};

function readDecision(allowed: boolean, generation = 1) {
    return {
        type: RenderPermissionTypes.RECEIVED_RENDER_DECISIONS,
        data: {resourceType: 'permission', resourceId: '', actions: {dm_gm_read_access: {allowed, evaluated: true}}, generation},
    };
}

describe('components/dm_gm_access_sync', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should fetch on mount and leave conversations alone while the decision is unknown', () => {
        renderWithContext(<DmGmAccessSync/>, {entities: {general: {config}}});

        expect(fetchDmGmAccess).toHaveBeenCalledTimes(1);
        expect(hideDirectAndGroupChannels).not.toHaveBeenCalled();
        expect(restoreDirectAndGroupChannels).not.toHaveBeenCalled();
    });

    it('should fetch again when permission policies turn on', () => {
        const {store} = renderWithContext(<DmGmAccessSync/>, {entities: {general: {config: {FeatureFlagPermissionPolicies: 'false'}}}});
        expect(fetchDmGmAccess).toHaveBeenCalledTimes(1);

        act(() => {
            store.dispatch({type: GeneralTypes.CLIENT_CONFIG_RECEIVED, data: config});
        });

        expect(fetchDmGmAccess).toHaveBeenCalledTimes(2);
    });

    it('should hide conversations once when Read is denied', () => {
        const {store} = renderWithContext(<DmGmAccessSync/>, {entities: {general: {config}}});

        act(() => {
            store.dispatch(readDecision(false));
        });

        expect(hideDirectAndGroupChannels).toHaveBeenCalledTimes(1);
        expect(restoreDirectAndGroupChannels).not.toHaveBeenCalled();
    });

    it('should hide a conversation that arrives while Read is denied', () => {
        const {store} = renderWithContext(<DmGmAccessSync/>, {
            entities: {
                general: {config},
                renderPermissions: {byResource: {permission: {'': {dm_gm_read_access: {allowed: false, evaluated: true, generation: 1}}}}},
            },
            views: {channel: {dmGmHidden: true}},
        });
        expect(hideDirectAndGroupChannels).not.toHaveBeenCalled();

        act(() => {
            store.dispatch({type: 'RECEIVED_CHANNEL', data: {id: 'dm1', team_id: '', type: 'D', name: 'a__b'}});
        });
        expect(hideDirectAndGroupChannels).toHaveBeenCalledTimes(1);
    });

    it('should restore conversations when Read returns', () => {
        const {store} = renderWithContext(<DmGmAccessSync/>, {entities: {general: {config}}});

        act(() => {
            store.dispatch(readDecision(false, 1));
        });
        act(() => {
            store.dispatch(readDecision(true, 2));
        });

        expect(restoreDirectAndGroupChannels).toHaveBeenCalledTimes(1);
        expect(store.getState().views.channel.dmGmHidden).toBe(false);
    });

    it('should restore conversations when permission policies turn off', () => {
        const {store} = renderWithContext(<DmGmAccessSync/>, {entities: {general: {config}}});

        act(() => {
            store.dispatch(readDecision(false));
        });
        act(() => {
            store.dispatch({type: GeneralTypes.CLIENT_CONFIG_RECEIVED, data: {FeatureFlagPermissionPolicies: 'false'}});
        });

        expect(restoreDirectAndGroupChannels).toHaveBeenCalledTimes(1);
    });
});
