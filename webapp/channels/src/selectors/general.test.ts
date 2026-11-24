// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from 'types/store';

import {isTeamMembershipAccessControlEnabled} from './general';

function buildState(abacEnabled: boolean, teamFlag: string): GlobalState {
    return {
        entities: {
            admin: {
                config: {
                    AccessControlSettings: {
                        EnableAttributeBasedAccessControl: abacEnabled,
                    },
                },
            },
            general: {
                config: {
                    FeatureFlagTeamMembershipAccessControl: teamFlag,
                },
            },
        },
    } as unknown as GlobalState;
}

describe('selectors/general', () => {
    describe('isTeamMembershipAccessControlEnabled', () => {
        test('should be false when ABAC is disabled even if the team flag is on', () => {
            expect(isTeamMembershipAccessControlEnabled(buildState(false, 'true'))).toBe(false);
        });

        test('should be false when the team flag is off even if ABAC is enabled', () => {
            expect(isTeamMembershipAccessControlEnabled(buildState(true, 'false'))).toBe(false);
        });

        test('should be true when both ABAC and the team flag are on', () => {
            expect(isTeamMembershipAccessControlEnabled(buildState(true, 'true'))).toBe(true);
        });
    });
});
