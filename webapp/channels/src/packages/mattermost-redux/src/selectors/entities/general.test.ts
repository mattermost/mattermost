// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GlobalState} from '@mattermost/types/store';

import {General} from 'mattermost-redux/constants';
import * as Selectors from 'mattermost-redux/selectors/entities/general';

describe('Selectors.General', () => {
    it('canUploadFilesOnMobile', () => {
        expect(Selectors.canUploadFilesOnMobile({
            entities: {
                general: {
                    config: {
                    },
                    license: {
                        IsLicensed: 'true',
                        Compliance: 'true',
                    },
                },
            },
        } as unknown as GlobalState)).toEqual(true);

        expect(Selectors.canUploadFilesOnMobile({
            entities: {
                general: {
                    config: {
                        EnableFileAttachments: 'false',
                    },
                    license: {
                        IsLicensed: 'true',
                        Compliance: 'true',
                    },
                },
            },
        } as unknown as GlobalState)).toEqual(false);

        expect(Selectors.canUploadFilesOnMobile({
            entities: {
                general: {
                    config: {
                        EnableFileAttachments: 'true',
                    },
                    license: {
                        IsLicensed: 'true',
                        Compliance: 'true',
                    },
                },
            },
        } as unknown as GlobalState)).toEqual(true);

        expect(Selectors.canUploadFilesOnMobile({
            entities: {
                general: {
                    config: {
                        EnableMobileFileUpload: 'false',
                    },
                    license: {
                        IsLicensed: 'true',
                        Compliance: 'true',
                    },
                },
            },
        } as unknown as GlobalState)).toEqual(false);

        expect(Selectors.canUploadFilesOnMobile({
            entities: {
                general: {
                    config: {
                        EnableFileAttachments: 'false',
                        EnableMobileFileUpload: 'false',
                    },
                    license: {
                        IsLicensed: 'true',
                        Compliance: 'true',
                    },
                },
            },
        } as unknown as GlobalState)).toEqual(false);

        expect(Selectors.canUploadFilesOnMobile({
            entities: {
                general: {
                    config: {
                        EnableFileAttachments: 'true',
                        EnableMobileFileUpload: 'false',
                    },
                    license: {
                        IsLicensed: 'true',
                        Compliance: 'true',
                    },
                },
            },
        } as unknown as GlobalState)).toEqual(false);

        expect(Selectors.canUploadFilesOnMobile({
            entities: {
                general: {
                    config: {
                        EnableMobileFileUpload: 'true',
                    },
                    license: {
                        IsLicensed: 'true',
                        Compliance: 'true',
                    },
                },
            },
        } as unknown as GlobalState)).toEqual(true);

        expect(Selectors.canUploadFilesOnMobile({
            entities: {
                general: {
                    config: {
                        EnableFileAttachments: 'false',
                        EnableMobileFileUpload: 'true',
                    },
                    license: {
                        IsLicensed: 'true',
                        Compliance: 'true',
                    },
                },
            },
        } as unknown as GlobalState)).toEqual(false);

        expect(Selectors.canUploadFilesOnMobile({
            entities: {
                general: {
                    config: {
                        EnableFileAttachments: 'true',
                        EnableMobileFileUpload: 'true',
                    },
                    license: {
                        IsLicensed: 'true',
                        Compliance: 'true',
                    },
                },
            },
        } as unknown as GlobalState)).toEqual(true);

        expect(Selectors.canUploadFilesOnMobile({
            entities: {
                general: {
                    config: {
                        EnableFileAttachments: 'false',
                    },
                    license: {
                        IsLicensed: 'false',
                        Compliance: 'false',
                    },
                },
            },
        } as unknown as GlobalState)).toEqual(false);

        expect(Selectors.canUploadFilesOnMobile({
            entities: {
                general: {
                    config: {
                        EnableFileAttachments: 'true',
                        EnableMobileFileUpload: 'false',
                    },
                    license: {
                        IsLicensed: 'false',
                        Compliance: 'false',
                    },
                },
            },
        } as unknown as GlobalState)).toEqual(true);

        expect(Selectors.canUploadFilesOnMobile({
            entities: {
                general: {
                    config: {
                        EnableFileAttachments: 'true',
                        EnableMobileFileUpload: 'false',
                    },
                    license: {
                        IsLicensed: 'true',
                        Compliance: 'false',
                    },
                },
            },
        } as unknown as GlobalState)).toEqual(true);
    });

    it('canDownloadFilesOnMobile', () => {
        expect(Selectors.canDownloadFilesOnMobile({
            entities: {
                general: {
                    config: {
                    },
                    license: {
                        IsLicensed: 'true',
                        Compliance: 'true',
                    },
                },
            },
        } as unknown as GlobalState)).toEqual(true);

        expect(Selectors.canDownloadFilesOnMobile({
            entities: {
                general: {
                    config: {
                        EnableMobileFileDownload: 'false',
                    },
                    license: {
                        IsLicensed: 'true',
                        Compliance: 'true,',
                    },
                },
            },
        } as unknown as GlobalState)).toEqual(false);

        expect(Selectors.canDownloadFilesOnMobile({
            entities: {
                general: {
                    config: {
                        EnableMobileFileDownload: 'true',
                    },
                    license: {
                        IsLicensed: 'true',
                        Compliance: 'true',
                    },
                },
            },
        } as unknown as GlobalState)).toEqual(true);

        expect(Selectors.canDownloadFilesOnMobile({
            entities: {
                general: {
                    config: {
                        EnableMobileFileDownload: 'false',
                    },
                    license: {
                        IsLicensed: 'false',
                        Compliance: 'false',
                    },
                },
            },
        } as unknown as GlobalState)).toEqual(true);

        expect(Selectors.canDownloadFilesOnMobile({
            entities: {
                general: {
                    config: {
                        EnableMobileFileDownload: 'false',
                    },
                    license: {
                        IsLicensed: 'true',
                        Compliance: 'false',
                    },
                },
            },
        } as unknown as GlobalState)).toEqual(true);
    });

    describe('getAutolinkedUrlSchemes', () => {
        it('setting doesn\'t exist', () => {
            const state = {
                entities: {
                    general: {
                        config: {
                        },
                    },
                },
            } as unknown as GlobalState;

            expect(Selectors.getAutolinkedUrlSchemes(state)).toEqual(General.DEFAULT_AUTOLINKED_URL_SCHEMES);
            expect(Selectors.getAutolinkedUrlSchemes(state)).toEqual(Selectors.getAutolinkedUrlSchemes(state));
        });

        it('no custom url schemes', () => {
            const state = {
                entities: {
                    general: {
                        config: {
                            CustomUrlSchemes: '',
                        },
                    },
                },
            } as unknown as GlobalState;

            expect(Selectors.getAutolinkedUrlSchemes(state)).toEqual(General.DEFAULT_AUTOLINKED_URL_SCHEMES);
            expect(Selectors.getAutolinkedUrlSchemes(state)).toEqual(Selectors.getAutolinkedUrlSchemes(state));
        });

        it('one custom url scheme', () => {
            const state = {
                entities: {
                    general: {
                        config: {
                            CustomUrlSchemes: 'dns',
                        },
                    },
                },
            } as unknown as GlobalState;

            expect(Selectors.getAutolinkedUrlSchemes(state)).toEqual([...General.DEFAULT_AUTOLINKED_URL_SCHEMES, 'dns']);
            expect(Selectors.getAutolinkedUrlSchemes(state)).toEqual(Selectors.getAutolinkedUrlSchemes(state));
        });

        it('multiple custom url schemes', () => {
            const state = {
                entities: {
                    general: {
                        config: {
                            CustomUrlSchemes: 'dns,steam,shttp',
                        },
                    },
                },
            } as unknown as GlobalState;

            expect(Selectors.getAutolinkedUrlSchemes(state)).toEqual([...General.DEFAULT_AUTOLINKED_URL_SCHEMES, 'dns', 'steam', 'shttp']);
            expect(Selectors.getAutolinkedUrlSchemes(state)).toEqual(Selectors.getAutolinkedUrlSchemes(state));
        });
    });

    describe('getManagedResourcePaths', () => {
        test('should return empty array when the setting doesn\'t exist', () => {
            const state = {
                entities: {
                    general: {
                        config: {
                        },
                    },
                },
            } as unknown as GlobalState;

            expect(Selectors.getManagedResourcePaths(state)).toEqual([]);
        });

        test('should return an array of trusted paths', () => {
            const state = {
                entities: {
                    general: {
                        config: {
                            ManagedResourcePaths: 'trusted,jitsi , test',
                        },
                    },
                },
            } as unknown as GlobalState;

            expect(Selectors.getManagedResourcePaths(state)).toEqual(['trusted', 'jitsi', 'test']);
        });
    });

    describe('getFeatureFlagValue', () => {
        test('should return undefined when feature flag does not exist', () => {
            const state = {
                entities: {
                    general: {
                        config: {
                        },
                    },
                },
            } as unknown as GlobalState;

            expect(Selectors.getFeatureFlagValue(state, 'CoolFeature')).toBeUndefined();
        });

        test('should return the value of a valid feature flag', () => {
            const state = {
                entities: {
                    general: {
                        config: {
                            FeatureFlagCoolFeature: 'true',
                        },
                    },
                },
            } as unknown as GlobalState;

            expect(Selectors.getFeatureFlagValue(state, 'CoolFeature')).toEqual('true');
        });
    });

    describe('firstAdminVisitMarketplaceStatus', () => {
        test('should return empty when status does not exist', () => {
            const state = {
                entities: {
                    general: {
                        firstAdminVisitMarketplaceStatus: {
                        },
                    },
                },
            } as unknown as GlobalState;

            expect(Selectors.getFirstAdminVisitMarketplaceStatus(state)).toEqual({});
        });

        test('should return the value of the status', () => {
            const state = {
                entities: {
                    general: {
                        firstAdminVisitMarketplaceStatus: true,
                    },
                },
            } as unknown as GlobalState;

            expect(Selectors.getFirstAdminVisitMarketplaceStatus(state)).toEqual(true);
            state.entities.general.firstAdminVisitMarketplaceStatus = false;
            expect(Selectors.getFirstAdminVisitMarketplaceStatus(state)).toEqual(false);
        });
    });
});

