// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createDirectChannel} from 'mattermost-redux/actions/channels';

import {renderHookWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import useStartDMCall from './use_start_dm_call';

jest.mock('mattermost-redux/actions/channels', () => ({
    ...jest.requireActual('mattermost-redux/actions/channels'),
    createDirectChannel: jest.fn(() => () => Promise.resolve({data: {id: 'new_dm'}})),
}));

describe('useStartDMCall', () => {
    const callAction = jest.fn();

    function makeState(dmGmStartAllowed: boolean) {
        return {
            entities: {
                general: {config: {FeatureFlagPermissionPolicies: 'true'}},
                users: {currentUserId: 'current_user_id'},
                renderPermissions: {byResource: {permission: {'': {dm_gm_start: {allowed: dmGmStartAllowed, evaluated: true, generation: 1}}}}},
            },
            plugins: {components: {CallButton: [{id: 'call', pluginId: 'calls', action: callAction}]}},
        };
    }

    beforeEach(() => {
        callAction.mockClear();
        jest.mocked(createDirectChannel).mockClear();
    });

    it('should neither create a DM nor start a call while starting conversations is blocked', async () => {
        const {result} = renderHookWithContext(() => useStartDMCall('other_user_id'), makeState(false));

        await result.current();

        expect(createDirectChannel).not.toHaveBeenCalled();
        expect(callAction).not.toHaveBeenCalled();
    });

    it('should still call into an existing DM while starting conversations is blocked', async () => {
        const dm = TestHelper.getChannelMock({id: 'dm_id', type: 'D'});
        const {result} = renderHookWithContext(() => useStartDMCall('other_user_id', dm), makeState(false));

        await result.current();

        expect(createDirectChannel).not.toHaveBeenCalled();
        expect(callAction).toHaveBeenCalledWith(dm, undefined);
    });

    it('should create the DM and start the call when allowed', async () => {
        const {result} = renderHookWithContext(() => useStartDMCall('other_user_id'), makeState(true));

        await result.current();

        expect(createDirectChannel).toHaveBeenCalledWith('current_user_id', 'other_user_id');
        expect(callAction).toHaveBeenCalledWith({id: 'new_dm'}, undefined);
    });
});
