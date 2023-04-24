// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {t} from 'utils/i18n';
import {LicenseSkus} from 'utils/constants';

import FeatureDiscovery from '../index';

import SamlSVG from './images/saml_svg';

const SAMLFeatureDiscovery: React.FC = () => {
    return (
        <FeatureDiscovery
            featureName='saml'
            minimumSKURequiredForFeature={LicenseSkus.Professional}
            titleID='admin.saml_feature_discovery.title'
            titleDefault='Integrate SAML 2.0 with Mattermost Professional'
            copyID='admin.saml_feature_discovery.copy'
            copyDefault={'When you connect Mattermost with your organization\'s single sign-on provider, users can access Mattermost without having to re-enter their credentials.'}
            learnMoreURL='https://www.mattermost.com/docs-saml/?utm_medium=product&utm_source=product-feature-discovery&utm_content=saml'
            featureDiscoveryImage={<SamlSVG/>}
        />
    );
};

t('admin.saml_feature_discovery.title');
t('admin.saml_feature_discovery.copy');

export default SAMLFeatureDiscovery;
