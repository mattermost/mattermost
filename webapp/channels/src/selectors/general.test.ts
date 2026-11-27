// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from 'types/store';

import {getExternalImageBlockingConfig, isTeamMembershipAccessControlEnabled} from './general';

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

    describe('getExternalImageBlockingConfig', () => {
        function buildImageProxyState(hasImageProxy: string, imageProxyType: string): GlobalState {
            return {
                entities: {
                    general: {
                        config: {
                            HasImageProxy: hasImageProxy,
                            ImageProxyType: imageProxyType,
                            SiteURL: 'https://chat.example.com',
                        },
                    },
                },
            } as unknown as GlobalState;
        }

        test('should block external images when the image proxy is enabled with block type', () => {
            expect(getExternalImageBlockingConfig(buildImageProxyState('true', 'block'))).toEqual({
                blockExternalImages: true,
                siteURL: 'https://chat.example.com',
            });
        });

        test('should not block external images when the image proxy is disabled', () => {
            expect(getExternalImageBlockingConfig(buildImageProxyState('false', 'block')).blockExternalImages).toBe(false);
        });

        test('should not block external images when the image proxy type is local', () => {
            expect(getExternalImageBlockingConfig(buildImageProxyState('true', 'local')).blockExternalImages).toBe(false);
        });
    });
});
