// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage} from 'react-intl';

import {LicenseSkus} from 'utils/constants';

import MobileSecuritySVG from './images/mobile_security_svg';

import FeatureDiscovery from '../index';

const MobileSecurityFeatureDiscovery = () => {
    return (
        <FeatureDiscovery
            featureName='mobile_security'
            minimumSKURequiredForFeature={LicenseSkus.Enterprise}
            title={defineMessage({
                id: 'admin.mobile_security_feature_discovery.title',
                defaultMessage: 'Enhance mobile app security with Mattermost Enterprise',
            })}
            copy={defineMessage({
                id: 'admin.mobile_security_feature_discovery.copy',
                defaultMessage: 'Enable advanced security features like biometric authentication, screen capture prevention, and jailbreak/root detection for your mobile users.',
            })}
            learnMoreURL='https://docs.mattermost.com/configure/environment-configuration-settings.html#mobile-security'
            featureDiscoveryImage={
                <MobileSecuritySVG
                    width={294}
                    height={170}
                />}
        />
    );
};

export default MobileSecurityFeatureDiscovery;
