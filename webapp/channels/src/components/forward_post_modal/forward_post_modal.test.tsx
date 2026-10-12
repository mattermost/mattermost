// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import ForwardPostModal from '.';

// Stands in for the async channel picker: shows which channel types it was limited to and lets
// the test pick a DM with someone the user hasn't messaged yet.
jest.mock('./forward_post_channel_select', () => ({
    __esModule: true,
    default: ({validChannelTypes, onSelect}: {validChannelTypes?: string[]; onSelect: (option: unknown) => void}) => (
        <div>
            <span data-testid='valid-channel-types'>{validChannelTypes ? validChannelTypes.join(',') : 'all'}</span>
            <button onClick={() => onSelect({value: 'other_user', label: 'other_user', details: {id: 'other_user', type: 'D', userId: 'other_user'}})}>
                {'pick dm'}
            </button>
        </div>
    ),
    makeSelectedChannelOption: jest.fn(),
}));
jest.mock('./forward_post_comment_input', () => () => null);
jest.mock('components/post_view/post_message_preview', () => () => null);

describe('components/forward_post_modal', () => {
    const channel = TestHelper.getChannelMock({id: 'channel_id', type: 'O', team_id: 'team_id'});
    const post = TestHelper.getPostMock({id: 'post_id', channel_id: channel.id});

    function makeState(dmGmWriteAllowed: boolean): DeepPartial<GlobalState> {
        return {
            entities: {
                general: {config: {FeatureFlagPermissionPolicies: 'true'}},
                channels: {channels: {[channel.id]: channel}},
                teams: {currentTeamId: 'team_id', teams: {team_id: TestHelper.getTeamMock({id: 'team_id'})}},
                users: {currentUserId: 'current_user_id', profiles: {current_user_id: TestHelper.getUserMock({id: 'current_user_id'})}},
                renderPermissions: {byResource: {permission: {'': {dm_gm_write_access: {allowed: dmGmWriteAllowed, evaluated: true, generation: 1}}}}},
            },
        };
    }

    it('should offer only channels as targets while dm_gm_write_access denies', async () => {
        renderWithContext(<ForwardPostModal post={post}/>, makeState(false));

        expect(screen.getByTestId('valid-channel-types')).toHaveTextContent('O,P');

        await userEvent.click(screen.getByText('pick dm'));
        expect(screen.getByRole('button', {name: 'Forward'})).toBeDisabled();
    });

    it('should offer conversations as targets while dm_gm_write_access allows', async () => {
        renderWithContext(<ForwardPostModal post={post}/>, makeState(true));

        expect(screen.getByTestId('valid-channel-types')).toHaveTextContent('all');

        await userEvent.click(screen.getByText('pick dm'));
        expect(screen.getByRole('button', {name: 'Forward'})).toBeEnabled();
    });
});
