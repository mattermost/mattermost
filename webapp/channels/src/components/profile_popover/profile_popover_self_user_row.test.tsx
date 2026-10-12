// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import ProfilePopoverSelfUserRow from './profile_popover_self_user_row';

describe('components/ProfilePopoverSelfUserRow', () => {
    const selfDMId = 'me__me';
    const baseProps = {
        userId: 'me',
        currentUserId: 'me',
        haveOverrideProp: false,
        returnFocus: jest.fn(),
        handleCloseModals: jest.fn(),
        handleShowDirectChannel: jest.fn(),
    };

    function makeState(decisions: Record<string, boolean>, hasSelfDM: boolean): DeepPartial<GlobalState> {
        const entries = Object.fromEntries(Object.entries(decisions).map(([action, allowed]) => [action, {allowed, evaluated: true, generation: 1}]));
        return {
            entities: {
                general: {config: {FeatureFlagPermissionPolicies: 'true'}},
                users: {currentUserId: 'me'},
                channels: {
                    channels: hasSelfDM ? {[selfDMId]: TestHelper.getChannelMock({id: selfDMId, name: selfDMId, type: 'D', team_id: ''})} : {},
                    channelsInTeam: {'': new Set(hasSelfDM ? [selfDMId] : [])},
                },
                renderPermissions: {byResource: {permission: {'': entries}}},
            },
        };
    }

    const selfDMButton = () => screen.queryByRole('button', {name: 'Send yourself a message'});

    test('should offer the self-DM while the decisions are unknown', () => {
        renderWithContext(<ProfilePopoverSelfUserRow {...baseProps}/>, makeState({}, false));

        expect(selfDMButton()).toBeInTheDocument();
    });

    test('should hide the self-DM while Read is denied', () => {
        renderWithContext(<ProfilePopoverSelfUserRow {...baseProps}/>, makeState({dm_gm_read_access: false}, true));

        expect(selfDMButton()).not.toBeInTheDocument();
    });

    test('should hide the self-DM while Start is denied and it does not exist yet', () => {
        renderWithContext(<ProfilePopoverSelfUserRow {...baseProps}/>, makeState({dm_gm_start: false}, false));

        expect(selfDMButton()).not.toBeInTheDocument();
    });

    test('should keep an existing self-DM while Start is denied', () => {
        renderWithContext(<ProfilePopoverSelfUserRow {...baseProps}/>, makeState({dm_gm_start: false}, true));

        expect(selfDMButton()).toBeInTheDocument();
    });
});
