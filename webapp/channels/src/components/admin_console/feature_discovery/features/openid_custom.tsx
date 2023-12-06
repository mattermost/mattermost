// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {LicenseSkus} from 'utils/constants';
import {t} from 'utils/i18n';

import SamlSVG from './images/saml_svg';

import FeatureDiscovery from '../index';

const OpenIDCustomFeatureDiscovery: React.FC = () => {
    return (
        <FeatureDiscovery
            featureName='openid'
            minimumSKURequiredForFeature={LicenseSkus.Professional}
            titleID='admin.openid_custom_feature_discovery.title'
            titleDefault='Integrate OpenID Connect with Mattermost Professional'
            copyID='admin.openid_custom_feature_discovery.copy'
            copyDefault={'Use OpenID Connect for authentication and single sign-on (SSO) with any service that supports the OIDC specification such as Apple, Okta, OneLogin, and more.'}
            learnMoreURL='https://docs.mattermost.com/cloud/cloud-administration/sso-openid-connect.html'
            featureDiscoveryImage={<SamlSVG/>}
        />
    );
};

t('admin.openid_custom_feature_discovery.title');
t('admin.openid_custom_feature_discovery.copy');

export default OpenIDCustomFeatureDiscovery;
