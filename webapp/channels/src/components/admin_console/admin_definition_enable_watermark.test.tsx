// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ClientLicense} from '@mattermost/types/config';

import {LicenseSkus} from 'utils/constants';

import AdminDefinition from './admin_definition';
import type {AdminDefinitionSetting} from './types';

type IsHiddenCheck = (config: object, state: object, license?: ClientLicense) => boolean;

describe('AdminDefinition - Enable Watermark setting', () => {
    const getFeatureSettings = () => {
        const featureSection = AdminDefinition.experimental.subsections.experimental_features;
        const settings = 'settings' in featureSection.schema! ? featureSection.schema.settings : undefined;

        return settings || [];
    };

    const getEnableWatermarkSetting = () => {
        return getFeatureSettings().find((setting: AdminDefinitionSetting) => setting.key === 'ExperimentalSettings.EnableWatermark');
    };

    const getEnableWatermarkIsHidden = (): IsHiddenCheck => {
        const enableWatermarkSetting = getEnableWatermarkSetting();
        expect(enableWatermarkSetting).toBeDefined();
        expect(typeof enableWatermarkSetting?.isHidden).toBe('function');

        return enableWatermarkSetting!.isHidden as IsHiddenCheck;
    };

    test('uses ExperimentalSettings.EnableWatermark in the experimental features section', () => {
        const enableWatermarkSetting = getEnableWatermarkSetting();

        expect(enableWatermarkSetting).toBeDefined();
        expect(enableWatermarkSetting?.type).toBe('bool');
        expect(enableWatermarkSetting?.label).toBeDefined();
        expect(enableWatermarkSetting?.help_text).toBeDefined();
    });

    test('is hidden below Enterprise license tier', () => {
        const professionalLicense = {
            IsLicensed: 'true',
            SkuShortName: LicenseSkus.Professional,
        } as ClientLicense;
        const isHidden = getEnableWatermarkIsHidden();

        expect(isHidden({}, {}, professionalLicense)).toBe(true);
    });

    test('is visible for Enterprise license tier and above', () => {
        const enterpriseLicense = {
            IsLicensed: 'true',
            SkuShortName: LicenseSkus.Enterprise,
        } as ClientLicense;
        const enterpriseAdvancedLicense = {
            IsLicensed: 'true',
            SkuShortName: LicenseSkus.EnterpriseAdvanced,
        } as ClientLicense;
        const isHidden = getEnableWatermarkIsHidden();

        expect(isHidden({}, {}, enterpriseLicense)).toBe(false);
        expect(isHidden({}, {}, enterpriseAdvancedLicense)).toBe(false);
    });
});
