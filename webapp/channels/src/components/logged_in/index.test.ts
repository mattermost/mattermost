// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ClientLicense} from '@mattermost/types/config';

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import TestHelper from 'packages/mattermost-redux/test/test_helper';
import {LicenseSkus} from 'utils/constants';
import {isEnterpriseLicense} from 'utils/license_utils';

import type {GlobalState} from 'types/store';

import {mapStateToProps} from './index';

describe('LoggedIn mapStateToProps', () => {
    const baseState = {
        entities: {
            channels: {
                currentChannelId: 'current-channel-id',
                myMembers: {},
                manuallyUnread: {},
            },
            general: {
                config: {},
                license: {} as ClientLicense,
                featureFlags: {},
            },
            users: {
                currentUserId: 'current-user-id',
                profiles: {
                    'current-user-id': TestHelper.fakeUserWithId('current-user-id'),
                },
            },
            preferences: {
                myPreferences: {},
            },
        },
    } as unknown as GlobalState;

    const baseProps = {
        match: {
            url: '/team/channel',
        },
    } as any;

    describe('license utility function', () => {
        it('should correctly identify Enterprise license', () => {
            const enterpriseLicense = {
                IsLicensed: 'true',
                SkuShortName: LicenseSkus.Enterprise,
            } as ClientLicense;

            expect(isEnterpriseLicense(enterpriseLicense)).toBe(true);
        });
    });

    describe('customProfileAttributesEnabled', () => {
        it('should be false when not Enterprise license', () => {
            const state = mergeObjects(baseState, {
                entities: {
                    general: {
                        license: {
                            IsLicensed: 'false',
                        } as ClientLicense,
                        config: {
                            FeatureFlagCustomProfileAttributes: 'true',
                        },
                    },
                },
            });

            const props = mapStateToProps(state, baseProps);

            expect(props.customProfileAttributesEnabled).toBe(false);
        });

        it('should be false when Enterprise license but feature flag disabled', () => {
            const state = mergeObjects(baseState, {
                entities: {
                    general: {
                        license: {
                            IsLicensed: 'true',
                            SkuShortName: LicenseSkus.Enterprise,
                        } as ClientLicense,
                        config: {
                            FeatureFlagCustomProfileAttributes: 'false',
                        },
                    },
                },
            });

            const props = mapStateToProps(state, baseProps);

            expect(props.customProfileAttributesEnabled).toBe(false);
        });

        it('should be false when Enterprise license but feature flag missing', () => {
            const state = mergeObjects(baseState, {
                entities: {
                    general: {
                        license: {
                            IsLicensed: 'true',
                            SkuShortName: LicenseSkus.Enterprise,
                        } as ClientLicense,
                        config: {},
                    },
                },
            });

            const props = mapStateToProps(state, baseProps);

            expect(props.customProfileAttributesEnabled).toBe(false);
        });

        it('should be true when Enterprise license and feature flag enabled', () => {
            const state = mergeObjects(baseState, {
                entities: {
                    general: {
                        license: {
                            IsLicensed: 'true',
                            SkuShortName: LicenseSkus.Enterprise,
                        } as ClientLicense,
                        config: {
                            FeatureFlagCustomProfileAttributes: 'true',
                        },
                    },
                },
            });

            const props = mapStateToProps(state, baseProps);

            expect(props.customProfileAttributesEnabled).toBe(true);
        });

        it('should be false when no license information available', () => {
            const state = mergeObjects(baseState, {
                entities: {
                    general: {
                        license: {} as ClientLicense,
                        config: {
                            FeatureFlagCustomProfileAttributes: 'true',
                        },
                    },
                },
            });

            const props = mapStateToProps(state, baseProps);

            expect(props.customProfileAttributesEnabled).toBe(false);
        });
    });

    describe('other props', () => {
        it('should return correct props structure', () => {
            const state = mergeObjects(baseState, {
                entities: {
                    general: {
                        license: {
                            IsLicensed: 'true',
                            SkuShortName: LicenseSkus.Enterprise,
                        } as ClientLicense,
                        config: {
                            FeatureFlagCustomProfileAttributes: 'true',
                        },
                    },
                },
            });

            const props = mapStateToProps(state, baseProps);

            expect(props).toEqual({
                currentUser: expect.any(Object),
                currentChannelId: 'current-channel-id',
                isCurrentChannelManuallyUnread: false,
                mfaRequired: false,
                showTermsOfService: false,
                customProfileAttributesEnabled: true,
            });
        });
    });
});
